const express = require('express');
const path    = require('path');
const cors    = require('cors');
const fs      = require('fs');

const app  = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'amellify-data.json');

// ─── JSON "database" ──────────────────────────────────────────────────────────
function readDB() {
  try {
    if (!fs.existsSync(DB_FILE)) return { courses: [] };
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } catch { return { courses: [] }; }
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function getNextScheduleId(courses) {
  let max = 0;
  for (const c of courses) {
    for (const s of (c.schedules || [])) {
      if (s.id > max) max = s.id;
    }
  }
  return max + 1;
}

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/courses
app.get('/api/courses', (req, res) => {
  const db = readDB();
  res.json(db.courses);
});

// GET /api/courses/:code
app.get('/api/courses/:code', (req, res) => {
  const db     = readDB();
  const course = db.courses.find(c => c.code === req.params.code.toUpperCase());
  if (!course) return res.status(404).json({ error: 'Materia no encontrada' });
  res.json(course);
});

// POST /api/courses — create
app.post('/api/courses', (req, res) => {
  const db   = readDB();
  const body = req.body;
  const code = (body.code || '').trim().toUpperCase();
  const name = (body.name || '').trim().toUpperCase();

  if (!code || !name) return res.status(400).json({ error: 'Código y nombre son obligatorios' });
  if (db.courses.find(c => c.code === code)) {
    return res.status(409).json({ error: `Ya existe una materia con el código ${code}` });
  }

  let nextId = getNextScheduleId(db.courses);
  const schedules = (body.schedules || [])
    .filter(s => s.day && s.start_time && s.end_time)
    .map(s => ({ id: nextId++, course_code: code, day: s.day, start_time: s.start_time, end_time: s.end_time, room: s.room || '' }));

  const course = {
    code, name,
    professor: body.professor || '',
    email:     body.email     || '',
    faculty:   body.faculty   || '',
    semester:  body.semester  || '',
    credits:   parseInt(body.credits) || 3,
    status:    body.status    || 'active',
    notes:     body.notes     || '',
    color:     body.color     || 'blue',
    created_at: new Date().toISOString(),
    schedules
  };

  db.courses.push(course);
  writeDB(db);
  res.status(201).json(course);
});

// PUT /api/courses/:code — update
app.put('/api/courses/:code', (req, res) => {
  const db      = readDB();
  const oldCode = req.params.code.toUpperCase();
  const idx     = db.courses.findIndex(c => c.code === oldCode);
  if (idx === -1) return res.status(404).json({ error: 'Materia no encontrada' });

  const body    = req.body;
  const newCode = (body.code || oldCode).trim().toUpperCase();

  if (newCode !== oldCode && db.courses.find(c => c.code === newCode)) {
    return res.status(409).json({ error: `Ya existe una materia con el código ${newCode}` });
  }

  let nextId = getNextScheduleId(db.courses);
  const schedules = (body.schedules || [])
    .filter(s => s.day && s.start_time && s.end_time)
    .map(s => ({ id: s.id || nextId++, course_code: newCode, day: s.day, start_time: s.start_time, end_time: s.end_time, room: s.room || '' }));

  const old = db.courses[idx];
  db.courses[idx] = {
    ...old,
    code:      newCode,
    name:      (body.name || old.name).trim().toUpperCase(),
    professor: body.professor  !== undefined ? body.professor  : old.professor,
    email:     body.email      !== undefined ? body.email      : old.email,
    faculty:   body.faculty    !== undefined ? body.faculty    : old.faculty,
    semester:  body.semester   !== undefined ? body.semester   : old.semester,
    credits:   parseInt(body.credits) || old.credits,
    status:    body.status     || old.status,
    notes:     body.notes      !== undefined ? body.notes      : old.notes,
    color:     body.color      || old.color,
    schedules
  };

  writeDB(db);
  res.json(db.courses[idx]);
});

// DELETE /api/courses/:code
app.delete('/api/courses/:code', (req, res) => {
  const db   = readDB();
  const code = req.params.code.toUpperCase();
  const idx  = db.courses.findIndex(c => c.code === code);
  if (idx === -1) return res.status(404).json({ error: 'Materia no encontrada' });
  db.courses.splice(idx, 1);
  writeDB(db);
  res.json({ success: true, deleted: code });
});

// GET /api/stats
app.get('/api/stats', (req, res) => {
  const db     = readDB();
  const active = db.courses.filter(c => c.status === 'active');
  const credits = active.reduce((s, c) => s + (c.credits || 0), 0);
  let totalMins = 0;
  for (const c of active) {
    for (const s of (c.schedules || [])) {
      const [sh, sm] = s.start_time.split(':').map(Number);
      const [eh, em] = s.end_time.split(':').map(Number);
      totalMins += Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
    }
  }
  res.json({ totalCourses: db.courses.length, totalCredits: credits, totalHours: Math.round(totalMins / 60) });
});

// Catch-all → index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log('\n╔══════════════════════════════════════════╗');
  console.log(`║  📚 Amellify corriendo en puerto ${PORT}     ║`);
  console.log('╠══════════════════════════════════════════╣');
  console.log(`║  → Abre: http://localhost:${PORT}            ║`);
  console.log(`║  → Datos: amellify-data.json             ║`);
  console.log('╚══════════════════════════════════════════╝\n');
  console.log('  Ctrl+C para detener\n');
});
