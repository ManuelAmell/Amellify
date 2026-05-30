/** Autenticación de usuarios: registro, login, JWT, recuperación de contraseña */

const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const JWT_SECRET =
  process.env.AMELLIFY_JWT_SECRET ||
  crypto.createHash('sha256').update('amellify-dev-secret').digest('hex');
const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;
const BCRYPT_ROUNDS = 10;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ROLES = ['admin', 'user'];
const DEFAULT_ADMIN_EMAIL = 'admin@amellify.local';
const DEFAULT_ADMIN_PASSWORD = 'admin';

function migrateSchedulesForUsers(db) {
  if (tableHasColumn(db, 'schedules', 'user_id')) return;
  try {
    db.run('ALTER TABLE schedules ADD COLUMN user_id INTEGER DEFAULT NULL');
  } catch {
    /* ya existe */
  }
  db.run(`
    UPDATE schedules SET user_id = (
      SELECT user_id FROM courses WHERE courses.code = schedules.course_code LIMIT 1
    ) WHERE user_id IS NULL
  `);
}

function tableHasColumn(db, table, column) {
  const info = db.exec(`PRAGMA table_info(${table})`);
  if (!info.length) return false;
  return info[0].values.some((row) => row[1] === column);
}

function ensureUsersTable(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      role TEXT NOT NULL DEFAULT 'user',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      reset_token TEXT DEFAULT NULL,
      reset_token_expires TEXT DEFAULT NULL
    )
  `);
}

function migrateUsersRole(db) {
  if (tableHasColumn(db, 'users', 'role')) return;
  try {
    db.run("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'");
  } catch {
    /* ya existe */
  }
}

function migrateCoursesForUsers(db) {
  if (tableHasColumn(db, 'courses', 'user_id')) return;

  db.run(`
    CREATE TABLE courses_user (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      professor TEXT DEFAULT '',
      email TEXT DEFAULT '',
      faculty TEXT DEFAULT '',
      semester TEXT DEFAULT '',
      credits INTEGER DEFAULT 3,
      status TEXT DEFAULT 'active',
      notes TEXT DEFAULT '',
      color TEXT DEFAULT 'blue',
      partials TEXT DEFAULT '[]',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, code)
    )
  `);

  const cols = db.exec('PRAGMA table_info(courses)')[0]?.values.map((r) => r[1]) || [];
  const hasPartials = cols.includes('partials');

  if (hasPartials) {
    db.run(`
      INSERT INTO courses_user (id, user_id, code, name, professor, email, faculty, semester, credits, status, notes, color, partials, created_at)
      SELECT id, NULL, code, name, professor, email, faculty, semester, credits, status, notes, color, partials, created_at
      FROM courses
    `);
  } else {
    db.run(`
      INSERT INTO courses_user (id, user_id, code, name, professor, email, faculty, semester, credits, status, notes, color, partials, created_at)
      SELECT id, NULL, code, name, professor, email, faculty, semester, credits, status, notes, color, '[]', created_at
      FROM courses
    `);
  }

  db.run('DROP TABLE courses');
  db.run('ALTER TABLE courses_user RENAME TO courses');
}

function migrateConfigForUsers(db) {
  if (tableHasColumn(db, 'config', 'user_id')) return;

  db.run(`
    CREATE TABLE config_user (
      user_id INTEGER NOT NULL DEFAULT 0,
      key TEXT NOT NULL,
      value TEXT,
      PRIMARY KEY (user_id, key)
    )
  `);
  db.run('INSERT INTO config_user (user_id, key, value) SELECT 0, key, value FROM config');
  db.run('DROP TABLE config');
  db.run('ALTER TABLE config_user RENAME TO config');
}

function migrateAcademicForUsers(db) {
  if (!tableHasColumn(db, 'tasks', 'user_id')) {
    try {
      db.run('ALTER TABLE tasks ADD COLUMN user_id INTEGER DEFAULT NULL');
    } catch {
      /* ya existe */
    }
  }
  if (!tableHasColumn(db, 'exams', 'user_id')) {
    try {
      db.run('ALTER TABLE exams ADD COLUMN user_id INTEGER DEFAULT NULL');
    } catch {
      /* ya existe */
    }
  }
}

function ensureAuthSchema(db) {
  ensureUsersTable(db);
  migrateUsersRole(db);
  migrateCoursesForUsers(db);
  migrateConfigForUsers(db);
  migrateAcademicForUsers(db);
  migrateSchedulesForUsers(db);
}

const ADMIN_EMAIL = DEFAULT_ADMIN_EMAIL;

function isAdminUser(user) {
  return user?.role === 'admin';
}

function normalizeEmail(email) {
  return String(email || '')
    .trim()
    .toLowerCase();
}

function validateEmail(email) {
  return EMAIL_RE.test(email);
}

function validatePassword(password) {
  return typeof password === 'string' && password.length >= 8;
}

function validateRole(role) {
  return ROLES.includes(role);
}

function normalizeRole(role) {
  const value = String(role || 'user').trim().toLowerCase();
  return validateRole(value) ? value : 'user';
}

function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role || 'user',
    created_at: row.created_at,
  };
}

function base64url(buf) {
  return Buffer.from(buf)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function signToken(payload) {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = base64url(
    JSON.stringify({ ...payload, exp: Date.now() + TOKEN_TTL_MS })
  );
  const sig = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `${header}.${body}.${sig}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const expected = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${body}`)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  if (sig !== expected) return null;
  try {
    const json = Buffer.from(body.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();
    const payload = JSON.parse(json);
    if (!payload.sub || !payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function hashPassword(password) {
  return bcrypt.hashSync(password, BCRYPT_ROUNDS);
}

function tokenPayloadForUser(user) {
  return { sub: user.id, email: user.email, role: user.role || 'user' };
}

function shouldSyncAdminCredentials() {
  if (process.env.AMELLIFY_RESET_ADMIN === '1') return true;
  if (process.env.AMELLIFY_DEV_RESET_ADMIN === '1') return true;
  return process.env.NODE_ENV !== 'production';
}

let devAdminCredentialsLogged = false;

function logDevAdminCredentials(email) {
  const show =
    process.env.NODE_ENV !== 'production' || process.env.AMELLIFY_TEST_MODE === '1';
  if (!show || devAdminCredentialsLogged) return;
  devAdminCredentialsLogged = true;
  console.log(`[Amellify] Admin dev: ${email} (ver CREDENCIALES-ADMIN-DEV.txt)`);
}

function seedAdminUser(db, saveDB) {
  const email = normalizeEmail(process.env.AMELLIFY_ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL);
  const password = process.env.AMELLIFY_ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;
  const syncCredentials = shouldSyncAdminCredentials();

  const existing = getUserByEmail(db, email);
  if (existing) {
    let changed = false;
    if (existing.role !== 'admin') {
      db.run("UPDATE users SET role = 'admin' WHERE id = ?", [existing.id]);
      changed = true;
    }
    if (syncCredentials && !comparePassword(password, existing.password_hash)) {
      db.run('UPDATE users SET password_hash = ? WHERE id = ?', [
        hashPassword(password),
        existing.id,
      ]);
      changed = true;
    }
    if (changed && saveDB) saveDB();
    logDevAdminCredentials(email);
    return;
  }

  db.run('INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)', [
    email,
    hashPassword(password),
    'Administrador',
    'admin',
  ]);
  if (saveDB) saveDB();
  logDevAdminCredentials(email);
}

function comparePassword(password, hash) {
  return bcrypt.compareSync(password, hash);
}

function hashResetToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function getUserById(db, id) {
  const stmt = db.prepare('SELECT * FROM users WHERE id = ?');
  stmt.bind([id]);
  if (!stmt.step()) {
    stmt.free();
    return null;
  }
  const row = stmt.getAsObject();
  stmt.free();
  return row;
}

function getUserByEmail(db, email) {
  const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
  stmt.bind([normalizeEmail(email)]);
  if (!stmt.step()) {
    stmt.free();
    return null;
  }
  const row = stmt.getAsObject();
  stmt.free();
  return row;
}

function claimLegacyData(db, userId, saveDB) {
  db.run('UPDATE courses SET user_id = ? WHERE user_id IS NULL', [userId]);
  db.run('UPDATE schedules SET user_id = ? WHERE user_id IS NULL', [userId]);
  db.run('UPDATE tasks SET user_id = ? WHERE user_id IS NULL', [userId]);
  db.run('UPDATE exams SET user_id = ? WHERE user_id IS NULL', [userId]);
  db.run('UPDATE config SET user_id = ? WHERE user_id = 0', [userId]);
  if (saveDB) saveDB();
}

function registerUser(db, { email, password, name }, saveDB) {
  const normalized = normalizeEmail(email);
  if (!validateEmail(normalized)) throw new Error('Correo electrónico inválido');
  if (!validatePassword(password)) {
    throw new Error('La contraseña debe tener al menos 8 caracteres');
  }
  const displayName = String(name || '').trim() || normalized.split('@')[0];
  if (getUserByEmail(db, normalized)) {
    throw new Error('Ya existe una cuenta con ese correo');
  }

  db.run(
    'INSERT INTO users (email, password_hash, name) VALUES (?, ?, ?)',
    [normalized, hashPassword(password), displayName]
  );
  const idStmt = db.prepare('SELECT last_insert_rowid() as id');
  idStmt.step();
  const userId = idStmt.getAsObject().id;
  idStmt.free();

  const isFirstUser =
    db.exec('SELECT COUNT(*) as c FROM users')[0]?.values[0]?.[0] === 1;
  if (isFirstUser) claimLegacyData(db, userId, saveDB);

  const user = getUserById(db, userId);
  const token = signToken(tokenPayloadForUser(user));
  return { user: publicUser(user), token };
}

function loginUser(db, { email, password }, saveDB) {
  const normalized = normalizeEmail(email);
  const user = getUserByEmail(db, normalized);
  if (!user || !comparePassword(password, user.password_hash)) {
    throw new Error('Correo o contraseña incorrectos');
  }

  const legacyCount =
    db.exec('SELECT COUNT(*) FROM courses WHERE user_id IS NULL')[0]?.values[0]?.[0] || 0;
  if (legacyCount > 0) claimLegacyData(db, user.id, saveDB);

  const token = signToken(tokenPayloadForUser(user));
  return { user: publicUser(user), token };
}

function forgotPassword(db, email, saveDB) {
  const normalized = normalizeEmail(email);
  const generic = {
    message:
      'Si el correo está registrado, recibirás instrucciones para restablecer tu contraseña.',
  };

  if (!validateEmail(normalized)) return generic;

  const user = getUserByEmail(db, normalized);
  if (!user) return generic;

  const rawToken = crypto.randomBytes(32).toString('hex');
  const hashed = hashResetToken(rawToken);
  const expires = new Date(Date.now() + RESET_TTL_MS).toISOString();

  db.run('UPDATE users SET reset_token = ?, reset_token_expires = ? WHERE id = ?', [
    hashed,
    expires,
    user.id,
  ]);
  if (saveDB) saveDB();

  const isDev =
    process.env.NODE_ENV !== 'production' || process.env.AMELLIFY_DEV_RESET === '1';
  const resetPath = `/?token=${rawToken}#reset-password`;

  if (isDev) {
    console.log(`\n[Amellify] Enlace de recuperación para ${normalized}:\n  ${resetPath}\n`);
  }

  const result = { ...generic };
  if (isDev || process.env.AMELLIFY_TEST_MODE === '1') {
    result.devResetToken = rawToken;
    result.devResetPath = resetPath;
  }
  return result;
}

function resetPassword(db, token, newPassword, saveDB) {
  if (!token || !validatePassword(newPassword)) {
    throw new Error('Token inválido o contraseña demasiado corta (mín. 8 caracteres)');
  }

  const hashed = hashResetToken(token);
  const stmt = db.prepare(
    'SELECT * FROM users WHERE reset_token = ? AND reset_token_expires > ?'
  );
  const now = new Date().toISOString();
  stmt.bind([hashed, now]);
  if (!stmt.step()) {
    stmt.free();
    throw new Error('Enlace de recuperación inválido o expirado');
  }
  const user = stmt.getAsObject();
  stmt.free();

  db.run(
    'UPDATE users SET password_hash = ?, reset_token = NULL, reset_token_expires = NULL WHERE id = ?',
    [hashPassword(newPassword), user.id]
  );
  if (saveDB) saveDB();
  return { success: true, message: 'Contraseña actualizada. Ya puedes iniciar sesión.' };
}

function extractBearer(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  return null;
}

function requireAuth(db) {
  return (req, res, next) => {
    const token = extractBearer(req);
    const payload = verifyToken(token);
    if (!payload) {
      return res.status(401).json({ error: 'Sesión expirada o no autorizada' });
    }
    const user = getUserById(db, payload.sub);
    if (!user) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }
    req.user = publicUser(user);
    req.userId = user.id;
    next();
  };
}

function optionalAuth(db) {
  return (req, _res, next) => {
    const token = extractBearer(req);
    const payload = verifyToken(token);
    if (payload) {
      const user = getUserById(db, payload.sub);
      if (user) {
        req.user = publicUser(user);
        req.userId = user.id;
      }
    }
    next();
  };
}

function updateUserProfile(db, userId, { name }, saveDB) {
  const displayName = String(name || '').trim();
  if (!displayName) throw new Error('El nombre no puede estar vacío');
  db.run('UPDATE users SET name = ? WHERE id = ?', [displayName, userId]);
  if (saveDB) saveDB();
  return publicUser(getUserById(db, userId));
}

function changeUserPassword(db, userId, { currentPassword, newPassword }, saveDB) {
  const user = getUserById(db, userId);
  if (!user) throw new Error('Usuario no encontrado');
  if (!comparePassword(currentPassword, user.password_hash)) {
    throw new Error('Contraseña actual incorrecta');
  }
  if (!validatePassword(newPassword)) {
    throw new Error('La nueva contraseña debe tener al menos 8 caracteres');
  }
  db.run('UPDATE users SET password_hash = ? WHERE id = ?', [
    hashPassword(newPassword),
    userId,
  ]);
  if (saveDB) saveDB();
  return { success: true, message: 'Contraseña actualizada correctamente' };
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado. Se requiere rol de administrador.' });
  }
  next();
}

function listUsers(db) {
  const stmt = db.prepare(
    'SELECT id, email, name, role, created_at FROM users ORDER BY id ASC'
  );
  const users = [];
  while (stmt.step()) users.push(publicUser(stmt.getAsObject()));
  stmt.free();
  return users;
}

function createUserByAdmin(db, { email, password, name, role }, saveDB) {
  const normalized = normalizeEmail(email);
  if (!validateEmail(normalized)) throw new Error('Correo electrónico inválido');
  if (!validatePassword(password)) {
    throw new Error('La contraseña debe tener al menos 8 caracteres');
  }
  const userRole = normalizeRole(role || 'user');
  if (role && !validateRole(String(role).trim().toLowerCase())) {
    throw new Error('Rol inválido. Use "admin" o "user".');
  }
  const displayName = String(name || '').trim() || normalized.split('@')[0];
  if (getUserByEmail(db, normalized)) {
    throw new Error('Ya existe una cuenta con ese correo');
  }

  db.run(
    'INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)',
    [normalized, hashPassword(password), displayName, userRole]
  );
  const idStmt = db.prepare('SELECT last_insert_rowid() as id');
  idStmt.step();
  const userId = idStmt.getAsObject().id;
  idStmt.free();
  if (saveDB) saveDB();
  return publicUser(getUserById(db, userId));
}

function updateUserByAdmin(db, targetId, { name, role, password }, saveDB) {
  const user = getUserById(db, targetId);
  if (!user) throw new Error('Usuario no encontrado');

  const updates = [];
  const params = [];

  if (name !== undefined) {
    const displayName = String(name || '').trim();
    if (!displayName) throw new Error('El nombre no puede estar vacío');
    updates.push('name = ?');
    params.push(displayName);
  }

  if (role !== undefined) {
    const userRole = String(role).trim().toLowerCase();
    if (!validateRole(userRole)) {
      throw new Error('Rol inválido. Use "admin" o "user".');
    }
    updates.push('role = ?');
    params.push(userRole);
  }

  if (password !== undefined && password !== null && password !== '') {
    if (!validatePassword(password)) {
      throw new Error('La contraseña debe tener al menos 8 caracteres');
    }
    updates.push('password_hash = ?');
    params.push(hashPassword(password));
  }

  if (!updates.length) throw new Error('No hay campos para actualizar');

  params.push(targetId);
  db.run(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, params);
  if (saveDB) saveDB();
  return publicUser(getUserById(db, targetId));
}

function deleteUserByAdmin(db, targetId, actorId, saveDB) {
  if (Number(targetId) === Number(actorId)) {
    throw new Error('No puedes eliminar tu propia cuenta');
  }
  const user = getUserById(db, targetId);
  if (!user) throw new Error('Usuario no encontrado');

  db.run('DELETE FROM schedules WHERE user_id = ?', [targetId]);
  db.run('DELETE FROM courses WHERE user_id = ?', [targetId]);
  db.run('DELETE FROM tasks WHERE user_id = ?', [targetId]);
  db.run('DELETE FROM exams WHERE user_id = ?', [targetId]);
  db.run('DELETE FROM config WHERE user_id = ?', [targetId]);
  db.run('DELETE FROM users WHERE id = ?', [targetId]);
  if (saveDB) saveDB();
  return { success: true, deleted: targetId };
}

function createAdminRouter(db, saveDB) {
  const express = require('express');
  const { apiRateLimit } = require('./security');
  const router = express.Router();

  router.use(requireAuth(db));
  router.use(requireAdmin);
  router.use(apiRateLimit);

  router.get('/users', (_req, res) => {
    try {
      res.json({ users: listUsers(db) });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  });

  router.post('/users', (req, res) => {
    try {
      const user = createUserByAdmin(db, req.body, saveDB);
      res.status(201).json({ user });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.patch('/users/:id', (req, res) => {
    try {
      const targetId = Number(req.params.id);
      if (!Number.isInteger(targetId) || targetId < 1) {
        return res.status(400).json({ error: 'ID de usuario inválido' });
      }
      const user = updateUserByAdmin(db, targetId, req.body, saveDB);
      res.json({ user });
    } catch (err) {
      const status = err.message === 'Usuario no encontrado' ? 404 : 400;
      res.status(status).json({ error: err.message });
    }
  });

  router.delete('/users/:id', (req, res) => {
    try {
      const targetId = Number(req.params.id);
      if (!Number.isInteger(targetId) || targetId < 1) {
        return res.status(400).json({ error: 'ID de usuario inválido' });
      }
      const result = deleteUserByAdmin(db, targetId, req.userId, saveDB);
      res.json(result);
    } catch (err) {
      const status =
        err.message === 'Usuario no encontrado'
          ? 404
          : err.message === 'No puedes eliminar tu propia cuenta'
            ? 403
            : 400;
      res.status(status).json({ error: err.message });
    }
  });

  return router;
}

function createAuthRouter(db, saveDB) {
  const express = require('express');
  const { authRateLimit } = require('./security');
  const router = express.Router();

  router.post('/register', authRateLimit, (req, res) => {
    try {
      const result = registerUser(db, req.body, saveDB);
      res.status(201).json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/login', authRateLimit, (req, res) => {
    try {
      const result = loginUser(db, req.body, saveDB);
      res.json(result);
    } catch (err) {
      res.status(401).json({ error: err.message });
    }
  });

  router.post('/logout', (_req, res) => {
    res.json({ success: true });
  });

  router.get('/me', requireAuth(db), (req, res) => {
    res.json({ user: req.user });
  });

  router.patch('/me', requireAuth(db), (req, res) => {
    try {
      const user = updateUserProfile(db, req.userId, req.body, saveDB);
      res.json({ user });
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/change-password', requireAuth(db), (req, res) => {
    try {
      const result = changeUserPassword(db, req.userId, req.body, saveDB);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/forgot-password', authRateLimit, (req, res) => {
    try {
      const result = forgotPassword(db, req.body.email, saveDB);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  router.post('/reset-password', authRateLimit, (req, res) => {
    try {
      const result = resetPassword(db, req.body.token, req.body.newPassword, saveDB);
      res.json(result);
    } catch (err) {
      res.status(400).json({ error: err.message });
    }
  });

  return router;
}

module.exports = {
  ensureAuthSchema,
  seedAdminUser,
  createAuthRouter,
  createAdminRouter,
  requireAuth,
  requireAdmin,
  optionalAuth,
  verifyToken,
  extractBearer,
  registerUser,
  loginUser,
  forgotPassword,
  resetPassword,
  getUserById,
  claimLegacyData,
  validateEmail,
  validatePassword,
  signToken,
  updateUserProfile,
  changeUserPassword,
  listUsers,
  listAllUsers: listUsers,
  createUserByAdmin,
  updateUserByAdmin,
  deleteUserByAdmin,
  isAdminUser,
  ADMIN_EMAIL: DEFAULT_ADMIN_EMAIL,
  DEFAULT_ADMIN_EMAIL,
};
