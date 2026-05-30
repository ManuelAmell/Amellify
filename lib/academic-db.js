/** Tareas, exámenes y utilidades académicas en SQLite */

function ensureAcademicTables(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      course_code TEXT DEFAULT '',
      title TEXT NOT NULL,
      due_date TEXT NOT NULL,
      priority TEXT DEFAULT 'normal',
      completed INTEGER DEFAULT 0,
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS exams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      course_code TEXT NOT NULL,
      title TEXT NOT NULL,
      exam_date TEXT NOT NULL,
      exam_time TEXT DEFAULT '',
      room TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

function getTasks(db, userId) {
  const stmt = db.prepare(
    'SELECT * FROM tasks WHERE user_id = ? ORDER BY due_date ASC, id ASC'
  );
  stmt.bind([userId]);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows.map((t) => ({ ...t, completed: !!t.completed }));
}

function createTask(db, userId, body) {
  const title = (body.title || '').trim();
  const due_date = (body.due_date || '').trim();
  if (!title || !due_date) throw new Error('Título y fecha límite son obligatorios');

  db.run(
    `INSERT INTO tasks (user_id, course_code, title, due_date, priority, completed, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      (body.course_code || '').toUpperCase(),
      title,
      due_date,
      body.priority || 'normal',
      body.completed ? 1 : 0,
      body.notes || '',
    ]
  );
  const idStmt = db.prepare('SELECT last_insert_rowid() as id');
  idStmt.step();
  const id = idStmt.getAsObject().id;
  idStmt.free();
  return getTaskById(db, userId, id);
}

function getTaskById(db, userId, id) {
  const stmt = db.prepare('SELECT * FROM tasks WHERE id = ? AND user_id = ?');
  stmt.bind([id, userId]);
  if (!stmt.step()) {
    stmt.free();
    return null;
  }
  const row = stmt.getAsObject();
  stmt.free();
  return { ...row, completed: !!row.completed };
}

function updateTask(db, userId, id, body) {
  const existing = getTaskById(db, userId, id);
  if (!existing) throw new Error('Tarea no encontrada');

  db.run(
    `UPDATE tasks SET course_code=?, title=?, due_date=?, priority=?, completed=?, notes=? WHERE id=? AND user_id=?`,
    [
      (body.course_code !== undefined
        ? String(body.course_code || '').trim()
        : existing.course_code || ''
      ).toUpperCase(),
      (body.title || existing.title).trim(),
      body.due_date || existing.due_date,
      body.priority || existing.priority,
      body.completed !== undefined ? (body.completed ? 1 : 0) : (existing.completed ? 1 : 0),
      body.notes !== undefined ? body.notes : existing.notes,
      id,
      userId,
    ]
  );
  return getTaskById(db, userId, id);
}

function deleteTask(db, userId, id) {
  db.run('DELETE FROM tasks WHERE id = ? AND user_id = ?', [id, userId]);
  return { success: true };
}

function getExams(db, userId) {
  const stmt = db.prepare(
    'SELECT * FROM exams WHERE user_id = ? ORDER BY exam_date ASC, exam_time ASC'
  );
  stmt.bind([userId]);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function createExam(db, userId, body) {
  const title = (body.title || '').trim();
  const exam_date = (body.exam_date || '').trim();
  const course_code = (body.course_code || '').trim().toUpperCase();
  if (!title || !exam_date || !course_code) {
    throw new Error('Materia, título y fecha son obligatorios');
  }

  db.run(
    `INSERT INTO exams (user_id, course_code, title, exam_date, exam_time, room, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      course_code,
      title,
      exam_date,
      body.exam_time || '',
      body.room || '',
      body.notes || '',
    ]
  );
  const idStmt = db.prepare('SELECT last_insert_rowid() as id');
  idStmt.step();
  const id = idStmt.getAsObject().id;
  idStmt.free();
  return getExamById(db, userId, id);
}

function getExamById(db, userId, id) {
  const stmt = db.prepare('SELECT * FROM exams WHERE id = ? AND user_id = ?');
  stmt.bind([id, userId]);
  if (!stmt.step()) {
    stmt.free();
    return null;
  }
  const row = stmt.getAsObject();
  stmt.free();
  return row;
}

function updateExam(db, userId, id, body) {
  const existing = getExamById(db, userId, id);
  if (!existing) throw new Error('Examen no encontrado');

  db.run(
    `UPDATE exams SET course_code=?, title=?, exam_date=?, exam_time=?, room=?, notes=? WHERE id=? AND user_id=?`,
    [
      (body.course_code || existing.course_code).toUpperCase(),
      (body.title || existing.title).trim(),
      body.exam_date || existing.exam_date,
      body.exam_time !== undefined ? body.exam_time : existing.exam_time,
      body.room !== undefined ? body.room : existing.room,
      body.notes !== undefined ? body.notes : existing.notes,
      id,
      userId,
    ]
  );
  return getExamById(db, userId, id);
}

function deleteExam(db, userId, id) {
  db.run('DELETE FROM exams WHERE id = ? AND user_id = ?', [id, userId]);
  return { success: true };
}

function duplicateCourse(db, getCoursesFn, createCourseFn, code) {
  const courses = getCoursesFn();
  const source = courses.find((c) => c.code === code.toUpperCase());
  if (!source) throw new Error('Materia no encontrada');

  let newCode = `${source.code}2`;
  let n = 2;
  while (courses.some((c) => c.code === newCode)) {
    n += 1;
    newCode = `${source.code.replace(/\d+$/, '')}${n}`;
  }

  return createCourseFn({
    ...source,
    code: newCode,
    name: `${source.name} (COPIA)`,
    schedules: (source.schedules || []).map((s) => ({
      day: s.day,
      start_time: s.start_time,
      end_time: s.end_time,
      room: s.room,
    })),
  });
}

function getExtendedStats(db, userId, getCoursesFn, getStatsFn) {
  const stats = getStatsFn();
  const courses = getCoursesFn();
  const tasks = getTasks(db, userId);
  const exams = getExams(db, userId);
  const hoursByDay = { Lunes: 0, Martes: 0, Miércoles: 0, Jueves: 0, Viernes: 0, Sábado: 0 };

  for (const c of courses.filter((x) => x.status === 'active')) {
    for (const s of c.schedules || []) {
      const [sh, sm] = s.start_time.split(':').map(Number);
      const [eh, em] = s.end_time.split(':').map(Number);
      const mins = Math.max(0, eh * 60 + em - (sh * 60 + sm));
      if (hoursByDay[s.day] !== undefined) hoursByDay[s.day] += mins / 60;
    }
  }

  return {
    ...stats,
    pendingTasks: tasks.filter((t) => !t.completed).length,
    upcomingExams: exams.filter((e) => e.exam_date >= new Date().toISOString().slice(0, 10)).length,
    hoursByDay,
  };
}

module.exports = {
  ensureAcademicTables,
  getTasks,
  createTask,
  updateTask,
  deleteTask,
  getExams,
  createExam,
  updateExam,
  deleteExam,
  duplicateCourse,
  getExtendedStats,
};
