import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { validateImportPayload } = require('../lib/import-validator.js');

test('rechaza payload que no es array', () => {
  const r = validateImportPayload({ foo: 1 });
  assert.equal(r.valid, false);
});

test('acepta materias válidas', () => {
  const r = validateImportPayload({
    courses: [{ code: 'MAT101', name: 'Matemáticas', schedules: [] }],
  });
  assert.equal(r.valid, true);
  assert.equal(r.courses.length, 1);
});

test('rechaza materia sin código', () => {
  const r = validateImportPayload({ courses: [{ name: 'X' }] });
  assert.equal(r.valid, false);
});
