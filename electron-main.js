const { app, BrowserWindow, shell, Menu, Tray, nativeImage, globalShortcut } = require('electron');
const path = require('path');

// ─── Keep reference so it's not garbage collected ─────────────────────────────
let mainWindow = null;
let tray       = null;
let server     = null;
const PORT     = 3000;

// ─── Start the Express server ─────────────────────────────────────────────────
function startServer() {
  // Require the express app but don't call listen yet — we do it here
  const express = require('express');
  const cors    = require('cors');
  const fs      = require('fs');

  const expressApp = express();
  const DB_FILE    = path.join(app.getPath('userData'), 'amellify-data.json');

  function readDB() {
    try {
      if (!fs.existsSync(DB_FILE)) return { courses: [] };
      return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch { return { courses: [] }; }
  }

  function writeDB(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  }

  function getNextId(courses) {
    let max = 0;
    for (const c of courses)
      for (const s of (c.schedules || []))
        if (s.id > max) max = s.id;
    return max + 1;
  }

  expressApp.use(cors());
  expressApp.use(express.json());

  // Serve static files from the app directory
  const staticRoot = app.isPackaged
    ? path.join(process.resourcesPath, 'app')
    : path.join(__dirname);
  expressApp.use(express.static(staticRoot));

  // ── API ─────────────────────────────────────────────────────────────────────
  expressApp.get('/api/courses', (req, res) => res.json(readDB().courses));

  expressApp.get('/api/courses/:code', (req, res) => {
    const course = readDB().courses.find(c => c.code === req.params.code.toUpperCase());
    if (!course) return res.status(404).json({ error: 'No encontrada' });
    res.json(course);
  });

  expressApp.post('/api/courses', (req, res) => {
    const db   = readDB();
    const body = req.body;
    const code = (body.code || '').trim().toUpperCase();
    const name = (body.name || '').trim().toUpperCase();
    if (!code || !name) return res.status(400).json({ error: 'Código y nombre son obligatorios' });
    if (db.courses.find(c => c.code === code))
      return res.status(409).json({ error: `Ya existe ${code}` });

    let nextId = getNextId(db.courses);
    const schedules = (body.schedules || [])
      .filter(s => s.day && s.start_time && s.end_time)
      .map(s => ({ id: nextId++, course_code: code, day: s.day, start_time: s.start_time, end_time: s.end_time, room: s.room || '' }));

    const course = { code, name,
      professor: body.professor || '', email: body.email || '',
      faculty: body.faculty || '', semester: body.semester || '',
      credits: parseInt(body.credits) || 3, status: body.status || 'active',
      notes: body.notes || '', color: body.color || 'blue',
      created_at: new Date().toISOString(), schedules
    };
    db.courses.push(course);
    writeDB(db);
    res.status(201).json(course);
  });

  expressApp.put('/api/courses/:code', (req, res) => {
    const db      = readDB();
    const oldCode = req.params.code.toUpperCase();
    const idx     = db.courses.findIndex(c => c.code === oldCode);
    if (idx === -1) return res.status(404).json({ error: 'No encontrada' });
    const body    = req.body;
    const newCode = (body.code || oldCode).trim().toUpperCase();
    if (newCode !== oldCode && db.courses.find(c => c.code === newCode))
      return res.status(409).json({ error: `Ya existe ${newCode}` });

    let nextId = getNextId(db.courses);
    const schedules = (body.schedules || [])
      .filter(s => s.day && s.start_time && s.end_time)
      .map(s => ({ id: s.id || nextId++, course_code: newCode, day: s.day, start_time: s.start_time, end_time: s.end_time, room: s.room || '' }));

    const old = db.courses[idx];
    db.courses[idx] = { ...old, code: newCode,
      name: (body.name || old.name).trim().toUpperCase(),
      professor: body.professor !== undefined ? body.professor : old.professor,
      email:     body.email     !== undefined ? body.email     : old.email,
      faculty:   body.faculty   !== undefined ? body.faculty   : old.faculty,
      semester:  body.semester  !== undefined ? body.semester  : old.semester,
      credits:   parseInt(body.credits) || old.credits,
      status:    body.status    || old.status,
      notes:     body.notes     !== undefined ? body.notes     : old.notes,
      color:     body.color     || old.color,
      schedules
    };
    writeDB(db);
    res.json(db.courses[idx]);
  });

  expressApp.delete('/api/courses/:code', (req, res) => {
    const db  = readDB();
    const idx = db.courses.findIndex(c => c.code === req.params.code.toUpperCase());
    if (idx === -1) return res.status(404).json({ error: 'No encontrada' });
    db.courses.splice(idx, 1);
    writeDB(db);
    res.json({ success: true });
  });

  expressApp.get('/api/stats', (req, res) => {
    const db     = readDB();
    const active = db.courses.filter(c => c.status === 'active');
    let totalMins = 0;
    for (const c of active)
      for (const s of (c.schedules || [])) {
        const [sh, sm] = s.start_time.split(':').map(Number);
        const [eh, em] = s.end_time.split(':').map(Number);
        totalMins += Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
      }
    res.json({
      totalCourses: db.courses.length,
      totalCredits: active.reduce((s, c) => s + (c.credits || 0), 0),
      totalHours: Math.round(totalMins / 60)
    });
  });

  expressApp.get('*', (req, res) => {
    res.sendFile(path.join(staticRoot, 'index.html'));
  });

  server = expressApp.listen(PORT, '127.0.0.1', () => {
    console.log(`Amellify server on http://localhost:${PORT}`);
    console.log(`Data stored at: ${DB_FILE}`);
  });
}

// ─── Create main window ───────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width:           1280,
    height:          820,
    minWidth:        900,
    minHeight:       600,
    title:           'Amellify',
    backgroundColor: '#f5f5f7',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      zoomFactor: 1.0, // Ensure zoom is enabled
    },
    // Frameless feel on Mac
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    show: false, // show after ready-to-show
  });

  // Wait a tick for server to start, then load
  setTimeout(() => {
    mainWindow.loadURL(`http://localhost:${PORT}`);
  }, 300);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open external links in browser, not Electron
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Register zoom shortcuts
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.control || input.meta) {
      // Zoom in: Ctrl/Cmd + "+" or Ctrl/Cmd + "="
      if (input.key === '+' || input.key === '=') {
        mainWindow.webContents.setZoomLevel(mainWindow.webContents.getZoomLevel() + 0.5);
        // Send notification to renderer
        mainWindow.webContents.executeJavaScript(`
          if (window.app && window.app.showSilentNotification) {
            window.app.showSilentNotification('⌨️ Ctrl+Plus: Acercar Zoom');
          }
        `);
        event.preventDefault();
      }
      // Zoom out: Ctrl/Cmd + "-"
      else if (input.key === '-') {
        mainWindow.webContents.setZoomLevel(mainWindow.webContents.getZoomLevel() - 0.5);
        // Send notification to renderer
        mainWindow.webContents.executeJavaScript(`
          if (window.app && window.app.showSilentNotification) {
            window.app.showSilentNotification('⌨️ Ctrl+Minus: Alejar Zoom');
          }
        `);
        event.preventDefault();
      }
      // Reset zoom: Ctrl/Cmd + "0"
      else if (input.key === '0') {
        mainWindow.webContents.setZoomLevel(0);
        // Send notification to renderer
        mainWindow.webContents.executeJavaScript(`
          if (window.app && window.app.showSilentNotification) {
            window.app.showSilentNotification('⌨️ Ctrl+0: Zoom Normal');
          }
        `);
        event.preventDefault();
      }
    }
  });

  mainWindow.on('closed', () => { mainWindow = null; });
}

// ─── App menu ─────────────────────────────────────────────────────────────────
function buildMenu() {
  const template = [
    ...(process.platform === 'darwin' ? [{
      label: 'Amellify',
      submenu: [
        { role: 'about', label: 'Acerca de Amellify' },
        { type: 'separator' },
        { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit', label: 'Salir' }
      ]
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
        { label: 'Vista Grid',    accelerator: 'CmdOrCtrl+1', click: () => mainWindow?.webContents.executeJavaScript("app.switchView('grid')") },
        { label: 'Vista Semanal', accelerator: 'CmdOrCtrl+2', click: () => mainWindow?.webContents.executeJavaScript("app.switchView('week')") },
        { label: 'Lista',         accelerator: 'CmdOrCtrl+3', click: () => mainWindow?.webContents.executeJavaScript("app.switchView('list')") },
        { type: 'separator' },
        { label: 'Alternar tema', accelerator: 'CmdOrCtrl+Shift+T', click: () => mainWindow?.webContents.executeJavaScript('app.toggleTheme()') },
        { type: 'separator' },
        { role: 'reload', label: 'Recargar' },
        { role: 'toggleDevTools', label: 'Dev Tools' },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Zoom normal' },
        { role: 'zoomIn', label: 'Acercar' },
        { role: 'zoomOut', label: 'Alejar' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Pantalla completa' }
      ]
    },
    {
      label: 'Editar',
      submenu: [
        { role: 'undo', label: 'Deshacer' },
        { role: 'redo', label: 'Rehacer' },
        { type: 'separator' },
        { role: 'cut', label: 'Cortar' },
        { role: 'copy', label: 'Copiar' },
        { role: 'paste', label: 'Pegar' },
        { role: 'selectAll', label: 'Seleccionar todo' }
      ]
    }
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  startServer();
  buildMenu();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    server?.close();
    app.quit();
  }
});

app.on('before-quit', () => {
  server?.close();
});
