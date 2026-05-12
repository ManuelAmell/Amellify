const { app, BrowserWindow, shell, Menu, globalShortcut } = require('electron');
const path = require('path');
const http = require('http');

let mainWindow = null;
const PORT = 3000;
const HOST = '100.101.28.97';

// Start the same server as server.js
function startServer(callback) {
  const express = require('express');
  const cors = require('cors');
  const fs = require('fs');
  const http = require('http');
  const { Server } = require('socket.io');
  const initSqlJs = require('sql.js');

  const expressApp = express();
  const DB_PATH = path.join(__dirname, 'amellify.db');
  let db = null;
  let io = null;

  async function initDB() {
    const SQL = await initSqlJs();
    if (fs.existsSync(DB_PATH)) {
      const buffer = fs.readFileSync(DB_PATH);
      db = new SQL.Database(buffer);
    } else {
      db = new SQL.Database();
    }

    db.run(`CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
      professor TEXT DEFAULT '', email TEXT DEFAULT '',
      faculty TEXT DEFAULT '', semester TEXT DEFAULT '',
      credits INTEGER DEFAULT 3, status TEXT DEFAULT 'active',
      notes TEXT DEFAULT '', color TEXT DEFAULT 'blue',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_code TEXT NOT NULL, day TEXT NOT NULL,
      start_time TEXT NOT NULL, end_time TEXT NOT NULL,
      room TEXT DEFAULT '',
      FOREIGN KEY (course_code) REFERENCES courses(code) ON DELETE CASCADE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT)`);
    saveDB();
  }

  function saveDB() {
    if (db) {
      const data = db.export();
      fs.writeFileSync(DB_PATH, Buffer.from(data));
    }
  }

  function getCourses() {
    const stmt = db.prepare("SELECT * FROM courses ORDER BY code");
    const courses = [];
    while (stmt.step()) {
      const course = stmt.getAsObject();
      const sStmt = db.prepare("SELECT * FROM schedules WHERE course_code = ?");
      sStmt.bind([course.code]);
      const schedules = [];
      while (sStmt.step()) schedules.push(sStmt.getAsObject());
      sStmt.free();
      courses.push({ ...course, schedules });
    }
    stmt.free();
    return courses;
  }

  function broadcastCourses() { if (io) io.emit('courses:update', getCourses()); }
  function broadcastStats() {
    const courses = getCourses();
    const active = courses.filter(c => c.status === 'active');
    const credits = active.reduce((s, c) => s + (c.credits || 0), 0);
    let totalMins = 0;
    for (const c of active) {
      for (const s of (c.schedules || [])) {
        const [sh, sm] = s.start_time.split(':').map(Number);
        const [eh, em] = s.end_time.split(':').map(Number);
        totalMins += Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
      }
    }
    if (io) io.emit('stats:update', { totalCourses: courses.length, totalCredits: credits, totalHours: Math.round(totalMins / 60) });
  }

  expressApp.use(cors());
  expressApp.use(express.json());
  expressApp.use(express.static(__dirname));

  expressApp.get('/api/courses', (_, res) => res.json(getCourses()));
  expressApp.get('/api/courses/:code', (req, res) => {
    const courses = getCourses();
    const course = courses.find(c => c.code === req.params.code.toUpperCase());
    if (!course) return res.status(404).json({ error: 'No encontrada' });
    res.json(course);
  });
  expressApp.post('/api/courses', (req, res) => {
    try {
      const body = req.body;
      const code = (body.code || '').trim().toUpperCase();
      const name = (body.name || '').trim().toUpperCase();
      if (!code || !name) throw new Error('Código y nombre son obligatorios');

      const check = db.prepare("SELECT code FROM courses WHERE code = ?");
      check.bind([code]);
      if (check.step()) { check.free(); throw new Error(`Ya existe ${code}`); }
      check.free();

      db.run(`INSERT INTO courses (code, name, professor, email, faculty, semester, credits, status, notes, color)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [code, name, body.professor || '', body.email || '', body.faculty || '', body.semester || '',
         parseInt(body.credits) || 3, body.status || 'active', body.notes || '', body.color || 'blue']);

      const schedules = (body.schedules || []).filter(s => s.day && s.start_time && s.end_time);
      for (const s of schedules) {
        db.run(`INSERT INTO schedules (course_code, day, start_time, end_time, room) VALUES (?, ?, ?, ?, ?)`,
          [code, s.day, s.start_time, s.end_time, s.room || '']);
      }
      saveDB();
      broadcastCourses();
      broadcastStats();
      res.status(201).json({ code, name });
    } catch (err) { res.status(400).json({ error: err.message }); }
  });
  expressApp.put('/api/courses/:code', (req, res) => {
    try {
      const oldCode = req.params.code.toUpperCase();
      const body = req.body;
      const newCode = (body.code || oldCode).trim().toUpperCase();

      if (newCode !== oldCode) {
        const check = db.prepare("SELECT code FROM courses WHERE code = ? AND code != ?");
        check.bind([newCode, oldCode]);
        if (check.step()) { check.free(); throw new Error(`Ya existe ${newCode}`); }
        check.free();
      }

      db.run(`UPDATE courses SET code=?, name=?, professor=?, email=?, faculty=?, semester=?, credits=?, status=?, notes=?, color=? WHERE code=?`,
        [newCode, (body.name || '').trim().toUpperCase(), body.professor || '', body.email || '', body.faculty || '',
         body.semester || '', parseInt(body.credits) || 3, body.status || 'active', body.notes || '', body.color || 'blue', oldCode]);

      db.run("DELETE FROM schedules WHERE course_code = ?", [newCode]);
      const schedules = (body.schedules || []).filter(s => s.day && s.start_time && s.end_time);
      for (const s of schedules) {
        db.run(`INSERT INTO schedules (course_code, day, start_time, end_time, room) VALUES (?, ?, ?, ?, ?)`,
          [newCode, s.day, s.start_time, s.end_time, s.room || '']);
      }
      saveDB();
      broadcastCourses();
      broadcastStats();
      res.json({ code: newCode });
    } catch (err) { res.status(400).json({ error: err.message }); }
  });
  expressApp.delete('/api/courses/:code', (req, res) => {
    db.run("DELETE FROM schedules WHERE course_code = ?", [req.params.code.toUpperCase()]);
    db.run("DELETE FROM courses WHERE code = ?", [req.params.code.toUpperCase()]);
    saveDB();
    broadcastCourses();
    broadcastStats();
    res.json({ success: true });
  });
  expressApp.get('/api/stats', (_, res) => {
    const courses = getCourses();
    const active = courses.filter(c => c.status === 'active');
    const credits = active.reduce((s, c) => s + (c.credits || 0), 0);
    let totalMins = 0;
    for (const c of active) {
      for (const s of (c.schedules || [])) {
        const [sh, sm] = s.start_time.split(':').map(Number);
        const [eh, em] = s.end_time.split(':').map(Number);
        totalMins += Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
      }
    }
    res.json({ totalCourses: courses.length, totalCredits: credits, totalHours: Math.round(totalMins / 60) });
  });
  expressApp.get('*', (_, res) => res.sendFile(path.join(__dirname, 'index.html')));

  initDB().then(() => {
    const server = http.createServer(expressApp);
    io = new Server(server);

    io.on('connection', (socket) => {
      socket.emit('courses:update', getCourses());
    });

    server.listen(PORT, HOST, () => {
      console.log(`Amellify server on http://${HOST}:${PORT}`);
      console.log(`DB: ${DB_PATH}`);
      if (callback) callback();
    });
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 820, minWidth: 900, minHeight: 600,
    title: 'Amellify', backgroundColor: '#f5f5f7',
    webPreferences: { nodeIntegration: false, contextIsolation: true, zoomFactor: 1.0 },
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    show: false,
  });

  setTimeout(() => {
    mainWindow.loadURL(`http://localhost:${PORT}`);
  }, 500);

  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

function buildMenu() {
  const template = [
    ...(process.platform === 'darwin' ? [{
      label: 'Amellify',
      submenu: [{ role: 'about', label: 'Acerca de Amellify' }, { type: 'separator' },
        { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit', label: 'Salir' }]
    }] : []),
    {
      label: 'Archivo',
      submenu: [
        { label: 'Nueva Materia', accelerator: 'CmdOrCtrl+N',
          click: () => mainWindow?.webContents.executeJavaScript('app.openAddCourseModal()') },
        { type: 'separator' },
        process.platform === 'darwin' ? { role: 'close' } : { role: 'quit', label: 'Salir' }
      ]
    },
    {
      label: 'Vista',
      submenu: [
        { label: 'Vista Grid', accelerator: 'CmdOrCtrl+1', click: () => mainWindow?.webContents.executeJavaScript("app.switchView('grid')") },
        { label: 'Vista Semanal', accelerator: 'CmdOrCtrl+2', click: () => mainWindow?.webContents.executeJavaScript("app.switchView('week')") },
        { label: 'Lista', accelerator: 'CmdOrCtrl+3', click: () => mainWindow?.webContents.executeJavaScript("app.switchView('list')") },
        { type: 'separator' },
        { label: 'Alternar tema', accelerator: 'CmdOrCtrl+Shift+T', click: () => mainWindow?.webContents.executeJavaScript('app.toggleTheme()') },
        { type: 'separator' },
        { role: 'reload' }, { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Editar',
      submenu: [
        { role: 'undo', label: 'Deshacer' }, { role: 'redo', label: 'Rehacer' },
        { type: 'separator' },
        { role: 'cut', label: 'Cortar' }, { role: 'copy', label: 'Copiar' }, { role: 'paste', label: 'Pegar' }, { role: 'selectAll', label: 'Seleccionar todo' }
      ]
    }
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  startServer(() => {
    buildMenu();
    createWindow();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});