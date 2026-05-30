import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

process.env.AMELLIFY_TEST_MODE = '1';

const require = createRequire(import.meta.url);
const { startAmellifyServer } = require('../server.js');

const PORT = 31996;
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
    server?.close(() => resolve());
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
  return `auth-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.amellify`;
}

test('registro e inicio de sesión', async () => {
  const email = uniqueEmail();
  const password = 'secreto123';

  let { res, body } = await api('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name: 'Usuario Test' }),
  });
  assert.equal(res.status, 201);
  assert.ok(body.token);
  assert.equal(body.user.email, email);

  ({ res, body } = await api('/api/auth/me', {
    headers: { Authorization: `Bearer ${body.token}` },
  }));
  assert.equal(res.status, 200);
  assert.equal(body.user.email, email);

  ({ res, body } = await api('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'secreto123' }),
  }));
  assert.equal(res.status, 200);
  assert.ok(body.token);
});

test('rechaza contraseña corta y correo inválido', async () => {
  const { res: r1 } = await api('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'bad', password: '123', name: 'X' }),
  });
  assert.equal(r1.status, 400);

  const { res: r2 } = await api('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: uniqueEmail(), password: 'wrongpass' }),
  });
  assert.equal(r2.status, 401);
});

test('API protegida sin token devuelve 401', async () => {
  const { res } = await api('/api/courses');
  assert.equal(res.status, 401);
});

test('flujo olvidé contraseña y restablecer', async () => {
  const email = uniqueEmail();
  const password = 'original99';

  const { body: reg } = await api('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name: 'Reset Test' }),
  });

  const { res: forgotRes, body: forgot } = await api('/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  assert.equal(forgotRes.status, 200);
  assert.match(forgot.message, /correo/i);
  assert.ok(forgot.devResetToken);

  const { res: resetRes } = await api('/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: forgot.devResetToken, newPassword: 'nuevaClave99' }),
  });
  assert.equal(resetRes.status, 200);

  const { res: oldLogin } = await api('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(oldLogin.status, 401);

  const { res: newLogin, body: login } = await api('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'nuevaClave99' }),
  });
  assert.equal(newLogin.status, 200);
  assert.ok(login.token);

  const { res: meRes } = await api('/api/auth/me', {
    headers: { Authorization: `Bearer ${login.token}` },
  });
  assert.equal(meRes.status, 200);

  void reg;
});

test('forgot-password mensaje genérico para correo inexistente', async () => {
  const { res, body } = await api('/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: uniqueEmail() }),
  });
  assert.equal(res.status, 200);
  assert.match(body.message, /correo/i);
  assert.equal(body.devResetToken, undefined);
});

test('reset-password rechaza token inválido', async () => {
  const { res, body } = await api('/api/auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: 'token-invalido', newPassword: 'nuevaClave99' }),
  });
  assert.equal(res.status, 400);
  assert.match(body.error, /inválido|expirado/i);
});

test('forgot-password incluye enlace dev en modo test', async () => {
  const email = uniqueEmail();
  await api('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'registro123', name: 'Dev Link' }),
  });

  const { body } = await api('/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  assert.ok(body.devResetToken);
  assert.match(body.devResetPath, /\?token=.+#reset-password/);
});

test('PATCH perfil y cambio de contraseña', async () => {
  const email = uniqueEmail();
  const password = 'perfil1234';

  const { body: reg } = await api('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name: 'Antes' }),
  });

  let { res, body } = await api('/api/auth/me', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${reg.token}`,
    },
    body: JSON.stringify({ name: 'Después' }),
  });
  assert.equal(res.status, 200);
  assert.equal(body.user.name, 'Después');

  ({ res, body } = await api('/api/auth/change-password', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${reg.token}`,
    },
    body: JSON.stringify({ currentPassword: password, newPassword: 'nuevaPerfil99' }),
  }));
  assert.equal(res.status, 200);

  const { res: loginRes } = await api('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'nuevaPerfil99' }),
  });
  assert.equal(loginRes.status, 200);
});

test('datos aislados por usuario', async () => {
  const emailA = uniqueEmail();
  const emailB = uniqueEmail();

  const { body: userA } = await api('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: emailA, password: 'usuarioA123', name: 'A' }),
  });
  const { body: userB } = await api('/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: emailB, password: 'usuarioB123', name: 'B' }),
  });

  const code = `ISO${Date.now().toString().slice(-6)}`;

  await api('/api/courses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${userA.token}`,
    },
    body: JSON.stringify({ code, name: 'Solo A' }),
  });

  const { body: coursesB } = await api('/api/courses', {
    headers: { Authorization: `Bearer ${userB.token}` },
  });
  assert.ok(!coursesB.some((c) => c.code === code));

  const { body: coursesA } = await api('/api/courses', {
    headers: { Authorization: `Bearer ${userA.token}` },
  });
  assert.ok(coursesA.some((c) => c.code === code));

  await api(`/api/courses/${code}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${userA.token}` },
  });
});

test('rate limit en rutas de auth', async () => {
  const email = uniqueEmail();
  let lastStatus = 200;
  for (let i = 0; i < 25; i += 1) {
    const { res } = await api('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'wrongpass123' }),
    });
    lastStatus = res.status;
    if (res.status === 429) break;
  }
  assert.equal(lastStatus, 429);
});
