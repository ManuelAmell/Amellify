/**
 * Prueba E2E con Puppeteer — flujo principal de Amellify
 * Ejecutar: node tests/e2e-puppeteer.mjs
 */
import puppeteer from 'puppeteer';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const E2E_PORT = Number(process.env.E2E_PORT || 30998);
const SCREENSHOT_DIR = path.join(__dirname, 'e2e-screenshots');
const PASSWORD = 'TestPuppeteer123!';
const ADMIN_EMAIL = 'admin@amellify.local';
const ADMIN_PASSWORD = 'admin';

let BASE_URL = process.env.E2E_BASE_URL || `http://127.0.0.1:${E2E_PORT}`;
let e2eServer = null;

// Estado global del run
const consoleErrors = [];
const networkErrors = [];
const socketEvents = [];
let stepIndex = 0;

function log(msg) {
  console.log(`[e2e] ${msg}`);
}

function fail(msg) {
  const err = new Error(msg);
  err.isE2E = true;
  throw err;
}

async function screenshot(page, label) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  const safe = label.replace(/[^a-z0-9_-]+/gi, '-').toLowerCase();
  const file = path.join(SCREENSHOT_DIR, `${String(stepIndex).padStart(2, '0')}-${safe}.png`);
  await page.screenshot({ path: file, fullPage: true });
  log(`Captura guardada: ${file}`);
  return file;
}

async function runStep(page, name, fn) {
  stepIndex += 1;
  log(`Paso ${stepIndex}: ${name}`);
  try {
    await fn();
    log(`  ✓ ${name}`);
  } catch (err) {
    await screenshot(page, `fail-${name}`);
    throw err;
  }
}

function attachListeners(page) {
  page.on('console', (msg) => {
    const text = msg.text();
    if (text.includes('WebSocket')) {
      socketEvents.push(text);
    }
    if (msg.type() === 'error') {
      // Ignorar ruido conocido de extensiones / SW en dev
      if (text.includes('Failed to load resource') && (
        text.includes('favicon') ||
        text.includes('ERR_NAME_NOT_RESOLVED') ||
        text.includes('ERR_FAILED')
      )) return;
      consoleErrors.push(text);
    }
  });

  page.on('pageerror', (err) => {
    consoleErrors.push(`PageError: ${err.message}`);
  });

  page.on('requestfailed', (req) => {
    networkErrors.push({ url: req.url(), failure: req.failure()?.errorText });
  });

  page.on('response', (res) => {
    const status = res.status();
    if (status === 401 || status >= 500) {
      networkErrors.push({ url: res.url(), status });
    }
  });
}

async function waitForAuthOrShell(page) {
  await page.waitForFunction(
    () => {
      const shell = document.getElementById('app-shell');
      const shellVisible = shell && !shell.hasAttribute('hidden');
      const auth = document.getElementById('auth-screen');
      const authVisible = auth && !auth.hasAttribute('hidden');
      return authVisible || shellVisible;
    },
    { timeout: 15000 }
  );
}

async function testAuthPanelUI(page) {
  const visible = await page.evaluate(() => {
    const auth = document.getElementById('auth-screen');
    return auth && !auth.hasAttribute('hidden');
  });
  if (!visible) return;

  await page.click('[data-view="register"]');
  await page.waitForSelector('#auth-reg-email', { visible: true });
  await page.click('[data-view="login"]');
  await page.waitForSelector('#auth-email', { visible: true });

  await page.type('#auth-password', 'test12345', { delay: 5 });
  await page.click('.auth-password-toggle');
  const inputType = await page.$eval('#auth-password', (el) => el.type);
  if (inputType !== 'text') fail('El toggle de contraseña no muestra el texto');

  await page.click('[data-view="forgot"]');
  await page.waitForSelector('#auth-forgot-email', { visible: true });
  await page.click('[data-view="login"]');
  await page.waitForSelector('#auth-email', { visible: true });
}

async function loginWithCredentials(page, email, password) {
  const authVisible = await page.evaluate(() => {
    const auth = document.getElementById('auth-screen');
    return auth && !auth.hasAttribute('hidden');
  });
  if (!authVisible) {
    page.once('dialog', (dialog) => dialog.accept());
    await page.evaluate(async () => {
      if (window.app?.authUI) await window.app.logout();
    });
    await page.waitForFunction(
      () => {
        const auth = document.getElementById('auth-screen');
        return auth && !auth.hasAttribute('hidden');
      },
      { timeout: 15000 }
    );
  }

  await page.click('[data-view="login"]');
  await page.waitForSelector('#auth-email', { visible: true });
  await page.evaluate(() => {
    const email = document.getElementById('auth-email');
    const pw = document.getElementById('auth-password');
    if (email) email.value = '';
    if (pw) pw.value = '';
  });
  await page.type('#auth-email', email, { delay: 10 });
  await page.type('#auth-password', password, { delay: 10 });
  await Promise.all([
    page.waitForResponse(
      (res) => res.url().includes('/auth/login') && res.request().method() === 'POST',
      { timeout: 10000 }
    ),
    page.click('.auth-submit'),
  ]);
  await page.waitForFunction(
    () => {
      const auth = document.getElementById('auth-screen');
      const shell = document.getElementById('app-shell');
      const authHidden = !auth || auth.hasAttribute('hidden');
      return authHidden && shell && !shell.hasAttribute('hidden');
    },
    { timeout: 15000 }
  );
}

async function getConnectionDiagnostics(page) {
  return page.evaluate(async () => {
    const app = window.app;
    let health = null;
    let courses = null;
    try {
      const hr = await fetch('/api/health', { cache: 'no-store' });
      health = { ok: hr.ok, body: hr.ok ? await hr.json() : null };
    } catch (err) {
      health = { error: err.message };
    }
    const token =
      localStorage.getItem('amellify-auth-token') ||
      sessionStorage.getItem('amellify-auth-token-session');
    try {
      const cr = await fetch('/api/courses', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      courses = { status: cr.status, ok: cr.ok };
    } catch (err) {
      courses = { error: err.message };
    }
    const el = document.getElementById('connection-status');
    return {
      label: el?.querySelector('.connection-label')?.textContent,
      className: el?.className,
      apiReachable: app?._apiReachable,
      wsConnected: app?._wsConnected,
      initialLoadDone: app?._initialLoadDone,
      socketConnected: app?.socket?.connected ?? null,
      socketId: app?.socket?.id ?? null,
      health,
      courses,
    };
  });
}

async function waitForConnectionOnline(page, timeoutMs = 15000) {
  const start = Date.now();
  let lastDiag = null;
  let screenshotPath = null;

  while (Date.now() - start < timeoutMs) {
    lastDiag = await getConnectionDiagnostics(page);
    const label = lastDiag.label || '';
    if (label === 'En línea') return lastDiag;
    if (label === 'Sin conexión' && lastDiag.initialLoadDone) {
      break;
    }
    await new Promise((r) => setTimeout(r, 300));
  }

  if (lastDiag?.label === 'Conectando' || lastDiag?.className?.includes('is-reconnecting')) {
    screenshotPath = await screenshot(page, 'stuck-conectando');
    log('Diagnóstico pill atascado en Conectando:');
    log(JSON.stringify(lastDiag, null, 2));
    fail(
      `Pill de conexión atascado en "${lastDiag?.label}" tras ${timeoutMs}ms` +
        (screenshotPath ? ` — captura: ${screenshotPath}` : '')
    );
  }

  if (lastDiag?.label !== 'En línea') {
    screenshotPath = await screenshot(page, 'fail-conexion');
    log('Diagnóstico de conexión:');
    log(JSON.stringify(lastDiag, null, 2));
    fail(`Estado de conexión inesperado: "${lastDiag?.label}"`);
  }

  return lastDiag;
}

async function tryAdminLogin(page, fallbackEmail, fallbackPassword) {
  try {
    await loginWithCredentials(page, ADMIN_EMAIL, ADMIN_PASSWORD);
    return true;
  } catch {
    log('Login admin no disponible — omitiendo panel de usuarios');
    await page.evaluate(async () => {
      if (window.app?.authUI) await window.app.authUI.logout();
    });
    await page.waitForFunction(
      () => {
        const auth = document.getElementById('auth-screen');
        return auth && !auth.hasAttribute('hidden');
      },
      { timeout: 10000 }
    );
    await loginWithCredentials(page, fallbackEmail, fallbackPassword);
    return false;
  }
}

async function registerOrLogin(page, email) {
  const authVisible = await page.evaluate(() => {
    const auth = document.getElementById('auth-screen');
    return auth && !auth.hasAttribute('hidden');
  });
  if (!authVisible) return;

  // Intentar registro
  await page.click('[data-view="register"]');
  await page.waitForSelector('#auth-form input[name="email"]', { visible: true });

  await page.type('input[name="name"]', 'Puppeteer E2E', { delay: 10 });
  await page.type('input[name="email"]', email, { delay: 10 });
  await page.type('input[name="password"]', PASSWORD, { delay: 10 });

  await Promise.all([
    page.waitForResponse(
      (res) => res.url().includes('/auth/register') && res.request().method() === 'POST',
      { timeout: 10000 }
    ).catch(() => null),
    page.click('.auth-submit'),
  ]);

  // Esperar shell o toast de error (email duplicado)
  await new Promise((r) => setTimeout(r, 800));

  const stillAuth = await page.evaluate(() => {
    const auth = document.getElementById('auth-screen');
    return auth && !auth.hasAttribute('hidden');
  });
  if (stillAuth) {
    log('Registro falló o duplicado — intentando login');
    await page.click('[data-view="login"]');
    await page.waitForSelector('#auth-form input[name="email"]', { visible: true });
    await page.type('input[name="email"]', email, { delay: 10 });
    await page.type('input[name="password"]', PASSWORD, { delay: 10 });
    await Promise.all([
      page.waitForResponse(
        (res) => res.url().includes('/auth/login') && res.request().method() === 'POST',
        { timeout: 10000 }
      ),
      page.click('.auth-submit'),
    ]);
  }

  await page.waitForFunction(
    () => {
      const auth = document.getElementById('auth-screen');
      const shell = document.getElementById('app-shell');
      const authHidden = !auth || auth.hasAttribute('hidden');
      return authHidden && shell && !shell.hasAttribute('hidden');
    },
    { timeout: 15000 }
  );
}

async function testForgotPasswordFlow(page, email) {
  const visible = await page.evaluate(() => {
    const auth = document.getElementById('auth-screen');
    return auth && !auth.hasAttribute('hidden');
  });
  if (!visible) return;

  await page.click('[data-view="forgot"]');
  await page.waitForSelector('#auth-forgot-email', { visible: true });
  await page.type('#auth-forgot-email', email, { delay: 10 });

  await Promise.all([
    page.waitForResponse(
      (res) => res.url().includes('/auth/forgot-password') && res.request().method() === 'POST',
      { timeout: 10000 }
    ),
    page.click('.auth-submit'),
  ]);

  await page.waitForSelector('.auth-dev-link', { visible: true, timeout: 8000 });
  const resetUrl = await page.$eval('.auth-dev-link-url', (el) => el.href);
  if (!resetUrl.includes('token=') || !resetUrl.includes('reset-password')) {
    fail(`Enlace de recuperación inesperado: ${resetUrl}`);
  }

  await page.goto(resetUrl, { waitUntil: 'networkidle2' });
  await page.waitForSelector('#auth-password', { visible: true });

  const newPassword = 'ResetE2E123!';
  await page.type('#auth-password', newPassword, { delay: 10 });
  await page.type('#auth-password2', newPassword, { delay: 10 });
  await Promise.all([
    page.waitForResponse(
      (res) => res.url().includes('/auth/reset-password') && res.request().method() === 'POST',
      { timeout: 10000 }
    ),
    page.click('.auth-submit'),
  ]);

  await page.waitForSelector('#auth-email', { visible: true });
  await page.type('#auth-email', email, { delay: 10 });
  await page.type('#auth-password', newPassword, { delay: 10 });
  await Promise.all([
    page.waitForResponse(
      (res) => res.url().includes('/auth/login') && res.request().method() === 'POST',
      { timeout: 10000 }
    ),
    page.click('.auth-submit'),
  ]);

  await page.waitForFunction(
    () => {
      const auth = document.getElementById('auth-screen');
      const shell = document.getElementById('app-shell');
      const authHidden = !auth || auth.hasAttribute('hidden');
      return authHidden && shell && !shell.hasAttribute('hidden');
    },
    { timeout: 15000 }
  );
}

async function main() {
  log(`Base URL: ${BASE_URL}`);

  if (!process.env.E2E_BASE_URL) {
    process.env.AMELLIFY_TEST_MODE = '1';
    process.env.AMELLIFY_DB_PATH = path.join(__dirname, `e2e-${Date.now()}.db`);
    const { startAmellifyServer } = require('../server.js');
    const started = await startAmellifyServer({
      host: '127.0.0.1',
      port: E2E_PORT,
      displayHost: '127.0.0.1',
    });
    e2eServer = started.server;
    BASE_URL = `http://127.0.0.1:${E2E_PORT}`;
    log(`Servidor E2E en ${BASE_URL}`);
  }

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  const page = await browser.newPage();
  page.setDefaultTimeout(15000);
  await page.evaluateOnNewDocument(() => {
    navigator.serviceWorker.register = async () => ({ scope: '/', updateViaCache: 'none' });
  });
  attachListeners(page);

  const email = `test+puppeteer+${Date.now()}@local.test`;

  try {
    await runStep(page, 'cargar-inicio', async () => {
      const res = await page.goto(BASE_URL, { waitUntil: 'networkidle2' });
      if (!res || !res.ok()) fail(`HTTP ${res?.status()} al cargar ${BASE_URL}`);
      await waitForAuthOrShell(page);
      const hasAuth = await page.$('#auth-screen');
      if (!hasAuth) {
        const shellHidden = await page.evaluate(
          () => document.getElementById('app-shell')?.hasAttribute('hidden') ?? true
        );
        if (shellHidden) fail('Ni auth-screen ni app-shell visible');
      }
    });

    await runStep(page, 'panel-auth-ui', async () => {
      await testAuthPanelUI(page);
    });

    await runStep(page, 'autenticacion', async () => {
      await registerOrLogin(page, email);
    });

    await runStep(page, 'pill-conexion', async () => {
      const diag = await waitForConnectionOnline(page);
      log(`Pill: ${diag.label} | API: ${diag.apiReachable} | WS: ${diag.wsConnected} | health: ${JSON.stringify(diag.health)}`);
      if (diag.courses?.ok && !diag.apiReachable && !diag.wsConnected) {
        fail('API /courses responde pero el pill no refleja conexión');
      }
    });

    await runStep(page, 'recuperar-contrasena', async () => {
      await page.evaluate(async () => {
        if (window.app?.authUI) {
          await window.app.authUI.logout();
        }
      });
      await page.waitForFunction(
        () => {
          const auth = document.getElementById('auth-screen');
          return auth && !auth.hasAttribute('hidden');
        },
        { timeout: 10000 }
      );
      await testForgotPasswordFlow(page, email);
    });

    await runStep(page, 'app-shell', async () => {
      const header = await page.$('header.header');
      const tabs = await page.$$('.view-tab');
      if (!header) fail('Header no visible');
      if (tabs.length < 3) fail(`Pocas pestañas de vista: ${tabs.length}`);
    });

    await runStep(page, 'calculadora', async () => {
      // Cerrar overlay de empty-state si bloquea la UI
      await page.evaluate(() => {
        document.getElementById('empty-state-overlay')?.remove();
        document.getElementById('empty-state-backdrop')?.remove();
        window.app?.switchView('calc');
      });
      await page.waitForSelector('#calc-sticky-bar', { visible: true });
      await page.waitForSelector('.grade-calc-summary', { visible: true });

      const stickyOk = await page.evaluate(() => {
        const bar = document.getElementById('calc-sticky-bar');
        if (!bar) return false;
        const style = getComputedStyle(bar);
        return style.position === 'sticky' || bar.classList.contains('grade-calc-sticky-bar');
      });
      if (!stickyOk) fail('Barra sticky de calculadora no encontrada');

      const title = await page.$eval('.grade-calc-header h2', (el) => el.textContent);
      if (!title.includes('Calculadora')) fail(`Título inesperado: ${title}`);
    });

    await runStep(page, 'menu-datos', async () => {
      // Cerrar onboarding si aparece en cuentas nuevas
      await page.evaluate(() => {
        localStorage.setItem('amellify-onboarding-done', '1');
        document.getElementById('onboarding-modal')?.classList.remove('active');
        window.app?.showDataMenu?.('apariencia');
      });
      await page.waitForSelector('#data-menu', { visible: true });
      const menuText = await page.$eval('#data-menu', (el) => el.textContent);
      if (!menuText.includes('Configuración')) fail('Menú de datos sin configuración');
      if (!menuText.includes('Apariencia')) fail('Menú de datos sin sección Apariencia');
      await page.evaluate(() => document.getElementById('settings-modal')?.remove());
    });

    await runStep(page, 'admin-usuarios', async () => {
      const resetPassword = 'ResetE2E123!';
      const adminOk = await tryAdminLogin(page, email, resetPassword);
      if (!adminOk) {
        log('Panel admin omitido (credenciales seed no disponibles en este entorno)');
        return;
      }

      const hasAdminBadge = await page.evaluate(() => {
        const badge = document.getElementById('auth-user-badge');
        return badge?.textContent?.includes('Admin') ?? false;
      });
      if (!hasAdminBadge) fail('Badge de administrador no visible tras login');

      await page.evaluate(() => {
        document.getElementById('settings-modal')?.remove();
        window.app?.showDataMenu?.('cuenta');
      });
      await page.waitForSelector('#data-menu', { visible: true });

      const usuariosTab = await page.$('[data-settings-tab="usuarios"]');
      if (!usuariosTab) fail('Pestaña Usuarios no visible para admin');

      await page.click('[data-settings-tab="usuarios"]');
      await page.waitForSelector('.admin-users-table, .admin-users-loading', { visible: true, timeout: 10000 });
      await page.waitForSelector('.admin-users-table', { visible: true, timeout: 10000 });

      const panelText = await page.$eval('#settings-content', (el) => el.textContent);
      if (!panelText.includes('Usuarios del sistema')) fail('Panel de usuarios no cargado');
      if (!panelText.includes(ADMIN_EMAIL)) fail('Lista de usuarios sin admin seed');

      await page.evaluate(() => document.getElementById('settings-modal')?.remove());
    });

    log('\n=== Resumen E2E ===');
    log(`Email usado: ${email}`);
    log(`Eventos WebSocket en consola: ${socketEvents.length}`);
    socketEvents.forEach((e) => log(`  [socket] ${e}`));
    log(`Errores de consola: ${consoleErrors.length}`);
    if (consoleErrors.length) {
      consoleErrors.forEach((e) => log(`  [console] ${e}`));
      fail(`Se detectaron ${consoleErrors.length} error(es) en consola`);
    }

    log(`Respuestas 401/5xx: ${networkErrors.length}`);
    if (networkErrors.length) {
      networkErrors.forEach((e) => log(`  [network] ${e.status ?? e.failure} ${e.url}`));
      const bad = networkErrors.filter(
        (e) =>
          e.status &&
          !(e.status === 401 && e.url.includes('/auth/me')) &&
          !e.url.includes('fonts.googleapis.com')
      );
      if (bad.length) fail(`${bad.length} respuesta(s) 401/5xx inesperada(s)`);
    }

    log('\n✅ Todos los pasos E2E pasaron');
    await browser.close();
    if (e2eServer) {
      await new Promise((resolve) => e2eServer.close(() => resolve()));
      try {
        fs.unlinkSync(process.env.AMELLIFY_DB_PATH);
      } catch {
        /* ignore */
      }
    }
    process.exit(0);
  } catch (err) {
    log(`\n❌ E2E falló: ${err.message}`);
    if (consoleErrors.length) {
      log('Errores de consola capturados:');
      consoleErrors.forEach((e) => log(`  ${e}`));
    }
    if (networkErrors.length) {
      log('Peticiones fallidas capturadas:');
      networkErrors.forEach((e) => log(`  ${e.failure || e.status} ${e.url}`));
    }
    await browser.close();
    if (e2eServer) {
      await new Promise((resolve) => e2eServer.close(() => resolve()));
    }
    process.exit(1);
  }
}

main();
