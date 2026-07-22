const COURSES_KEY = 'amellify-courses';
const CONFIG_KEY = 'amellify-config';
const SCHEDULE_ID_KEY = 'amellify-schedule-id';
const COURSE_ID_KEY = 'amellify-course-id';

function readCourses() {
  try {
    return JSON.parse(localStorage.getItem(COURSES_KEY) || '[]');
  } catch {
    return [];
  }
}

function writeCourses(courses) {
  localStorage.setItem(COURSES_KEY, JSON.stringify(courses));
}

function nextId(key) {
  const id = parseInt(localStorage.getItem(key) || '0', 10) + 1;
  localStorage.setItem(key, String(id));
  return id;
}

function readConfig() {
  try {
    return JSON.parse(localStorage.getItem(CONFIG_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeConfig(config) {
  localStorage.setItem(CONFIG_KEY, JSON.stringify(config));
}

function generateUniqueCode(baseCode) {
  const courses = readCourses();
  const existing = courses.filter((c) => c.code.startsWith(baseCode));
  if (existing.length === 0) return baseCode;
  const used = new Set(existing.map((c) => c.code));
  let n = 2;
  while (used.has(`${baseCode}-${n}`)) n++;
  return `${baseCode}-${n}`;
}

export function getCurrentUser() {
  return { id: 1, name: 'Usuario', email: 'local@amellify.app', role: 'user' };
}

export function isAdmin() {
  return false;
}

export function getAuthToken() {
  return null;
}

export function setAuthToken() {}

export function getRememberPreference() {
  return true;
}

export function setUnauthorizedHandler() {}

export async function checkServerHealth() {
  return true;
}

export const api = {
  getCourses: async () => {
    const courses = readCourses();
    return courses;
  },

  getCourse: async (code) => {
    const courses = readCourses();
    return courses.find((c) => c.code === code) || null;
  },

  createCourse: async (body) => {
    const courses = readCourses();
    const code = body.code.toUpperCase();
    if (courses.some((c) => c.code === code)) {
      throw new Error(`Ya existe una materia con el código ${code}`);
    }
    const now = new Date().toISOString();
    const course = {
      id: nextId(COURSE_ID_KEY),
      code,
      name: body.name,
      professor: body.professor || '',
      email: body.email || '',
      faculty: body.faculty || '',
      semester: body.semester || '',
      credits: body.credits || 3,
      status: body.status || 'active',
      notes: body.notes || '',
      color: body.color || 'blue',
      partials: Array.isArray(body.partials) ? body.partials : [],
      schedules: (body.schedules || []).map((s) => ({
        id: nextId(SCHEDULE_ID_KEY),
        day: s.day,
        start_time: s.start_time,
        end_time: s.end_time,
        room: s.room || '',
      })),
      created_at: now,
    };
    courses.push(course);
    writeCourses(courses);
    return course;
  },

  updateCourse: async (code, body) => {
    const courses = readCourses();
    const idx = courses.findIndex((c) => c.code === code);
    if (idx === -1) throw new Error('Materia no encontrada');
    const existing = courses[idx];
    const newCode = body.code ? body.code.toUpperCase() : code;
    if (newCode !== code && courses.some((c) => c.code === newCode)) {
      throw new Error(`Ya existe una materia con el código ${newCode}`);
    }
    const updated = {
      ...existing,
      code: newCode,
      name: body.name !== undefined ? body.name : existing.name,
      professor: body.professor !== undefined ? body.professor : existing.professor,
      email: body.email !== undefined ? body.email : existing.email,
      faculty: body.faculty !== undefined ? body.faculty : existing.faculty,
      semester: body.semester !== undefined ? body.semester : existing.semester,
      credits: body.credits !== undefined ? body.credits : existing.credits,
      status: body.status !== undefined ? body.status : existing.status,
      notes: body.notes !== undefined ? body.notes : existing.notes,
      color: body.color !== undefined ? body.color : existing.color,
      partials: body.partials !== undefined ? body.partials : existing.partials,
      schedules: body.schedules !== undefined
        ? body.schedules.map((s) => ({
            id: s.id || nextId(SCHEDULE_ID_KEY),
            day: s.day,
            start_time: s.start_time,
            end_time: s.end_time,
            room: s.room || '',
          }))
        : existing.schedules,
    };
    courses[idx] = updated;
    writeCourses(courses);
    return updated;
  },

  deleteCourse: async (code) => {
    const courses = readCourses();
    const filtered = courses.filter((c) => c.code !== code);
    if (filtered.length === courses.length) throw new Error('Materia no encontrada');
    writeCourses(filtered);
    return { success: true };
  },

  duplicateCourse: async (code) => {
    const courses = readCourses();
    const original = courses.find((c) => c.code === code);
    if (!original) throw new Error('Materia no encontrada');
    const newCode = generateUniqueCode(code);
    const now = new Date().toISOString();
    const duplicate = {
      ...JSON.parse(JSON.stringify(original)),
      id: nextId(COURSE_ID_KEY),
      code: newCode,
      schedules: (original.schedules || []).map((s) => ({
        ...s,
        id: nextId(SCHEDULE_ID_KEY),
      })),
      created_at: now,
    };
    courses.push(duplicate);
    writeCourses(courses);
    return duplicate;
  },

  importCourses: async (coursesData) => {
    const list = Array.isArray(coursesData) ? coursesData : (coursesData.courses || Object.values(coursesData).find(v => Array.isArray(v)) || []);
    if (!Array.isArray(list)) throw new Error('Formato inválido');
    const courses = readCourses();
    const usedCodes = new Set(courses.map((c) => c.code));
    let imported = 0;
    let skipped = 0;
    for (const item of list) {
      const norm = {};
      for (const [k, v] of Object.entries(item || {})) norm[k.toLowerCase()] = v;
      item.code = norm.code || item.code;
      item.name = norm.name || item.name;
      if (!item.name) { skipped++; continue; }
      let code = item.code ? item.code.toUpperCase() : '';
      if (!code) {
        code = item.name.split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 8) || 'MAT';
      }
      let finalCode = code;
      let n = 2;
      while (usedCodes.has(finalCode)) {
        finalCode = `${code}-${n}`;
        n++;
      }
      usedCodes.add(finalCode);
      const body = { ...item, code: finalCode };
      const now = new Date().toISOString();
      courses.push({
        id: nextId(COURSE_ID_KEY),
        code: finalCode,
        name: body.name,
        professor: body.professor || '',
        email: body.email || '',
        faculty: body.faculty || '',
        semester: body.semester || '',
        credits: body.credits || 3,
        status: body.status || 'active',
        notes: body.notes || '',
        color: body.color || 'blue',
        partials: Array.isArray(body.partials) ? body.partials : [],
        schedules: (body.schedules || []).map((s) => {
          const snorm = {};
          for (const [k, v] of Object.entries(s || {})) snorm[k.toLowerCase()] = v;
          return {
            id: nextId(SCHEDULE_ID_KEY),
            day: snorm.day || s.day,
            start_time: snorm.start_time || s.start_time,
            end_time: snorm.end_time || s.end_time,
            room: snorm.room || s.room || '',
          };
        }),
        created_at: now,
      });
      imported++;
    }
    writeCourses(courses);
    return { imported, skipped };
  },

  getStats: async () => {
    const courses = readCourses();
    const active = courses.filter((c) => c.status === 'active');
    const totalCredits = active.reduce((s, c) => s + (c.credits || 0), 0);
    let weeklyHours = 0;
    for (const c of active) {
      for (const s of c.schedules || []) {
        const [sh, sm] = s.start_time.split(':').map(Number);
        const [eh, em] = s.end_time.split(':').map(Number);
        weeklyHours += Math.max(0, eh * 60 + em - (sh * 60 + sm));
      }
    }
    return {
      totalCourses: courses.length,
      activeCourses: active.length,
      totalCredits,
      totalHours: Math.round(weeklyHours / 60),
    };
  },

  getStatsExtended: async () => {
    const courses = readCourses();
    const active = courses.filter((c) => c.status === 'active');
    const hoursByDay = {};
    for (const c of active) {
      for (const s of c.schedules || []) {
        const [sh, sm] = s.start_time.split(':').map(Number);
        const [eh, em] = s.end_time.split(':').map(Number);
        const hours = Math.max(0, eh * 60 + em - (sh * 60 + sm)) / 60;
        hoursByDay[s.day] = (hoursByDay[s.day] || 0) + hours;
      }
    }
    let totalHours = 0;
    for (const h of Object.values(hoursByDay)) totalHours += h;
    return {
      hoursByDay,
      totalHours: totalHours.toFixed(1),
      weeklyHours: totalHours.toFixed(1),
      pendingTasks: 0,
      upcomingExams: 0,
    };
  },

  getConfig: async (key) => {
    const config = readConfig();
    return { key, value: config[key] || null };
  },

  setConfig: async (key, value) => {
    const config = readConfig();
    config[key] = value;
    writeConfig(config);
    return { success: true };
  },
};
