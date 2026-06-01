/** Tokens de suscripción ICS por usuario (feed de calendario) */

const crypto = require('crypto');
const { generateCalendarIcs } = require('./ics-calendar');

function ensureIcsFeedSchema(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS ics_feed_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL UNIQUE,
      token_hash TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);
  db.run('CREATE INDEX IF NOT EXISTS idx_ics_feed_hash ON ics_feed_tokens(token_hash)');
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function getOrCreateFeedToken(db, userId) {
  ensureIcsFeedSchema(db);
  const stmt = db.prepare('SELECT token_hash FROM ics_feed_tokens WHERE user_id = ?');
  stmt.bind([userId]);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return { hasToken: true, token: null, tokenHash: row.token_hash };
  }
  stmt.free();

  const token = generateToken();
  const tokenHash = hashToken(token);
  db.run(
    'INSERT INTO ics_feed_tokens (user_id, token_hash) VALUES (?, ?)',
    [userId, tokenHash]
  );
  return { hasToken: false, token, tokenHash };
}

function rotateFeedToken(db, userId) {
  ensureIcsFeedSchema(db);
  const token = generateToken();
  const tokenHash = hashToken(token);
  const existing = db.prepare('SELECT id FROM ics_feed_tokens WHERE user_id = ?');
  existing.bind([userId]);
  if (existing.step()) {
    existing.free();
    db.run('UPDATE ics_feed_tokens SET token_hash = ?, created_at = CURRENT_TIMESTAMP WHERE user_id = ?', [
      tokenHash,
      userId,
    ]);
  } else {
    existing.free();
    db.run('INSERT INTO ics_feed_tokens (user_id, token_hash) VALUES (?, ?)', [userId, tokenHash]);
  }
  return token;
}

function revokeFeedToken(db, userId) {
  ensureIcsFeedSchema(db);
  db.run('DELETE FROM ics_feed_tokens WHERE user_id = ?', [userId]);
}

function resolveUserIdByToken(db, token) {
  if (!token || token.length < 16) return null;
  ensureIcsFeedSchema(db);
  const tokenHash = hashToken(token);
  const stmt = db.prepare('SELECT user_id FROM ics_feed_tokens WHERE token_hash = ?');
  stmt.bind([tokenHash]);
  if (!stmt.step()) {
    stmt.free();
    return null;
  }
  const userId = stmt.getAsObject().user_id;
  stmt.free();
  return userId;
}

function buildFeedIcs(db, userId, getCoursesFn, getTasksFn, getExamsFn) {
  const courses = getCoursesFn(userId);
  const tasks = getTasksFn(userId);
  const exams = getExamsFn(userId);
  return generateCalendarIcs(courses, { tasks, exams });
}

module.exports = {
  ensureIcsFeedSchema,
  getOrCreateFeedToken,
  rotateFeedToken,
  revokeFeedToken,
  resolveUserIdByToken,
  buildFeedIcs,
  hashToken,
};
