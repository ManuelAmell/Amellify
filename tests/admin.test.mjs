import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

process.env.AMELLIFY_TEST_MODE = '1';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'amellify-admin-'));
const dbPath = path.join(tmpDir, 'admin-test.db');
process.env.AMELLIFY_DB_PATH = dbPath;
process.env.AMELLIFY_ADMIN_EMAIL = 'admin@test.amellify';
process.env.AMELLIFY_ADMIN_PASSWORD = 'admin';

const require = createRequire(import.meta.url);
const { startAmellifyServer } = require('../server.js');

const PORT = 31995;
let base;
let server;

before(async () => {
  const started = await startAmellifyServer({
    host: '127.0.0.1',
    port: PORT,
    displayHost: '127.0.0.1',
  });
  server = started.server;
  base = `http://127.0.0.1:${PORT}`;
});

after(() =>
  new Promise((resolve) => {
    server?.close(() => {
      if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
      resolve();
    });
  })
);

async function api(path, options = {}) {
  const res = await fetch(`${base}${path}`, options);
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { res, body };
}

function uniqueEmail() {
  return `admin-user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.amellify`;
}

async function adminLogin() {
  const { res, body } = await api('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: process.env.AMELLIFY_ADMIN_EMAIL,
      password: process.env.AMELLIFY_ADMIN_PASSWORD,
    }),
  });
  assert.equal(res.status, 200, `Login admin falló: ${JSON.stringify(body)}`);
  return body;
}

test('admin seed: login devuelve role admin y JWT incluye role', async () => {
  const { token, user } = await adminLogin();
  assert.equal(user.role, 'admin');
  assert.equal(user.email, process.env.AMELLIFY_ADMIN_EMAIL);

  const payloadPart = token.split('.')[1];
  const payload = JSON.parse(
    Buffer.from(payloadPart.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString()
  );
  assert.equal(payload.role, 'admin');
  assert.equal(payload.email, process.env.AMELLIFY_ADMIN_EMAIL);

  const { res, body } = await api('/api/auth/me', {
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(res.status, 200);
  assert.equal(body.user.role, 'admin');
});

test('seed sincroniza contraseña admin en desarrollo si el hash no coincide', async () => {
  const auth = require('../lib/auth.js');
  const dbLayer = require('../lib/db.js');
  const db = dbLayer.getDatabase();

  db.run('UPDATE users SET password_hash = ? WHERE email = ?', [
    '$2b$10$wronghashwronghashwronghashwronghashwrong',
    process.env.AMELLIFY_ADMIN_EMAIL,
  ]);
  dbLayer.saveDatabase();

  const { res: badRes } = await api('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: process.env.AMELLIFY_ADMIN_EMAIL,
      password: process.env.AMELLIFY_ADMIN_PASSWORD,
    }),
  });
  assert.equal(badRes.status, 401);

  auth.seedAdminUser(db, dbLayer.saveDatabase);
  await adminLogin();
});

test('admin puede listar y crear usuarios', async () => {
  const { token } = await adminLogin();
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  const { res: listRes, body: listBody } = await api('/api/admin/users', { headers });
  assert.equal(listRes.status, 200);
  assert.ok(Array.isArray(listBody.users));
  assert.ok(listBody.users.some((u) => u.role === 'admin'));
  for (const u of listBody.users) {
    assert.equal(u.password_hash, undefined);
    assert.ok(['admin', 'user'].includes(u.role));
  }

  const email = uniqueEmail();
  const { res: createRes, body: created } = await api('/api/admin/users', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      email,
      password: 'nuevoUsuario1',
      name: 'Creado por Admin',
      role: 'user',
    }),
  });
  assert.equal(createRes.status, 201);
  assert.equal(created.user.email, email);
  assert.equal(created.user.role, 'user');

  const { res: patchRes, body: patched } = await api(`/api/admin/users/${created.user.id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ name: 'Nombre Actualizado', password: 'otraClave99' }),
  });
  assert.equal(patchRes.status, 200);
  assert.equal(patched.user.name, 'Nombre Actualizado');

  const { res: loginRes } = await api('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'otraClave99' }),
  });
  assert.equal(loginRes.status, 200);

  const { res: delRes } = await api(`/api/admin/users/${created.user.id}`, {
    method: 'DELETE',
    headers,
  });
  assert.equal(delRes.status, 200);
});

test('usuario normal recibe 403 en rutas admin', async () => {
  const email = uniqueEmail();
  const { body: reg } = await api('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'usuarioNormal1', name: 'Normal' }),
  });
  assert.equal(reg.user.role, 'user');

  const userHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${reg.token}`,
  };

  const { res, body } = await api('/api/admin/users', { headers: userHeaders });
  assert.equal(res.status, 403);
  assert.match(body.error, /administrador/i);

  const { res: postRes } = await api('/api/admin/users', {
    method: 'POST',
    headers: userHeaders,
    body: JSON.stringify({
      email: uniqueEmail(),
      password: 'otroUsuario1',
      name: 'X',
    }),
  });
  assert.equal(postRes.status, 403);
});

test('admin no puede eliminarse a sí mismo', async () => {
  const { token, user } = await adminLogin();
  const { res, body } = await api(`/api/admin/users/${user.id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  assert.equal(res.status, 403);
  assert.match(body.error, /propia cuenta/i);
});

test('rutas admin sin token devuelven 401', async () => {
  const { res } = await api('/api/admin/users');
  assert.equal(res.status, 401);
});

test('validación al crear usuario con datos inválidos', async () => {
  const { token } = await adminLogin();
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  const { res: r1, body: b1 } = await api('/api/admin/users', {
    method: 'POST',
    headers,
    body: JSON.stringify({ email: 'mal', password: '123', name: 'X' }),
  });
  assert.equal(r1.status, 400);
  assert.match(b1.error, /correo|contraseña/i);

  const { res: r2, body: b2 } = await api('/api/admin/users', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      email: uniqueEmail(),
      password: 'validpass1',
      name: 'X',
      role: 'superuser',
    }),
  });
  assert.equal(r2.status, 400);
  assert.match(b2.error, /rol/i);
});
