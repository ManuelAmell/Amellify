import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

process.env.AMELLIFY_TEST_MODE = "1";

const require = createRequire(import.meta.url);
const { startAmellifyServer } = require("../server.js");

const PORT = 31997;
const PREFIX = "ZTAPI_";
let base;
let server;
let authHeaders = {};

before(async () => {
  const started = await startAmellifyServer({
    host: "127.0.0.1",
    port: PORT,
    displayHost: "127.0.0.1",
  });
  server = started.server;
  base = `http://127.0.0.1:${PORT}`;

  const email = `integration-${Date.now()}@test.amellify`;
  const regRes = await fetch(`${base}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password: "integracion99",
      name: "Integration Test",
    }),
  });
  const regBody = await regRes.json();
  authHeaders = { Authorization: `Bearer ${regBody.token}` };
});

after(() =>
  new Promise((resolve) => {
    server?.close(() => resolve());
  })
);

async function api(path, options = {}) {
  const headers = {
    ...authHeaders,
    ...options.headers,
  };
  const res = await fetch(`${base}${path}`, { ...options, headers });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { res, body };
}

async function cleanupCodes() {
  const { body: courses } = await api("/api/courses");
  if (!Array.isArray(courses)) return;
  for (const c of courses) {
    if (String(c.code).startsWith(PREFIX)) {
      await api(`/api/courses/${c.code}`, { method: "DELETE" });
    }
  }
}

test("CRUD materia y duplicar", async () => {
  await cleanupCodes();
  const code = `${PREFIX}01`;

  let { res, body } = await api("/api/courses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code,
      name: "Prueba API",
      schedules: [{ day: "Lunes", start_time: "09:00", end_time: "11:00", room: "X" }],
    }),
  });
  assert.equal(res.status, 201);
  assert.equal(body.code, code);

  ({ res, body } = await api(`/api/courses/${code}/duplicate`, { method: "POST" }));
  assert.equal(res.status, 201);
  assert.notEqual(body.code, code);
  assert.match(body.code, new RegExp(`^${PREFIX}`));

  await api(`/api/courses/${body.code}`, { method: "DELETE" });
  await api(`/api/courses/${code}`, { method: "DELETE" });
});

test("renombrar materia migra horarios", async () => {
  await cleanupCodes();
  const oldCode = `${PREFIX}OLD`;
  const newCode = `${PREFIX}NEW`;

  await api("/api/courses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code: oldCode,
      name: "Rename",
      schedules: [{ day: "Martes", start_time: "10:00", end_time: "12:00" }],
    }),
  });

  const { res } = await api(`/api/courses/${oldCode}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code: newCode,
      name: "Rename",
      schedules: [{ day: "Miércoles", start_time: "10:00", end_time: "12:00" }],
    }),
  });
  assert.equal(res.status, 200);

  const { body: course } = await api(`/api/courses/${newCode}`);
  assert.equal(course.code, newCode);
  assert.equal(course.schedules[0].course_code, newCode);
  assert.equal(course.schedules[0].day, "Miércoles");

  await api(`/api/courses/${newCode}`, { method: "DELETE" });
});

test("tareas y exámenes", async () => {
  const { res: taskRes, body: task } = await api("/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Entrega test",
      due_date: "2030-06-01",
      course_code: "",
      priority: "high",
    }),
  });
  assert.equal(taskRes.status, 201);
  assert.equal(task.title, "Entrega test");

  const { res: examRes, body: exam } = await api("/api/exams", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      course_code: "TST",
      title: "Final",
      exam_date: "2030-07-15",
      exam_time: "09:00",
    }),
  });
  assert.equal(examRes.status, 201);

  const { body: stats } = await api("/api/stats/extended");
  assert.ok(stats.pendingTasks >= 1);
  assert.ok(stats.upcomingExams >= 1);

  await api(`/api/tasks/${task.id}`, { method: "DELETE" });
  await api(`/api/exams/${exam.id}`, { method: "DELETE" });
});

test("export ICS y validación de import", async () => {
  const { res: icsRes, body: icsText } = await api("/api/export/ics");
  assert.equal(icsRes.status, 200);
  assert.match(String(icsText), /BEGIN:VCALENDAR/);

  const { res: badImport } = await api("/api/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ courses: [{ name: "sin código" }] }),
  });
  assert.equal(badImport.status, 400);
});

test("backup crea archivo en respuesta", async () => {
  const { res, body } = await api("/api/backup", { method: "POST" });
  assert.equal(res.status, 200);
  assert.ok(body.path || body.filename || body.file);
});

test("listar y restaurar respaldos", async () => {
  await api("/api/backup", { method: "POST" });
  const { res, body: backups } = await api("/api/backups");
  assert.equal(res.status, 200);
  assert.ok(Array.isArray(backups));
  assert.ok(backups.length >= 1);

  const { res: importRes, body: importData } = await api("/api/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      courses: [{
        code: `${PREFIX}BK`,
        name: "Backup Test",
        schedules: [{ day: "Viernes", start_time: "14:00", end_time: "16:00" }],
      }],
    }),
  });
  assert.equal(importRes.status, 200);

  const file = backups[0].file;
  const { res: restoreRes, body: restored } = await api(
    `/api/backups/${encodeURIComponent(file)}/restore`,
    { method: "POST" }
  );
  assert.equal(restoreRes.status, 200);
  assert.ok(restored.imported >= 0);

  await cleanupCodes();
});

test("import bulk via API", async () => {
  await cleanupCodes();
  const { res, body } = await api("/api/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      courses: [
        { code: `${PREFIX}I1`, name: "Import One" },
        { code: `${PREFIX}I2`, name: "Import Two" },
      ],
    }),
  });
  assert.equal(res.status, 200);
  assert.equal(body.imported, 2);
  await cleanupCodes();
});
