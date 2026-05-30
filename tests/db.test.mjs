import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const db = require('../lib/db.js');

let tmpDir;
let dbPath;

before(async () => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'amellify-db-'));
  dbPath = path.join(tmpDir, 'test.db');
  await db.initDatabase({ dbPath });
});

after(() => {
  if (tmpDir && fs.existsSync(tmpDir)) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('schema_migrations registra migraciones aplicadas', () => {
  const database = db.getDatabase();
  const result = database.exec('SELECT id, name FROM schema_migrations ORDER BY id');
  assert.ok(result.length > 0);
  assert.ok(result[0].values.some((row) => row[0] === 1));
});

test('índices en users.email y courses.user_id existen', () => {
  const database = db.getDatabase();
  const indexes = database.exec("SELECT name FROM sqlite_master WHERE type='index'");
  const names = indexes[0]?.values.map((r) => r[0]) || [];
  assert.ok(names.includes('idx_users_email'));
  assert.ok(names.includes('idx_courses_user_id'));
});

test('getCourses devuelve array vacío para usuario sin materias', () => {
  const courses = db.getCourses(99999);
  assert.deepEqual(courses, []);
});
