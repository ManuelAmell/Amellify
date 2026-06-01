/** Exportación completa de datos del usuario */

function buildFullExport(db, userId, getCourses, getTasks, getExams, getConfigKeys) {
  const courses = getCourses(userId);
  const tasks = getTasks(userId);
  const exams = getExams(userId);
  const settings = {};
  for (const key of getConfigKeys()) {
    const stmt = db.prepare('SELECT value FROM config WHERE user_id = ? AND key = ?');
    stmt.bind([userId, key]);
    if (stmt.step()) {
      try {
        settings[key] = JSON.parse(stmt.getAsObject().value);
      } catch {
        settings[key] = stmt.getAsObject().value;
      }
    }
    stmt.free();
  }

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    userId,
    courses,
    tasks,
    exams,
    settings,
  };
}

function shouldAutoBackup(db, userId, intervalDays = 7) {
  const stmt = db.prepare("SELECT value FROM config WHERE user_id = ? AND key = 'last_auto_backup'");
  stmt.bind([userId]);
  if (!stmt.step()) {
    stmt.free();
    return true;
  }
  let last = stmt.getAsObject().value;
  stmt.free();
  try {
    last = JSON.parse(last);
  } catch {
    /* raw string */
  }
  const lastMs = new Date(last).getTime();
  if (Number.isNaN(lastMs)) return true;
  return Date.now() - lastMs >= intervalDays * 24 * 60 * 60 * 1000;
}

function markAutoBackup(db, userId, saveDb) {
  const now = JSON.stringify(new Date().toISOString());
  const existing = db.prepare("SELECT 1 FROM config WHERE user_id = ? AND key = 'last_auto_backup'");
  existing.bind([userId]);
  if (existing.step()) {
    existing.free();
    db.run("UPDATE config SET value = ? WHERE user_id = ? AND key = 'last_auto_backup'", [
      now,
      userId,
    ]);
  } else {
    existing.free();
    db.run("INSERT INTO config (user_id, key, value) VALUES (?, 'last_auto_backup', ?)", [
      userId,
      now,
    ]);
  }
  saveDb?.();
}

module.exports = { buildFullExport, shouldAutoBackup, markAutoBackup };
