/** Pure helpers shared by app and tests */

export const PASSING_GRADE = 2.96;
export const GRADE_MIN = 0;
export const GRADE_MAX = 5;

/** Plantillas rápidas para la calculadora */
export const CALC_PRESETS = {
  "2x50": {
    label: "2 parciales 50/50",
    partials: [
      { name: "P1", grade: "", percent: 50 },
      { name: "P2", grade: "", percent: 50 },
    ],
  },
  "3x33": {
    label: "3 parciales",
    partials: [
      { name: "P1", grade: "", percent: 33 },
      { name: "P2", grade: "", percent: 33 },
      { name: "P3", grade: "", percent: 34 },
    ],
  },
  p1p2final: {
    label: "P1 + P2 + Final",
    partials: [
      { name: "P1", grade: "", percent: 30 },
      { name: "P2", grade: "", percent: 30 },
      { name: "Final", grade: "", percent: 40 },
    ],
  },
};

export function escapeHtml(value) {
  if (value == null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function escapeJsString(value) {
  if (value == null) return "";
  return String(value).replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

/** Icono SVG desde el sprite de index.html */
export function icon(name, className = "icon-sm") {
  return `<svg class="${className}" aria-hidden="true" focusable="false"><use href="#icon-${name}"></use></svg>`;
}

export const STATUS_LABELS = {
  active: "Activa",
  paused: "En pausa",
  completed: "Completada",
  dropped: "Retirada",
};

export function statusLabel(status) {
  return STATUS_LABELS[status] || STATUS_LABELS.active;
}

/** Punto de color para estado de materia */
export function statusDot(status) {
  const key = STATUS_LABELS[status] ? status : "active";
  return `<span class="status-dot status-dot--${key}" aria-hidden="true"></span>`;
}

/** Punto de color para prioridad de tarea */
export function priorityDot(priority) {
  const key = { high: "high", normal: "normal", low: "low" }[priority] || "normal";
  return `<span class="priority-dot priority-dot--${key}" aria-hidden="true"></span>`;
}

export function timeToMinutes(t) {
  if (!t) return 0;
  const [h, m] = String(t).split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

/** Evalúa parciales: total %, nota proyectada (solo si suma 100%) y aprobación */
export function evaluatePartials(partials, passingGrade = PASSING_GRADE) {
  if (!partials || partials.length === 0) {
    return { totalPercent: 0, grade: null, passed: false, isValid: false, weightedSum: 0 };
  }
  let totalPercent = 0;
  let weightedSum = 0;
  for (const p of partials) {
    const grade = parseFloat(p.grade) || 0;
    const percent = parseFloat(p.percent) || 0;
    weightedSum += grade * percent;
    totalPercent += percent;
  }
  const isValid = totalPercent === 100;
  const grade = isValid ? weightedSum / totalPercent : null;
  const threshold = Number.isFinite(passingGrade) ? passingGrade : PASSING_GRADE;
  return {
    totalPercent,
    grade,
    passed: grade != null && grade >= threshold,
    isValid,
    weightedSum,
  };
}

export function calculateFinalGrade(partials) {
  const { grade, isValid } = evaluatePartials(partials);
  return isValid ? grade : null;
}

function hasEnteredGrade(p) {
  return p.grade !== "" && p.grade != null && !Number.isNaN(parseFloat(p.grade));
}

/** Validación en tiempo real: nombres duplicados y notas fuera de escala 0–5 */
export function validatePartialRows(partials) {
  const warnings = [];
  const seen = new Set();
  for (const p of partials || []) {
    const name = (p.name || "").trim() || "Parcial";
    const key = name.toLowerCase();
    if (seen.has(key)) {
      warnings.push({ type: "duplicate", name, message: `Nombre duplicado: «${name}»` });
    }
    seen.add(key);
    if (hasEnteredGrade(p)) {
      const g = parseFloat(p.grade);
      if (g < GRADE_MIN || g > GRADE_MAX) {
        warnings.push({
          type: "grade-range",
          name,
          message: `«${name}»: nota ${g} fuera de rango (${GRADE_MIN}–${GRADE_MAX})`,
        });
      }
    }
    const pct = parseFloat(p.percent);
    if (!Number.isNaN(pct) && (pct < 0 || pct > 100)) {
      warnings.push({ type: "percent-range", name, message: `«${name}»: peso inválido (${pct}%)` });
    }
  }
  return warnings;
}

/**
 * Nota mínima necesaria en el peso restante para alcanzar la meta.
 * remainingWeight: null → usa 100 − peso de parciales con nota ingresada.
 */
export function computeRequiredGrade(partials, targetGrade = PASSING_GRADE, remainingWeight = null) {
  let weightedSum = 0;
  let enteredWeight = 0;

  for (const p of partials || []) {
    const percent = parseFloat(p.percent) || 0;
    if (hasEnteredGrade(p)) {
      weightedSum += parseFloat(p.grade) * percent;
      enteredWeight += percent;
    }
  }

  const remaining =
    remainingWeight != null && remainingWeight !== ""
      ? parseFloat(remainingWeight) || 0
      : Math.max(0, 100 - enteredWeight);

  if (remaining <= 0) {
    return {
      possible: false,
      reason: "no-remaining-weight",
      needed: null,
      remainingWeight: 0,
      targetGrade,
      weightedSum,
    };
  }

  const needed = (targetGrade * 100 - weightedSum) / remaining;

  return {
    possible: true,
    needed,
    neededRounded: Math.ceil(Math.max(GRADE_MIN, needed) * 100) / 100,
    alreadyMet: needed <= GRADE_MIN,
    impossible: needed > GRADE_MAX,
    remainingWeight: remaining,
    targetGrade,
    weightedSum,
    enteredWeight,
  };
}

/** Proyecta nota final incluyendo un parcial hipotético (simulador) */
export function evaluateWithHypothetical(partials, hypothetical) {
  const base = (partials || []).filter((p) => (parseFloat(p.percent) || 0) > 0);
  if (!hypothetical || !(parseFloat(hypothetical.percent) > 0)) {
    return evaluatePartials(base);
  }
  return evaluatePartials([
    ...base,
    {
      name: hypothetical.name || "Simulado",
      grade: hypothetical.grade ?? "",
      percent: hypothetical.percent,
    },
  ]);
}

/** Parcial con la nota más baja entre los ingresados */
export function findWeakestPartial(partials) {
  let weakest = null;
  let minGrade = Infinity;
  for (const p of partials || []) {
    if (!hasEnteredGrade(p)) continue;
    const g = parseFloat(p.grade);
    if (g < minGrade) {
      minGrade = g;
      weakest = { name: (p.name || "").trim() || "Parcial", grade: g, percent: parseFloat(p.percent) || 0 };
    }
  }
  return weakest;
}

/** Etiqueta de escala chilena 0–5 con referencia de aprobación */
export function gradeScaleHint(passingGrade = PASSING_GRADE) {
  const threshold = Number.isFinite(passingGrade) ? passingGrade : PASSING_GRADE;
  return `Escala chilena 0–5 · Aprobación ≥ ${threshold}`;
}

/** Formatea "HH:MM" en 24h o 12h */
export function formatTime(timeStr, use24h = true) {
  if (!timeStr) return "";
  const [hRaw, mRaw] = String(timeStr).split(":");
  const h = Number(hRaw);
  const m = Number(mRaw) || 0;
  if (Number.isNaN(h)) return timeStr;
  if (use24h !== false) {
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  const ap = h >= 12 ? "p.m." : "a.m.";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ap}`;
}

export function validateCourseCode(code) {
  const trimmed = (code || "").trim().toUpperCase();
  if (!trimmed) return { valid: false, code: "", error: "El código es obligatorio" };
  if (!/^[A-Z0-9-]{3,15}$/.test(trimmed)) {
    return {
      valid: false,
      code: trimmed,
      error: "Use 3–15 caracteres alfanuméricos (ej. CFB0221)",
    };
  }
  return { valid: true, code: trimmed, error: null };
}

export function validateScheduleSlot(slot) {
  if (!slot?.day || !slot?.start_time || !slot?.end_time) {
    return { valid: false, error: "Completa día, inicio y fin" };
  }
  if (timeToMinutes(slot.end_time) <= timeToMinutes(slot.start_time)) {
    return { valid: false, error: "La hora de fin debe ser posterior al inicio" };
  }
  return { valid: true, error: null };
}

/** Evalúa fortaleza de contraseña para indicador visual (sin almacenar la clave) */
export function scorePasswordStrength(password) {
  const value = String(password || "");
  if (!value) {
    return { score: 0, label: "", level: "empty", percent: 0 };
  }

  let score = 0;
  if (value.length >= 8) score += 1;
  if (value.length >= 12) score += 1;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
  if (/\d/.test(value)) score += 1;
  if (/[^a-zA-Z0-9]/.test(value)) score += 1;

  const levels = [
    { min: 0, label: "Muy débil", level: "weak" },
    { min: 2, label: "Débil", level: "fair" },
    { min: 3, label: "Buena", level: "good" },
    { min: 4, label: "Fuerte", level: "strong" },
  ];
  const match = [...levels].reverse().find((l) => score >= l.min) || levels[0];
  return {
    score,
    label: match.label,
    level: match.level,
    percent: Math.min(100, Math.round((score / 5) * 100)),
  };
}

export function getClientOrigin() {
  if (typeof window !== "undefined" && window.location?.host) {
    return `${window.location.protocol}//${window.location.host}`;
  }
  return "http://127.0.0.1:3000";
}

/** YYYY-MM-DD en zona horaria local (evita desfase de toISOString) */
export function formatLocalDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
