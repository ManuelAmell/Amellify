const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const http = require('http');
const { Server } = require('socket.io');
const { generateIcsFromCourses } = require('./lib/ics-server');
const { generateCalendarIcs } = require('./lib/ics-calendar');
const academic = require('./lib/academic-db');
const dbLayer = require('./lib/db');
const { validateImportPayload, importSizeGuard } = require('./lib/import-validator');
const { securityHeaders, apiRateLimit } = require('./lib/security');
const auth = require('./lib/auth');
const icsFeed = require('./lib/ics-feed');
const icsImport = require('./lib/ics-import');
const pushSubs = require('./lib/push-subscriptions');
const googleCal = require('./lib/google-calendar');
const exportFull = require('./lib/export-full');

const BACKUPS_DIR = path.join(__dirname, 'backups');
const SOCKET_CLIENT = path.join(
  __dirname,
  'node_modules',
  'socket.io',
  'client-dist',
  'socket.io.min.js'
);

let db = null;
let io = null;

async function initDB() {
  await dbLayer.initDatabase({
    dbPath: process.env.AMELLIFY_DB_PATH || path.join(__dirname, 'amellify.db'),
  });
  db = dbLayer.getDatabase();
}

function saveDB() {
  dbLayer.saveDatabase();
}

function userBackupsDir(userId) {
  const dir = path.join(BACKUPS_DIR, `user-${userId}`);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const getCourses = (userId) => dbLayer.getCourses(userId);
const getCourseByCode = (userId, code) => dbLayer.getCourseByCode(userId, code);
const createCourse = (userId, body) => dbLayer.createCourse(userId, body);
const updateCourse = (userId, oldCode, body) => dbLayer.updateCourse(userId, oldCode, body);
const deleteCourse = (userId, code) => dbLayer.deleteCourse(userId, code);
const getStats = (userId) => dbLayer.getStats(userId);
const insertSchedules = (userId, code, schedules) =>
  dbLayer.insertSchedules(userId, code, schedules);

function pruneBackups(dir) {
  if (!fs.existsSync(dir)) return;
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .reverse();
  for (const old of files.slice(10)) {
    fs.unlinkSync(path.join(dir, old));
  }
}

function createExpressApp() {
  const app = express();

  function broadcastCourses(userId) {
    if (io) io.to(`user:${userId}`).emit('courses:update', getCourses(userId));
  }

  function broadcastStats(userId) {
    if (io) io.to(`user:${userId}`).emit('stats:update', getStats(userId));
  }

  app.use(securityHeaders);
  app.use(cors());
  app.use(express.json({ limit: '2mb' }));
  app.use('/api/auth', auth.createAuthRouter(db, saveDB));
  app.use('/api/admin', auth.createAdminRouter(db, saveDB));

  app.get('/api/health', (_req, res) => res.json({ ok: true }));

  app.get('/api/calendar/feed/:token', (req, res) => {
    const userId = icsFeed.resolveUserIdByToken(db, req.params.token);
    if (!userId) return res.status(404).send('Enlace no válido o revocado');
    const ics = icsFeed.buildFeedIcs(
      db,
      userId,
      getCourses,
      (uid) => academic.getTasks(db, uid),
      (uid) => academic.getExams(db, uid)
    );
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(ics);
  });

  app.use('/api', (req, res, next) => {
    if (
      req.path.startsWith('/auth') ||
      req.path.startsWith('/admin') ||
      req.path.startsWith('/calendar/feed') ||
      req.path === '/health' ||
      req.path.startsWith('/push/vapid-public') ||
      req.path.startsWith('/integrations/google/callback')
    ) {
      return next();
    }
    return auth.requireAuth(db)(req, res, next);
  });
  app.use('/api', apiRateLimit);
  app.use(express.static(path.join(__dirname)));

  if (!fs.existsSync(BACKUPS_DIR)) fs.mkdirSync(BACKUPS_DIR, { recursive: true });

  if (fs.existsSync(SOCKET_CLIENT)) {
    app.get('/vendor/socket.io.min.js', (_req, res) => {
      res.sendFile(SOCKET_CLIENT);
    });
  }

  app.get('/api/courses', (req, res) => res.json(getCourses(req.userId)));

  app.get('/api/courses/:code', (req, res) => {
    const course = getCourseByCode(req.userId, req.params.code);
    if (!course) return res.status(404).json({ error: 'Materia no encontrada' });
    res.json(course);
  });

  app.post('/api/courses', (req, res) => {
    try {
      const course = createCourse(req.userId, req.body);
      broadcastCourses(req.userId);
      broadcastStats(req.userId);
      res.status(201).json(course);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put('/api/courses/:code', (req, res) => {
    try {
      const course = updateCourse(req.userId, req.params.code, req.body);
      broadcastCourses(req.userId);
      broadcastStats(req.userId);
      res.json(course);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete('/api/courses/:code', (req, res) => {
    try {
      deleteCourse(req.userId, req.params.code);
      broadcastCourses(req.userId);
      broadcastStats(req.userId);
      res.json({ success: true, deleted: req.params.code });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/stats', (req, res) => res.json(getStats(req.userId)));

  app.get('/api/stats/extended', (req, res) => {
    const uid = req.userId;
    res.json(
      academic.getExtendedStats(db, uid, () => getCourses(uid), () => getStats(uid))
    );
  });

  app.get('/api/export/ics', (req, res) => {
    const uid = req.userId;
    const ics = generateCalendarIcs(getCourses(uid), {
      tasks: academic.getTasks(db, uid),
      exams: academic.getExams(db, uid),
    });
    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="amellify.ics"');
    res.send(ics);
  });

  app.get('/api/export/full', (req, res) => {
    const payload = exportFull.buildFullExport(
      db,
      req.userId,
      getCourses,
      (uid) => academic.getTasks(db, uid),
      (uid) => academic.getExams(db, uid),
      () => ['settings', 'last_auto_backup', 'auto_backup_days']
    );
    res.setHeader('Content-Disposition', 'attachment; filename="amellify-export.json"');
    res.json(payload);
  });

  app.get('/api/integrations/ics-feed', (req, res) => {
    icsFeed.ensureIcsFeedSchema(db);
    const stmt = db.prepare(
      'SELECT created_at FROM ics_feed_tokens WHERE user_id = ?'
    );
    stmt.bind([req.userId]);
    const active = stmt.step();
    const createdAt = active ? stmt.getAsObject().created_at : null;
    stmt.free();
    const origin = `${req.protocol}://${req.get('host')}`;
    res.json({
      active,
      createdAt,
      subscribePath: active ? '/api/calendar/feed/<token>' : null,
      hint: 'Genera o rota el token para obtener la URL completa',
      origin,
    });
  });

  app.post('/api/integrations/ics-feed', (req, res) => {
    const rotate = req.body?.rotate === true;
    let token;
    if (rotate) {
      token = icsFeed.rotateFeedToken(db, req.userId);
    } else {
      const result = icsFeed.getOrCreateFeedToken(db, req.userId);
      token = result.token;
      if (!token) {
        token = icsFeed.rotateFeedToken(db, req.userId);
      }
    }
    saveDB();
    const origin = `${req.protocol}://${req.get('host')}`;
    const url = `${origin}/api/calendar/feed/${token}`;
    res.json({ url, token, active: true });
  });

  app.delete('/api/integrations/ics-feed', (req, res) => {
    icsFeed.revokeFeedToken(db, req.userId);
    saveDB();
    res.json({ success: true, active: false });
  });

  app.post('/api/import/ics-url', async (req, res) => {
    try {
      const url = (req.body?.url || '').trim();
      if (!url) return res.status(400).json({ error: 'URL requerida' });
      const text = await icsImport.fetchIcsFromUrl(url);
      const events = icsImport.parseIcsEvents(text);
      const preview = icsImport.eventsToImportPreview(events);
      res.json({ preview, events: events.length });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/import/ics-url/confirm', (req, res) => {
    try {
      const { courses = [], exams = [] } = req.body || {};
      const uid = req.userId;
      let imported = 0;
      let skipped = 0;
      for (const c of courses) {
        try {
          createCourse(uid, c);
          imported++;
        } catch {
          skipped++;
        }
      }
      let examsAdded = 0;
      for (const e of exams) {
        try {
          academic.createExam(db, uid, e);
          examsAdded++;
        } catch {
          /* skip */
        }
      }
      saveDB();
      broadcastCourses(uid);
      res.json({ success: true, imported, skipped, examsAdded });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/push/vapid-public', (_req, res) => {
    res.json({
      publicKey: pushSubs.getVapidPublicKey(),
      configured: pushSubs.isPushConfigured(),
    });
  });

  app.post('/api/push/subscribe', (req, res) => {
    const sub = req.body?.subscription || req.body;
    if (!sub?.endpoint) return res.status(400).json({ error: 'Suscripción inválida' });
    pushSubs.saveSubscription(db, req.userId, sub);
    saveDB();
    res.json({ success: true });
  });

  app.delete('/api/push/subscribe', (req, res) => {
    const endpoint = req.body?.endpoint;
    if (endpoint) pushSubs.deleteSubscription(db, req.userId, endpoint);
    saveDB();
    res.json({ success: true });
  });

  app.get('/api/integrations/google/status', (req, res) => {
    res.json({
      configured: googleCal.isGoogleConfigured(),
      connected: !!googleCal.getGoogleIntegration(db, req.userId),
      icsAlternative: true,
    });
  });

  app.get('/api/integrations/google/auth', (req, res) => {
    if (!googleCal.isGoogleConfigured()) {
      return res.status(503).json({
        error: 'Google Calendar no configurado. Usa el enlace ICS en Datos.',
      });
    }
    const state = googleCal.createOAuthState(req.userId);
    const url = googleCal.getGoogleAuthUrl(state);
    res.json({ url });
  });

  app.get('/api/integrations/google/callback', async (req, res) => {
    try {
      if (!googleCal.isGoogleConfigured()) {
        return res.redirect('/?google=not_configured');
      }
      const userId = googleCal.verifyOAuthState(req.query.state);
      if (!userId) return res.redirect('/?google=invalid_state');
      const tokens = await googleCal.exchangeCodeForTokens(req.query.code);
      const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();
      googleCal.saveGoogleTokens(db, userId, {
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        expires_at: expiresAt,
      });
      saveDB();
      res.redirect('/?google=connected');
    } catch {
      res.redirect('/?google=error');
    }
  });

  app.delete('/api/integrations/google', (req, res) => {
    googleCal.deleteGoogleIntegration(db, req.userId);
    saveDB();
    res.json({ success: true });
  });

  app.post('/api/backup/auto', (req, res) => {
    try {
      const uid = req.userId;
      const days = Number(req.body?.intervalDays) || 7;
      if (!exportFull.shouldAutoBackup(db, uid, days)) {
        return res.json({ created: false, reason: 'not_due' });
      }
      const dir = userBackupsDir(uid);
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const file = path.join(dir, `backup-auto-${stamp}.json`);
      const payload = exportFull.buildFullExport(
        db,
        uid,
        getCourses,
        (id) => academic.getTasks(db, id),
        (id) => academic.getExams(db, id),
        () => []
      );
      fs.writeFileSync(file, JSON.stringify(payload, null, 2));
      exportFull.markAutoBackup(db, uid, saveDB);
      pruneBackups(dir);
      res.json({ created: true, file: path.basename(file) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/backup', (req, res) => {
    try {
      const dir = userBackupsDir(req.userId);
      const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const file = path.join(dir, `backup-${stamp}.json`);
      fs.writeFileSync(file, JSON.stringify(getCourses(req.userId), null, 2));
      pruneBackups(dir);
      res.json({ success: true, file: path.basename(file) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get('/api/backups', (req, res) => {
    try {
      const dir = userBackupsDir(req.userId);
      if (!fs.existsSync(dir)) {
        return res.json([]);
      }
      const files = fs
        .readdirSync(dir)
        .filter((f) => f.endsWith('.json') && f.startsWith('backup-'))
        .sort()
        .reverse()
        .map((f) => {
          const stat = fs.statSync(path.join(dir, f));
          return { file: f, size: stat.size, createdAt: stat.mtime.toISOString() };
        });
      res.json(files);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post('/api/backups/:file/restore', (req, res) => {
    try {
      const file = path.basename(req.params.file);
      if (!/^backup-[\dT-]+\.json$/.test(file)) {
        return res.status(400).json({ error: 'Nombre de respaldo inválido' });
      }
      const dir = userBackupsDir(req.userId);
      const fullPath = path.join(dir, file);
      if (!fs.existsSync(fullPath)) {
        return res.status(404).json({ error: 'Respaldo no encontrado' });
      }
      const raw = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
      const validation = validateImportPayload(raw);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.errors.join('; ') });
      }
      const uid = req.userId;
      db.run(
        'DELETE FROM schedules WHERE course_code IN (SELECT code FROM courses WHERE user_id = ?)',
        [uid]
      );
      db.run('DELETE FROM courses WHERE user_id = ?', [uid]);
      let imported = 0;
      let skipped = 0;
      for (const c of validation.courses) {
        try {
          createCourse(uid, c);
          imported++;
        } catch (_e) {
          skipped++;
        }
      }
      broadcastCourses(uid);
      broadcastStats(uid);
      res.json({ success: true, imported, skipped, file });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/courses/:code/duplicate', (req, res) => {
    try {
      const uid = req.userId;
      const course = academic.duplicateCourse(
        db,
        () => getCourses(uid),
        (body) => createCourse(uid, body),
        req.params.code
      );
      broadcastCourses(uid);
      broadcastStats(uid);
      res.status(201).json(course);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('/api/tasks', (req, res) => res.json(academic.getTasks(db, req.userId)));
  app.post('/api/tasks', (req, res) => {
    try {
      res.status(201).json(academic.createTask(db, req.userId, req.body));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });
  app.put('/api/tasks/:id', (req, res) => {
    try {
      res.json(academic.updateTask(db, req.userId, Number(req.params.id), req.body));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });
  app.delete('/api/tasks/:id', (req, res) => {
    academic.deleteTask(db, req.userId, Number(req.params.id));
    res.json({ success: true });
  });

  app.get('/api/exams', (req, res) => res.json(academic.getExams(db, req.userId)));
  app.post('/api/exams', (req, res) => {
    try {
      res.status(201).json(academic.createExam(db, req.userId, req.body));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });
  app.put('/api/exams/:id', (req, res) => {
    try {
      res.json(academic.updateExam(db, req.userId, Number(req.params.id), req.body));
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });
  app.delete('/api/exams/:id', (req, res) => {
    academic.deleteExam(db, req.userId, Number(req.params.id));
    res.json({ success: true });
  });

  app.get('/api/config/:key', (req, res) => {
    const stmt = db.prepare('SELECT value FROM config WHERE key = ? AND user_id = ?');
    stmt.bind([req.params.key, req.userId]);
    if (stmt.step()) {
      const result = stmt.getAsObject();
      stmt.free();
      return res.json({ key: req.params.key, value: result.value });
    }
    stmt.free();
    res.json({ key: req.params.key, value: null });
  });

  app.post('/api/config/:key', (req, res) => {
    const value =
      typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    db.run('INSERT OR REPLACE INTO config (user_id, key, value) VALUES (?, ?, ?)', [
      req.userId,
      req.params.key,
      value,
    ]);
    saveDB();
    io.to(`user:${req.userId}`).emit('config:update', { key: req.params.key, value });
    res.json({ success: true });
  });

  app.post('/api/courses/:code/bulk-schedules', (req, res) => {
    try {
      const code = req.params.code.toUpperCase();
      const course = getCourseByCode(req.userId, code);
      if (!course) return res.status(404).json({ error: 'Materia no encontrada' });
      db.run('DELETE FROM schedules WHERE course_code = ? AND user_id = ?', [code, req.userId]);
      const schedules = (req.body.schedules || []).filter(
        (s) => s.day && s.start_time && s.end_time
      );
      insertSchedules(req.userId, code, schedules);
      saveDB();
      broadcastCourses(req.userId);
      res.json({ success: true });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.post('/api/import', importSizeGuard, (req, res) => {
    try {
      const validation = validateImportPayload(req.body);
      if (!validation.valid) {
        return res.status(400).json({ error: validation.errors.join('; ') });
      }
      const uid = req.userId;
      let imported = 0;
      let skipped = 0;
      for (const c of validation.courses) {
        try {
          createCourse(uid, c);
          imported++;
        } catch (_e) {
          skipped++;
        }
      }
      broadcastCourses(uid);
      broadcastStats(uid);
      res.json({ success: true, imported, skipped });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get('*', (_req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
  });

  return app;
}

async function startAmellifyServer(options = {}) {
  const port = Number(options.port || process.env.PORT || 3000);
  const host = options.host || process.env.HOST || '0.0.0.0';
  const displayHost =
    options.displayHost || process.env.DISPLAY_HOST || 'localhost';

  await initDB();

  const app = createExpressApp();
  const server = http.createServer(app);
  io = new Server(server, {
    cors: { origin: true },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    const payload = auth.verifyToken(token);
    if (!payload) return next(new Error('No autorizado'));
    const user = auth.getUserById(db, payload.sub);
    if (!user) return next(new Error('No autorizado'));
    socket.userId = user.id;
    socket.join(`user:${user.id}`);
    next();
  });

  io.on('connection', (socket) => {
    console.log('Cliente conectado:', socket.id, 'user:', socket.userId);
    socket.emit('courses:update', getCourses(socket.userId));
    socket.emit('stats:update', getStats(socket.userId));
  });

  return new Promise((resolve) => {
    server.listen(port, host, () => {
      console.log('\n╔══════════════════════════════════════════╗');
      console.log(`║  📚 Amellify corriendo en puerto ${port}     ║`);
      console.log('╠══════════════════════════════════════════╣');
      console.log(`║  → Local:   http://${displayHost}:${port}            ║`);
      if (host === '0.0.0.0') {
        console.log(`║  → Red:     http://<tu-ip>:${port}              ║`);
      }
      console.log('║  → WebSocket: activo                       ║');
      console.log('║  → DB: amellify.db                         ║');
      console.log('╚══════════════════════════════════════════╝\n');
      console.log('  Ctrl+C para detener\n');
      resolve({ server, app, port, host });
    });
  });
}

if (require.main === module) {
  startAmellifyServer().catch((err) => {
    console.error('Error al iniciar:', err);
    process.exit(1);
  });

  process.on('SIGINT', () => {
    console.log('\nGuardando datos...');
    saveDB();
    process.exit(0);
  });
}

module.exports = {
  startAmellifyServer,
  initDB,
  saveDB,
  getCourses,
  createCourse,
  updateCourse,
  deleteCourse,
  getStats,
};
