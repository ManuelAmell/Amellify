/** Cliente API centralizado con autenticación Bearer */
import { getClientOrigin } from './utils.js';

const TOKEN_KEY = 'amellify-auth-token';
const USER_KEY = 'amellify-auth-user';
const SESSION_TOKEN_KEY = 'amellify-auth-token-session';
const SESSION_USER_KEY = 'amellify-auth-user-session';
const REMEMBER_KEY = 'amellify-auth-remember';

function readUser(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function loadStoredAuth() {
  const sessionToken = sessionStorage.getItem(SESSION_TOKEN_KEY);
  if (sessionToken) {
    return {
      token: sessionToken,
      user: readUser(sessionStorage.getItem(SESSION_USER_KEY)),
      remember: false,
    };
  }
  const localToken = localStorage.getItem(TOKEN_KEY);
  if (localToken) {
    return {
      token: localToken,
      user: readUser(localStorage.getItem(USER_KEY)),
      remember: localStorage.getItem(REMEMBER_KEY) !== '0',
    };
  }
  return { token: null, user: null, remember: true };
}

const stored = loadStoredAuth();
let authToken = stored.token;
let currentUser = stored.user;

const base = () => `${getClientOrigin()}/api`;

function clearAuthStorage() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  sessionStorage.removeItem(SESSION_TOKEN_KEY);
  sessionStorage.removeItem(SESSION_USER_KEY);
}

export function getRememberPreference() {
  return localStorage.getItem(REMEMBER_KEY) !== '0';
}

export function setAuthToken(token, user, options = {}) {
  authToken = token || null;
  currentUser = user || null;
  clearAuthStorage();

  if (!token) return;

  const remember = options.remember !== false;
  localStorage.setItem(REMEMBER_KEY, remember ? '1' : '0');

  if (remember) {
    localStorage.setItem(TOKEN_KEY, token);
    if (user) localStorage.setItem(USER_KEY, JSON.stringify(user));
  } else {
    sessionStorage.setItem(SESSION_TOKEN_KEY, token);
    if (user) sessionStorage.setItem(SESSION_USER_KEY, JSON.stringify(user));
  }
}

export function getAuthToken() {
  return authToken;
}

export function getCurrentUser() {
  return currentUser;
}

/** Comprueba si el usuario tiene rol de administrador */
export function isAdmin(user = currentUser) {
  return user?.role === 'admin';
}

export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

let onUnauthorized = null;

async function request(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const sentAuth = !!authToken;
  if (authToken) headers.Authorization = `Bearer ${authToken}`;

  let res;
  try {
    res = await fetch(`${base()}${path}`, {
      ...options,
      headers,
    });
  } catch (err) {
    throw new Error('No se pudo conectar al servidor. Comprueba que Amellify esté en ejecución.');
  }
  const text = await res.text();
  let data = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }
  // Solo invalidar sesión si la petición llevaba token (evita race con 401 tardíos sin auth)
  if (res.status === 401 && !path.startsWith('/auth/') && sentAuth) {
    setAuthToken(null);
    onUnauthorized?.();
  }
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

const HEALTH_TIMEOUT_MS = 5000;

/** Comprueba si el servidor responde (sin autenticación) */
export async function checkServerHealth() {
  try {
    const res = await fetch(`${base()}/health`, {
      method: 'GET',
      cache: 'no-store',
      signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data?.ok === true;
  } catch {
    return false;
  }
}

export const api = {
  register: (body) =>
    request('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  login: (body) =>
    request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  logout: () => request('/auth/logout', { method: 'POST' }),
  me: () => request('/auth/me'),
  updateProfile: (body) =>
    request('/auth/me', { method: 'PATCH', body: JSON.stringify(body) }),
  changePassword: (body) =>
    request('/auth/change-password', { method: 'POST', body: JSON.stringify(body) }),
  health: () => checkServerHealth(),
  forgotPassword: (email) =>
    request('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (token, newPassword) =>
    request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, newPassword }),
    }),

  getCourses: () => request('/courses'),
  getCourse: (code) => request(`/courses/${code}`),
  createCourse: (body) => request('/courses', { method: 'POST', body: JSON.stringify(body) }),
  updateCourse: (code, body) =>
    request(`/courses/${code}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteCourse: (code) => request(`/courses/${code}`, { method: 'DELETE' }),
  duplicateCourse: (code) => request(`/courses/${code}/duplicate`, { method: 'POST' }),
  importCourses: (courses) =>
    request('/import', {
      method: 'POST',
      body: JSON.stringify(Array.isArray(courses) ? courses : { courses }),
    }),
  getStats: () => request('/stats'),
  getStatsExtended: () => request('/stats/extended'),
  getTasks: () => request('/tasks'),
  createTask: (body) => request('/tasks', { method: 'POST', body: JSON.stringify(body) }),
  updateTask: (id, body) =>
    request(`/tasks/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteTask: (id) => request(`/tasks/${id}`, { method: 'DELETE' }),
  getExams: () => request('/exams'),
  createExam: (body) => request('/exams', { method: 'POST', body: JSON.stringify(body) }),
  updateExam: (id, body) =>
    request(`/exams/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteExam: (id) => request(`/exams/${id}`, { method: 'DELETE' }),
  backup: () => request('/backup', { method: 'POST' }),
  listBackups: () => request('/backups'),
  restoreBackup: (file) =>
    request(`/backups/${encodeURIComponent(file)}/restore`, { method: 'POST' }),
  getConfig: (key) => request(`/config/${key}`),
  setConfig: (key, value) =>
    request(`/config/${key}`, { method: 'POST', body: JSON.stringify(value) }),

  createIcsFeed: (rotate = false) =>
    request('/integrations/ics-feed', {
      method: 'POST',
      body: JSON.stringify({ rotate }),
    }),
  getIcsFeedStatus: () => request('/integrations/ics-feed'),
  revokeIcsFeed: () => request('/integrations/ics-feed', { method: 'DELETE' }),
  exportFull: () => request('/export/full'),
  previewIcsUrl: (url) =>
    request('/import/ics-url', { method: 'POST', body: JSON.stringify({ url }) }),
  confirmIcsUrlImport: (preview) =>
    request('/import/ics-url/confirm', { method: 'POST', body: JSON.stringify(preview) }),
  autoBackup: () => request('/backup/auto', { method: 'POST', body: '{}' }),
  getVapidPublic: () => request('/push/vapid-public'),
  pushSubscribe: (subscription) =>
    request('/push/subscribe', { method: 'POST', body: JSON.stringify({ subscription }) }),
  pushUnsubscribe: (body) =>
    request('/push/subscribe', { method: 'DELETE', body: JSON.stringify(body) }),
  googleStatus: () => request('/integrations/google/status'),
  googleAuthUrl: () => request('/integrations/google/auth'),
  googleDisconnect: () => request('/integrations/google', { method: 'DELETE' }),
};

/** API de administración (requiere rol admin) */
export const adminApi = {
  listUsers: () => request('/admin/users'),
  createUser: (body) =>
    request('/admin/users', { method: 'POST', body: JSON.stringify(body) }),
  updateUser: (id, body) =>
    request(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteUser: (id) => request(`/admin/users/${id}`, { method: 'DELETE' }),
};
