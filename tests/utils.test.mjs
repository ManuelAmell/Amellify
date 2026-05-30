import { test } from "node:test";
import assert from "node:assert/strict";
import {
  escapeHtml,
  escapeJsString,
  calculateFinalGrade,
  evaluatePartials,
  evaluateWithHypothetical,
  computeRequiredGrade,
  validatePartialRows,
  findWeakestPartial,
  CALC_PRESETS,
  validateCourseCode,
  validateScheduleSlot,
  PASSING_GRADE,
  GRADE_MAX,
  formatLocalDateKey,
  statusDot,
  statusLabel,
  priorityDot,
  icon,
  gradeScaleHint,
  scorePasswordStrength,
} from "../src/js/utils.js";

test("escapeHtml neutraliza caracteres peligrosos", () => {
  assert.equal(
    escapeHtml('<script>alert("x")</script>'),
    "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;"
  );
});

test("escapeJsString escapa comillas para atributos onclick", () => {
  assert.equal(escapeJsString("CS'101"), "CS\\'101");
});

test("calculateFinalGrade exige 100% de ponderación", () => {
  assert.equal(
    calculateFinalGrade([
      { grade: 4, percent: 30 },
      { grade: 3, percent: 30 },
    ]),
    null
  );
});

test("calculateFinalGrade calcula promedio ponderado", () => {
  const grade = calculateFinalGrade([
    { grade: 4, percent: 30 },
    { grade: 3, percent: 30 },
    { grade: 5, percent: 40 },
  ]);
  assert.equal(grade, 4.1);
});

test("formatLocalDateKey usa fecha local sin desfase UTC", () => {
  const key = formatLocalDateKey(new Date(2026, 4, 30, 23, 59));
  assert.equal(key, "2026-05-30");
});

test("evaluatePartials detecta ponderación incompleta", () => {
  const r = evaluatePartials([
    { grade: 4, percent: 30 },
    { grade: 3, percent: 30 },
  ]);
  assert.equal(r.isValid, false);
  assert.equal(r.totalPercent, 60);
  assert.equal(r.grade, null);
});

test("evaluatePartials calcula aprobación con umbral 2.96", () => {
  const pass = evaluatePartials([
    { grade: 3, percent: 50 },
    { grade: 3, percent: 50 },
  ]);
  assert.equal(pass.grade, 3);
  assert.equal(pass.passed, true);

  const fail = evaluatePartials([
    { grade: 2.5, percent: 50 },
    { grade: 2.9, percent: 50 },
  ]);
  assert.equal(fail.passed, false);
  assert.equal(PASSING_GRADE, 2.96);
});

test("validateCourseCode exige formato alfanumérico", () => {
  assert.equal(validateCourseCode("cfb0221").valid, true);
  assert.equal(validateCourseCode("cfb0221").code, "CFB0221");
  assert.equal(validateCourseCode("X").valid, false);
});

test("validateScheduleSlot exige fin posterior al inicio", () => {
  assert.equal(
    validateScheduleSlot({ day: "Lunes", start_time: "10:00", end_time: "09:00" }).valid,
    false,
  );
  assert.equal(
    validateScheduleSlot({ day: "Lunes", start_time: "08:00", end_time: "10:00" }).valid,
    true,
  );
});

test("statusDot y statusLabel reflejan estado de materia", () => {
  assert.match(statusDot("active"), /status-dot--active/);
  assert.equal(statusLabel("paused"), "En pausa");
  assert.equal(statusLabel("unknown"), "Activa");
});

test("priorityDot genera clase según prioridad", () => {
  assert.match(priorityDot("high"), /priority-dot--high/);
  assert.match(priorityDot("unknown"), /priority-dot--normal/);
});

test("icon referencia símbolos del sprite", () => {
  assert.match(icon("calendar"), /#icon-calendar/);
  assert.match(icon("check", "icon-md"), /class="icon-md"/);
});

test("computeRequiredGrade calcula nota mínima para aprobar", () => {
  const r = computeRequiredGrade(
    [
      { name: "P1", grade: 3, percent: 50 },
      { name: "P2", grade: "", percent: 50 },
    ],
    PASSING_GRADE,
  );
  assert.equal(r.remainingWeight, 50);
  assert.equal(r.neededRounded, 2.92);
  assert.equal(r.impossible, false);
});

test("computeRequiredGrade detecta meta imposible", () => {
  const r = computeRequiredGrade(
    [
      { name: "P1", grade: 2, percent: 50 },
      { name: "Final", grade: "", percent: 50 },
    ],
    4.5,
  );
  assert.equal(r.impossible, true);
  assert.ok(r.needed > GRADE_MAX);
});

test("evaluateWithHypothetical proyecta con parcial simulado", () => {
  const r = evaluateWithHypothetical(
    [{ name: "P1", grade: 4, percent: 60 }],
    { name: "Final sim", grade: 3.5, percent: 40 },
  );
  assert.equal(r.isValid, true);
  assert.equal(r.grade, 3.8);
});

test("validatePartialRows advierte duplicados y notas inválidas", () => {
  const w = validatePartialRows([
    { name: "P1", grade: 6, percent: 50 },
    { name: "p1", grade: 3, percent: 50 },
  ]);
  assert.equal(w.length, 2);
  assert.equal(w[0].type, "grade-range");
  assert.equal(w[1].type, "duplicate");
});

test("findWeakestPartial identifica el parcial más bajo", () => {
  const w = findWeakestPartial([
    { name: "P1", grade: 4.2, percent: 30 },
    { name: "P2", grade: 2.5, percent: 30 },
    { name: "P3", grade: "", percent: 40 },
  ]);
  assert.equal(w.name, "P2");
  assert.equal(w.grade, 2.5);
});

test("CALC_PRESETS incluye plantillas comunes", () => {
  assert.ok(CALC_PRESETS["2x50"]);
  assert.equal(CALC_PRESETS.p1p2final.partials.length, 3);
});

test("gradeScaleHint menciona escala chilena", () => {
  assert.match(gradeScaleHint(), /0–5/);
  assert.match(gradeScaleHint(), /2\.96/);
});

test("scorePasswordStrength clasifica contraseñas", () => {
  assert.equal(scorePasswordStrength("").level, "empty");
  assert.equal(scorePasswordStrength("abc").level, "weak");
  assert.equal(scorePasswordStrength("abcdefgh").level, "weak");
  assert.equal(scorePasswordStrength("abcdefgh1").level, "fair");
  assert.equal(scorePasswordStrength("Abcdefgh1").level, "good");
  assert.equal(scorePasswordStrength("Abcdefgh1!").level, "strong");
});
