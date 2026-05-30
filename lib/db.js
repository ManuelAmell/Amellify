/**
 * Capa de acceso a SQLite (sql.js).
 *
 * Esquema principal:
 * - users: cuentas (email único, password_hash, name)
 * - courses: materias por user_id (UNIQUE user_id+code)
 * - schedules: horarios por user_id + course_code
 * - config: clave-valor por user_id
 * - tasks / exams: datos académicos por user_id
 * - schema_migrations: versiones aplicadas
 */

const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');
const academic = require('./academic-db');
const auth = require('./auth');

const MIGRATIONS = [
  {
    id: 1,
    name: 'indexes_user_scoped',
    up(db) {
      db.run('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)');
      db.run('CREATE INDEX IF NOT EXISTS idx_courses_user_id ON courses(user_id)');
      db.run('CREATE INDEX IF NOT EXISTS idx_courses_user_code ON courses(user_id, code)');
      db.run('CREATE INDEX IF NOT EXISTS idx_schedules_user_id ON schedules(user_id)');
      db.run('CREATE INDEX IF NOT EXISTS idx_schedules_course ON schedules(course_code, user_id)');
      db.run('CREATE INDEX IF NOT EXISTS idx_config_user_id ON config(user_id)');
      db.run('CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id)');
      db.run('CREATE INDEX IF NOT EXISTS idx_exams_user_id ON exams(user_id)');
    },
  },
  {
    id: 2,
    name: 'users_role',
    up(db) {
      if (!tableHasColumn(db, 'users', 'role')) {
        db.run("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'");
      }
      db.run('CREATE INDEX IF NOT EXISTS idx_users_role ON users(role)');
    },
  },
];

let db = null;
let dbPath = null;

function tableHasColumn(database, table, column) {
  const info = database.exec(`PRAGMA table_info(${table})`);
  if (!info.length) return false;
  return info[0].values.some((row) => row[1] === column);
}

function ensureBaseTables(database) {
  database.run(`
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

  database.run(`
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

  database.run(`CREATE TABLE IF NOT EXISTS config (key TEXT PRIMARY KEY, value TEXT)`);

  try {
    database.run(`ALTER TABLE courses ADD COLUMN partials TEXT DEFAULT '[]'`);
  } catch {
    /* columna ya existe */
  }

  academic.ensureAcademicTables(database);
  auth.ensureAuthSchema(database);
}

function ensureMigrationTable(database) {
  database.run(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

function getAppliedMigrationIds(database) {
  ensureMigrationTable(database);
  const result = database.exec('SELECT id FROM schema_migrations ORDER BY id');
  if (!result.length) return new Set();
  return new Set(result[0].values.map((row) => row[0]));
}

function runMigrations(database) {
  ensureMigrationTable(database);
  const applied = getAppliedMigrationIds(database);
  for (const migration of MIGRATIONS) {
    if (applied.has(migration.id)) continue;
    migration.up(database);
    database.run('INSERT INTO schema_migrations (id, name) VALUES (?, ?)', [
      migration.id,
      migration.name,
    ]);
  }
}

function parsePartials(raw) {
  if (Array.isArray(raw)) return raw;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function serializePartials(partials) {
  return JSON.stringify(Array.isArray(partials) ? partials : []);
}

async function initDatabase(options = {}) {
  const SQL = await initSqlJs();
  dbPath = options.dbPath || process.env.AMELLIFY_DB_PATH || path.join(__dirname, '..', 'amellify.db');

  if (fs.existsSync(dbPath)) {
    db = new SQL.Database(fs.readFileSync(dbPath));
  } else {
    db = new SQL.Database();
  }

  ensureBaseTables(db);
  runMigrations(db);
  auth.seedAdminUser(db, saveDatabase);
  saveDatabase();
  return db;
}

function getDatabase() {
  if (!db) throw new Error('Base de datos no inicializada');
  return db;
}

function saveDatabase() {
  if (!db || !dbPath) return;
  fs.writeFileSync(dbPath, Buffer.from(db.export()));
}

function insertSchedules(userId, code, schedules) {
  const database = getDatabase();
  const rows = [];
  for (const s of schedules) {
    database.run(
      `INSERT INTO schedules (user_id, course_code, day, start_time, end_time, room)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, code, s.day, s.start_time, s.end_time, s.room || '']
    );

    const idStmt = database.prepare('SELECT last_insert_rowid() as id');
    idStmt.step();
    rows.push({
      id: idStmt.getAsObject().id,
      course_code: code,
      day: s.day,
      start_time: s.start_time,
      end_time: s.end_time,
      room: s.room || '',
    });
    idStmt.free();
  }
  return rows;
}

function getCourses(userId) {
  const database = getDatabase();
  const stmt = database.prepare('SELECT * FROM courses WHERE user_id = ? ORDER BY code');
  stmt.bind([userId]);
  const courses = [];

  while (stmt.step()) {
    const course = stmt.getAsObject();
    const schedStmt = database.prepare(
      'SELECT * FROM schedules WHERE course_code = ? AND user_id = ?'
    );
    schedStmt.bind([course.code, userId]);
    const schedules = [];
    while (schedStmt.step()) schedules.push(schedStmt.getAsObject());
    schedStmt.free();
    courses.push({ ...course, schedules, partials: parsePartials(course.partials) });
  }
  stmt.free();
  return courses;
}

function getCourseByCode(userId, code) {
  const database = getDatabase();
  const stmt = database.prepare('SELECT * FROM courses WHERE code = ? AND user_id = ?');
  stmt.bind([code.toUpperCase(), userId]);

  if (!stmt.step()) {
    stmt.free();
    return null;
  }

  const course = stmt.getAsObject();
  stmt.free();

  const schedStmt = database.prepare(
    'SELECT * FROM schedules WHERE course_code = ? AND user_id = ?'
  );
  schedStmt.bind([code.toUpperCase(), userId]);
  const schedules = [];
  while (schedStmt.step()) schedules.push(schedStmt.getAsObject());
  schedStmt.free();

  return { ...course, schedules, partials: parsePartials(course.partials) };
}

function createCourse(userId, body) {
  const database = getDatabase();
  const code = (body.code || '').trim().toUpperCase();
  const name = (body.name || '').trim().toUpperCase();

  if (!code || !name) throw new Error('Código y nombre son obligatorios');

  const checkStmt = database.prepare('SELECT code FROM courses WHERE code = ? AND user_id = ?');
  checkStmt.bind([code, userId]);
  if (checkStmt.step()) {
    checkStmt.free();
    throw new Error(`Ya existe una materia con el código ${code}`);
  }
  checkStmt.free();

  database.run(
    `INSERT INTO courses (user_id, code, name, professor, email, faculty, semester, credits, status, notes, color, partials)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      code,
      name,
      body.professor || '',
      body.email || '',
      body.faculty || '',
      body.semester || '',
      parseInt(body.credits, 10) || 3,
      body.status || 'active',
      body.notes || '',
      body.color || 'blue',
      serializePartials(body.partials),
    ]
  );

  const schedules = (body.schedules || []).filter(
    (s) => s.day && s.start_time && s.end_time
  );
  const newSchedules = insertSchedules(userId, code, schedules);

  saveDatabase();
  return {
    code,
    name,
    professor: body.professor || '',
    email: body.email || '',
    faculty: body.faculty || '',
    semester: body.semester || '',
    credits: parseInt(body.credits, 10) || 3,
    status: body.status || 'active',
    notes: body.notes || '',
    color: body.color || 'blue',
    partials: parsePartials(body.partials),
    schedules: newSchedules,
  };
}

function updateCourse(userId, oldCode, body) {
  const database = getDatabase();
  const old = oldCode.toUpperCase();
  const newCode = (body.code || old).trim().toUpperCase();

  if (newCode !== old) {
    const checkStmt = database.prepare(
      'SELECT code FROM courses WHERE code = ? AND user_id = ? AND code != ?'
    );
    checkStmt.bind([newCode, userId, old]);
    if (checkStmt.step()) {
      checkStmt.free();
      throw new Error(`Ya existe una materia con el código ${newCode}`);
    }
    checkStmt.free();
    database.run('UPDATE schedules SET course_code = ? WHERE course_code = ? AND user_id = ?', [
      newCode,
      old,
      userId,
    ]);
  }

  database.run(
    `UPDATE courses SET
      code = ?,
      name = ?,
      professor = ?,
      email = ?,
      faculty = ?,
      semester = ?,
      credits = ?,
      status = ?,
      notes = ?,
      color = ?,
      partials = ?
    WHERE code = ? AND user_id = ?`,
    [
      newCode,
      (body.name || '').trim().toUpperCase(),
      body.professor !== undefined ? body.professor : '',
      body.email !== undefined ? body.email : '',
      body.faculty !== undefined ? body.faculty : '',
      body.semester !== undefined ? body.semester : '',
      parseInt(body.credits, 10) || 3,
      body.status || 'active',
      body.notes !== undefined ? body.notes : '',
      body.color || 'blue',
      serializePartials(body.partials),
      old,
      userId,
    ]
  );

  database.run('DELETE FROM schedules WHERE course_code = ? AND user_id = ?', [newCode, userId]);

  const schedules = (body.schedules || []).filter(
    (s) => s.day && s.start_time && s.end_time
  );
  const newSchedules = insertSchedules(userId, newCode, schedules);

  saveDatabase();
  return {
    code: newCode,
    name: (body.name || '').trim().toUpperCase(),
    professor: body.professor !== undefined ? body.professor : '',
    email: body.email !== undefined ? body.email : '',
    faculty: body.faculty !== undefined ? body.faculty : '',
    semester: body.semester !== undefined ? body.semester : '',
    credits: parseInt(body.credits, 10) || 3,
    status: body.status || 'active',
    notes: body.notes !== undefined ? body.notes : '',
    color: body.color || 'blue',
    partials: parsePartials(body.partials),
    schedules: newSchedules,
  };
}

function deleteCourse(userId, code) {
  const database = getDatabase();
  const upper = code.toUpperCase();
  database.run('DELETE FROM schedules WHERE course_code = ? AND user_id = ?', [upper, userId]);
  database.run('DELETE FROM courses WHERE code = ? AND user_id = ?', [upper, userId]);
  saveDatabase();
  return { success: true, deleted: upper };
}

function getStats(userId) {
  const courses = getCourses(userId);
  const active = courses.filter((c) => c.status === 'active');
  const credits = active.reduce((s, c) => s + (c.credits || 0), 0);

  let totalMins = 0;
  for (const c of active) {
    for (const s of c.schedules || []) {
      const [sh, sm] = s.start_time.split(':').map(Number);
      const [eh, em] = s.end_time.split(':').map(Number);
      totalMins += Math.max(0, eh * 60 + em - (sh * 60 + sm));
    }
  }

  return {
    totalCourses: courses.length,
    totalCredits: credits,
    totalHours: Math.round(totalMins / 60),
  };
}

module.exports = {
  initDatabase,
  getDatabase,
  saveDatabase,
  runMigrations,
  getCourses,
  getCourseByCode,
  createCourse,
  updateCourse,
  deleteCourse,
  getStats,
  insertSchedules,
  parsePartials,
  tableHasColumn,
};
