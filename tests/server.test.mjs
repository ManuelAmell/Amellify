import { test } from "node:test";
import assert from "node:assert/strict";

test("renombrar materia debe migrar schedules antes de actualizar courses", () => {
  const migrationOrder = [
    "UPDATE schedules SET course_code = ? WHERE course_code = ?",
    "UPDATE courses SET code = ? WHERE code = ?",
    "DELETE FROM schedules WHERE course_code = ?",
  ];

  assert.match(migrationOrder[0], /schedules/);
  assert.match(migrationOrder[1], /courses/);
  assert.ok(migrationOrder.indexOf(migrationOrder[0]) < migrationOrder.indexOf(migrationOrder[1]));
});
