import { test } from "node:test";
import assert from "node:assert/strict";

test("ClassNotificationManager respeta minutos configurados", async () => {
  const { ClassNotificationManager } = await import("../src/js/notifications.js");

  const app = {
    settings: { notifications: true, notifyMinutesBefore: 30 },
  };
  const mgr = new ClassNotificationManager(app);
  const s = mgr.getSettings();
  assert.equal(s.enabled, true);
  assert.equal(s.minutesBefore, 30);
});

test("ClassNotificationManager desactiva si notifications es false", async () => {
  const { ClassNotificationManager } = await import("../src/js/notifications.js");

  const app = { settings: { notifications: false } };
  const mgr = new ClassNotificationManager(app);
  assert.equal(mgr.getSettings().enabled, false);
});

test("ClassNotificationManager desactiva tareas si taskNotifications es false", async () => {
  const { ClassNotificationManager } = await import("../src/js/notifications.js");

  const app = { settings: { notifications: true, taskNotifications: false } };
  const mgr = new ClassNotificationManager(app);
  assert.equal(mgr.getSettings().tasksEnabled, false);
});

test("formatTime respeta 24h y 12h", async () => {
  const { formatTime } = await import("../src/js/utils.js");
  assert.equal(formatTime("14:30", true), "14:30");
  assert.equal(formatTime("14:30", false), "2:30 p.m.");
  assert.equal(formatTime("09:05", false), "9:05 a.m.");
});

test("evaluatePartials usa umbral personalizado", async () => {
  const { evaluatePartials } = await import("../src/js/utils.js");
  const partials = [
    { name: "P1", grade: 3, percent: 50 },
    { name: "P2", grade: 3, percent: 50 },
  ];
  assert.equal(evaluatePartials(partials, 3.5).passed, false);
  assert.equal(evaluatePartials(partials, 2.5).passed, true);
});
