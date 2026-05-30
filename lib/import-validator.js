/** Validación de importación JSON */

const MAX_FILE_ITEMS = 200;
const MAX_JSON_BYTES = 2 * 1024 * 1024;

function validateCourse(c, index) {
  const errors = [];
  if (!c || typeof c !== 'object') {
    errors.push(`Ítem ${index}: no es un objeto`);
    return errors;
  }
  if (!c.code || !String(c.code).trim()) errors.push(`Ítem ${index}: falta código`);
  if (!c.name || !String(c.name).trim()) errors.push(`Ítem ${index}: falta nombre`);
  if (c.schedules && !Array.isArray(c.schedules)) {
    errors.push(`Ítem ${index}: schedules debe ser array`);
  }
  return errors;
}

function validateImportPayload(body) {
  const courses = body?.courses ?? body;
  if (!Array.isArray(courses)) {
    return { valid: false, errors: ['Se esperaba un array de materias'] };
  }
  if (courses.length > MAX_FILE_ITEMS) {
    return { valid: false, errors: [`Máximo ${MAX_FILE_ITEMS} materias por importación`] };
  }
  const errors = [];
  courses.forEach((c, i) => errors.push(...validateCourse(c, i + 1)));
  return { valid: errors.length === 0, errors, courses };
}

function importSizeGuard(req, res, next) {
  const len = Number(req.headers['content-length'] || 0);
  if (len > MAX_JSON_BYTES) {
    return res.status(413).json({ error: 'Archivo demasiado grande (máx 2MB)' });
  }
  next();
}

module.exports = { validateImportPayload, importSizeGuard, MAX_FILE_ITEMS };
