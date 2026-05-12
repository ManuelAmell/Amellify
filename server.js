const express = require('express');
const path    = require('path');
const cors    = require('cors');
const fs      = require('fs');
const http    = require('http');
const { Server } = require('socket.io');
const initSqlJs = require('sql.js');

const app  = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || '100.101.28.97';
const DB_PATH = path.join(__dirname, 'amellify.db');

let db = null;
let io = null;

const app2 = app;

async function initDB() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      professor TEXT DEFAULT '',
      email TEXT DEFAULT '',
      faculty TEXT DEFAULT '',
      semester TEXT DEFAULT '',
      credits INTEGER DEFAULT 3,
      status TEXT DEFAULT 'active',
      notes TEXT DEFAULT '',
      color TEXT DEFAULT 'blue',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS schedules (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_code TEXT NOT NULL,
      day TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      room TEXT DEFAULT '',
      FOREIGN KEY (course_code) REFERENCES courses(code) ON DELETE CASCADE
    )
  `);

  db.run(`CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT)`);

  saveDB();
}

function saveDB() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

function getCourses() {
  const stmt = db.prepare("SELECT * FROM courses ORDER BY code");
  const courses = [];

  while (stmt.step()) {
    const course = stmt.getAsObject();
    const schedStmt = db.prepare("SELECT * FROM schedules WHERE course_code = ?");
    schedStmt.bind([course.code]);
    const schedules = [];

    while (schedStmt.step()) {
      schedules.push(schedStmt.getAsObject());
    }
    schedStmt.free();

    courses.push({ ...course, schedules });
  }
  stmt.free();

  return courses;
}

function getCourseByCode(code) {
  const stmt = db.prepare("SELECT * FROM courses WHERE code = ?");
  stmt.bind([code.toUpperCase()]);

  if (stmt.step()) {
    const course = stmt.getAsObject();
    stmt.free();

    const schedStmt = db.prepare("SELECT * FROM schedules WHERE course_code = ?");
    schedStmt.bind([code.toUpperCase()]);
    const schedules = [];

    while (schedStmt.step()) {
      schedules.push(schedStmt.getAsObject());
    }
    schedStmt.free();

    return { ...course, schedules };
  }
  stmt.free();
  return null;
}

function createCourse(body) {
  const code = (body.code || '').trim().toUpperCase();
  const name = (body.name || '').trim().toUpperCase();

  if (!code || !name) throw new Error('Código y nombre son obligatorios');

  const checkStmt = db.prepare("SELECT code FROM courses WHERE code = ?");
  checkStmt.bind([code]);
  if (checkStmt.step()) {
    checkStmt.free();
    throw new Error(`Ya existe una materia con el código ${code}`);
  }
  checkStmt.free();

  db.run(`
    INSERT INTO courses (code, name, professor, email, faculty, semester, credits, status, notes, color)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    code, name,
    body.professor || '',
    body.email || '',
    body.faculty || '',
    body.semester || '',
    parseInt(body.credits) || 3,
    body.status || 'active',
    body.notes || '',
    body.color || 'blue'
  ]);

  const schedules = (body.schedules || []).filter(s => s.day && s.start_time && s.end_time);
  const newSchedules = [];

  for (const s of schedules) {
    db.run(`
      INSERT INTO schedules (course_code, day, start_time, end_time, room)
      VALUES (?, ?, ?, ?, ?)
    `, [code, s.day, s.start_time, s.end_time, s.room || '']);

    const idStmt = db.prepare("SELECT last_insert_rowid() as id");
    idStmt.step();
    const schedId = idStmt.getAsObject().id;
    idStmt.free();

    newSchedules.push({
      id: schedId,
      course_code: code,
      day: s.day,
      start_time: s.start_time,
      end_time: s.end_time,
      room: s.room || ''
    });
  }

  saveDB();
  return { code, name, professor: body.professor || '', email: body.email || '', faculty: body.faculty || '', semester: body.semester || '', credits: parseInt(body.credits) || 3, status: body.status || 'active', notes: body.notes || '', color: body.color || 'blue', schedules: newSchedules };
}

function updateCourse(oldCode, body) {
  const newCode = (body.code || oldCode).trim().toUpperCase();

  if (newCode !== oldCode) {
    const checkStmt = db.prepare("SELECT code FROM courses WHERE code = ? AND code != ?");
    checkStmt.bind([newCode, oldCode]);
    if (checkStmt.step()) {
      checkStmt.free();
      throw new Error(`Ya existe una materia con el código ${newCode}`);
    }
    checkStmt.free();
  }

  db.run(`
    UPDATE courses SET
      code = ?,
      name = ?,
      professor = ?,
      email = ?,
      faculty = ?,
      semester = ?,
      credits = ?,
      status = ?,
      notes = ?,
      color = ?
    WHERE code = ?
  `, [
    newCode,
    (body.name || '').trim().toUpperCase(),
    body.professor !== undefined ? body.professor : '',
    body.email !== undefined ? body.email : '',
    body.faculty !== undefined ? body.faculty : '',
    body.semester !== undefined ? body.semester : '',
    parseInt(body.credits) || 3,
    body.status || 'active',
    body.notes !== undefined ? body.notes : '',
    body.color || 'blue',
    oldCode
  ]);

  db.run("DELETE FROM schedules WHERE course_code = ?", [newCode]);

  const schedules = (body.schedules || []).filter(s => s.day && s.start_time && s.end_time);
  const newSchedules = [];

  for (const s of schedules) {
    db.run(`
      INSERT INTO schedules (course_code, day, start_time, end_time, room)
      VALUES (?, ?, ?, ?, ?)
    `, [newCode, s.day, s.start_time, s.end_time, s.room || '']);

    const idStmt = db.prepare("SELECT last_insert_rowid() as id");
    idStmt.step();
    const schedId = idStmt.getAsObject().id;
    idStmt.free();

    newSchedules.push({
      id: schedId,
      course_code: newCode,
      day: s.day,
      start_time: s.start_time,
      end_time: s.end_time,
      room: s.room || ''
    });
  }

  saveDB();
  return { code: newCode, name: (body.name || '').trim().toUpperCase(), professor: body.professor !== undefined ? body.professor : '', email: body.email !== undefined ? body.email : '', faculty: body.faculty !== undefined ? body.faculty : '', semester: body.semester !== undefined ? body.semester : '', credits: parseInt(body.credits) || 3, status: body.status || 'active', notes: body.notes !== undefined ? body.notes : '', color: body.color || 'blue', schedules: newSchedules };
}

function deleteCourse(code) {
  db.run("DELETE FROM schedules WHERE course_code = ?", [code.toUpperCase()]);
  db.run("DELETE FROM courses WHERE code = ?", [code.toUpperCase()]);
  saveDB();
  return { success: true, deleted: code.toUpperCase() };
}

function getStats() {
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

  return { totalCourses: courses.length, totalCredits: credits, totalHours: Math.round(totalMins / 60) };
}

function broadcastCourses() {
  if (io) io.emit('courses:update', getCourses());
}

function broadcastStats() {
  if (io) io.emit('stats:update', getStats());
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

app.get('/api/courses', (req, res) => {
  res.json(getCourses());
});

app.get('/api/courses/:code', (req, res) => {
  const course = getCourseByCode(req.params.code);
  if (!course) return res.status(404).json({ error: 'Materia no encontrada' });
  res.json(course);
});

app.post('/api/courses', (req, res) => {
  try {
    const course = createCourse(req.body);
    broadcastCourses();
    broadcastStats();
    res.status(201).json(course);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.put('/api/courses/:code', (req, res) => {
  try {
    const course = updateCourse(req.params.code, req.body);
    broadcastCourses();
    broadcastStats();
    res.json(course);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete('/api/courses/:code', (req, res) => {
  try {
    deleteCourse(req.params.code);
    broadcastCourses();
    broadcastStats();
    res.json({ success: true, deleted: req.params.code });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('/api/stats', (req, res) => {
  res.json(getStats());
});

app.get('/api/config/:key', (req, res) => {
  const stmt = db.prepare("SELECT value FROM config WHERE key = ?");
  stmt.bind([req.params.key]);
  if (stmt.step()) {
    const result = stmt.getAsObject();
    stmt.free();
    res.json({ key: req.params.key, value: result.value });
  }
  stmt.free();
  res.json({ key: req.params.key, value: null });
});

app.post('/api/config/:key', (req, res) => {
  const value = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  db.run("INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)", [req.params.key, value]);
  saveDB();
  io.emit('config:update', { key: req.params.key, value });
  res.json({ success: true });
});

app.post('/api/courses/:code/bulk-schedules', (req, res) => {
  try {
    const code = req.params.code.toUpperCase();
    const schedules = req.body.schedules || [];

    db.run("DELETE FROM schedules WHERE course_code = ?", [code]);

    for (const s of schedules) {
      db.run(`
        INSERT INTO schedules (course_code, day, start_time, end_time, room)
        VALUES (?, ?, ?, ?, ?)
      `, [code, s.day, s.start_time, s.end_time, s.room || '']);
    }

    saveDB();
    broadcastCourses();
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/import', (req, res) => {
  try {
    const courses = req.body.courses || [];

    for (const c of courses) {
      try {
        createCourse(c);
      } catch (e) {
        // Skip duplicates
      }
    }

    broadcastCourses();
    broadcastStats();
    res.json({ success: true, imported: courses.length });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

async function start() {
  await initDB();

  const server = http.createServer(app);
  io = new Server(server);

  io.on('connection', (socket) => {
    console.log('Cliente conectado:', socket.id);
    socket.emit('courses:update', getCourses());
    socket.emit('stats:update', getStats());
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log('\n╔══════════════════════════════════════════╗');
    console.log(`║  📚 Amellify corriendo en puerto ${PORT}     ║`);
    console.log('╠══════════════════════════════════════════╣');
    console.log(`║  → Local:   http://localhost:${PORT}            ║`);
    console.log(`║  → Red:     http://${HOST}:${PORT}      ║`);
    console.log('║  → WebSocket: activo                       ║');
    console.log(`║  → DB: amellify.db                         ║`);
    console.log('╚══════════════════════════════════════════╝\n');
    console.log('  Ctrl+C para detener\n');
  });
}

start().catch(err => {
  console.error('Error al iniciar:', err);
  process.exit(1);
});

process.on('SIGINT', () => {
  console.log('\nGuardando datos...');
  saveDB();
  process.exit(0);
});