import { downloadIcs } from './ics.js';
import { AcademicNotificationManager } from './notifications.js';
import { escapeHtml, escapeJsString, formatLocalDateKey, icon, priorityDot, PASSING_GRADE, GRADE_MIN, GRADE_MAX } from './utils.js';
import { api } from './api.js';
import * as pdfjsLib from '../lib/pdf.min.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('../lib/pdf.worker.min.mjs', import.meta.url).href;

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const SCHEDULE_DAYS_MON = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const SCHEDULE_DAYS_SUN = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const VIEW_OPTIONS = [
  { id: 'grid', label: 'Grid semanal' },
  { id: 'week', label: 'Vista semana' },
  { id: 'list', label: 'Lista' },
  { id: 'today', label: 'Hoy' },
  { id: 'month', label: 'Mes' },
  { id: 'calc', label: 'Calculadora' },
  { id: 'stats', label: 'Estadísticas' },
];

export function installFeatures(AmellifyApp) {
  const proto = AmellifyApp.prototype;

  proto.listFilter = { status: '', semester: '', faculty: '', sort: 'default' };
  proto.monthOffset = 0;

  const _init = proto.init;
  proto.init = async function (...args) {
    this.notifications = new AcademicNotificationManager(this);
    await _init.apply(this, args);
  };

  proto._bootstrapFeaturesAfterAuth = async function () {
    try {
      this.maybeShowOnboarding();
      this.updateHeaderClassStatus();
      await this.notifications.requestPermission();
      this.notifications.schedule(this.courses);
      this.loadSettingsFromLocal();
      this.applySettings();
      const dv = this.settings.defaultView;
      if (dv && VIEW_OPTIONS.some((v) => v.id === dv)) {
        this.switchView(dv);
      }
    } catch (err) {
      console.error('Error bootstrapping features:', err);
    }
  };

  const _onAuthenticated = proto.onAuthenticated;
  proto.onAuthenticated = async function (user) {
    await _onAuthenticated.call(this, user);
    await this._bootstrapFeaturesAfterAuth();
  };

  const _renderAll = proto.renderAll;
  proto.renderAll = function () {
    _renderAll.apply(this);
    this.updateHeaderClassStatus();
    this.refreshNotifications?.();
  };

  proto.applySettings = function () {
    document.documentElement.classList.toggle('grid-compact', !!this.settings.gridCompact);
    document.documentElement.classList.toggle('list-compact', !!this.settings.listCompact);
    document.documentElement.setAttribute('data-grid-width', this.settings.gridWidth || 'wide');
    this.applyFontSize();
    if (this.settings.theme) {
      document.documentElement.setAttribute('data-theme', this.settings.theme);
      localStorage.setItem('amellify-theme', this.settings.theme);
      this.updateThemeIcon(this.settings.theme);
    }
    this.updateHeaderClassStatus();
    this.refreshNotifications?.();
  };

  proto.setGridWidth = function (mode) {
    if (!['compact', 'normal', 'wide', 'full'].includes(mode)) return;
    this.settings.gridWidth = mode;
    this.saveSettingsToServer();
    this.applySettings();
    if (this.currentView === 'grid') this.renderGridView();
    document.getElementById('settings-modal')?.remove();
  };

  proto.cycleGridWidth = function () {
    const modes = ['compact', 'normal', 'wide', 'full'];
    const current = this.settings.gridWidth || 'wide';
    const nextIdx = (modes.indexOf(current) + 1) % modes.length;
    this.setGridWidth(modes[nextIdx]);
  };

  proto.getScheduleDays = function () {
    return this.settings.weekStartsOn === 'sunday' ? SCHEDULE_DAYS_SUN : SCHEDULE_DAYS_MON;
  };

  proto.getMonthStartPad = function (firstOfMonth) {
    const d = firstOfMonth.getDay();
    return this.settings.weekStartsOn === 'sunday' ? d : (d + 6) % 7;
  };

  proto.loadSettingsFromLocal = function () {
    const saved = localStorage.getItem('amellify-settings');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        this.settings = { ...this.settings, ...parsed };
        this.applySettings();
      } catch {}
    }
  };

  proto.saveSettingsToServer = function () {
    const theme = document.documentElement.getAttribute('data-theme') || 'light';
    this.settings.theme = theme;
    localStorage.setItem('amellify-settings', JSON.stringify(this.settings));
  };

  proto.exportIcs = function () {
    downloadIcs(this.courses);
    this.showAlert('Calendario .ics exportado', 'success');
    document.getElementById('settings-modal')?.remove();
  };

  proto.duplicateCourse = async function (code) {
    try {
      const data = await api.duplicateCourse(code);
      await this.fetchCourses();
      this.renderAll();
      this.showAlert(`Duplicada: ${data.code}`, 'success');
    } catch (e) {
      this.showAlert(e.message || 'Error al duplicar', 'error');
    }
  };

  proto.refreshNotifications = function () {
    this.notifications?.schedule(this.courses);
  };

  proto.getCurrentClass = function () {
    const todayName = DAY_NAMES[new Date().getDay()];
    const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
    for (const course of this.courses.filter((c) => c.status === 'active')) {
      for (const s of course.schedules || []) {
        if (s.day !== todayName) continue;
        const [sh, sm] = s.start_time.split(':').map(Number);
        const [eh, em] = s.end_time.split(':').map(Number);
        if (nowMin >= sh * 60 + sm && nowMin <= eh * 60 + em) {
          return { course, schedule: s };
        }
      }
    }
    return null;
  };

  proto.updateHeaderClassStatus = function () {
    const el = document.getElementById('class-now-badge');
    if (!el) return;
    if (this.settings.showClassBadge === false) { el.hidden = true; return; }
    const current = this.getCurrentClass();
    if (current) {
      el.hidden = false;
      el.textContent = `En clase: ${current.course.code}`;
      el.title = `${current.course.name} · ${this.formatTimeDisplay(current.schedule.start_time)}–${this.formatTimeDisplay(current.schedule.end_time)}`;
    } else {
      el.hidden = true;
    }
  };

  proto.maybeShowOnboarding = function () {
    if (localStorage.getItem('amellify-onboarding-done')) return;
    if (this.courses.length > 0) { localStorage.setItem('amellify-onboarding-done', '1'); return; }
    document.getElementById('onboarding-modal')?.classList.add('active');
  };

  proto.finishOnboarding = function () {
    localStorage.setItem('amellify-onboarding-done', '1');
    document.getElementById('onboarding-modal')?.classList.remove('active');
    this.openAddCourseModal();
  };

  proto.skipOnboarding = function () {
    localStorage.setItem('amellify-onboarding-done', '1');
    document.getElementById('onboarding-modal')?.classList.remove('active');
  };

  proto.toggleGridCompact = function () {
    this.settings.gridCompact = !this.settings.gridCompact;
    this.saveSettingsToServer();
    this.applySettings();
    if (this.currentView === 'grid') this.renderGridView();
    document.getElementById('settings-modal')?.remove();
  };

  proto.toggleGridDragDisabled = function () {
    this.settings.gridDragDisabled = !this.settings.gridDragDisabled;
    this.saveSettingsToServer();
    this.applySettings();
    if (this.currentView === 'grid') this.renderGridView();
    document.getElementById('settings-modal')?.remove();
  };

  proto.toggleListCompact = function () {
    this.settings.listCompact = !this.settings.listCompact;
    this.saveSettingsToServer();
    this.applySettings();
    if (this.currentView === 'list') this.renderListView();
    document.getElementById('settings-modal')?.remove();
  };

  proto.toggleShowClassBadge = function () {
    this.settings.showClassBadge = this.settings.showClassBadge === false;
    this.saveSettingsToServer();
    this.updateHeaderClassStatus();
    document.getElementById('settings-modal')?.remove();
  };

  proto.toggleConfirmDeleteCourse = function () {
    this.settings.confirmDeleteCourse = this.settings.confirmDeleteCourse === false;
    this.saveSettingsToServer();
    document.getElementById('settings-modal')?.remove();
  };

  proto.toggleTimeFormat = function () {
    this.settings.timeFormat24h = this.settings.timeFormat24h === false;
    this.saveSettingsToServer();
    if (this.currentView === 'grid' || this.currentView === 'week' || this.currentView === 'list') { this.renderView(); }
    this.updateHeaderClassStatus();
    document.getElementById('settings-modal')?.remove();
  };

  proto.setDefaultView = function (view) {
    if (!VIEW_OPTIONS.some((v) => v.id === view)) return;
    this.settings.defaultView = view;
    this.saveSettingsToServer();
  };

  proto.setWeekStartsOn = function (mode) {
    if (mode !== 'monday' && mode !== 'sunday') return;
    this.settings.weekStartsOn = mode;
    this.saveSettingsToServer();
    this.applySettings();
    if (this.currentView === 'grid' || this.currentView === 'week') this.renderView();
    else if (this.currentView === 'month') this.renderMonthView();
  };

  proto.setPassingGrade = function (value) {
    const g = parseFloat(value);
    if (!Number.isFinite(g) || g < GRADE_MIN || g > GRADE_MAX) return;
    this.settings.passingGrade = g;
    this.saveSettingsToServer();
    if (this.currentView === 'calc') this.renderCalcView();
    else if (this.currentView === 'grid') this.renderGridView();
  };

  proto.toggleNotifications = async function () {
    this.settings.notifications = this.settings.notifications === false;
    if (this.settings.notifications !== false) {
      const p = await this.notifications.requestPermission();
      if (p !== 'granted') { this.settings.notifications = false; this.showAlert('Permiso de notificaciones denegado', 'warning'); }
    }
    this.saveSettingsToServer();
    this.notifications.schedule(this.courses);
    document.getElementById('settings-modal')?.remove();
  };

  proto.setNotifyMinutes = function (mins) {
    this.settings.notifyMinutesBefore = mins;
    this.saveSettingsToServer();
    this.notifications.schedule(this.courses);
    this.showSilentNotification(`Recordatorio: ${mins} min antes de clase`);
  };

  proto.openSearch = function () {
    let modal = document.getElementById('search-modal');
    if (!modal) return;
    modal.classList.add('active');
    const input = modal.querySelector('#search-input');
    input.value = '';
    this.runSearch('');
    setTimeout(() => input.focus(), 50);
  };

  proto.closeSearch = function () {
    document.getElementById('search-modal')?.classList.remove('active');
  };

  proto.runSearch = function (q) {
    const results = document.getElementById('search-results');
    if (!results) return;
    const query = q.trim().toLowerCase();
    const items = [];
    for (const c of this.courses) {
      const hay = [c.code, c.name, c.professor, c.faculty, c.semester, c.email].join(' ').toLowerCase();
      if (!query || hay.includes(query)) {
        items.push({ type: 'course', label: `${c.code} — ${c.name}`, action: () => this.openEditCourseModal(c.code) });
      }
      for (const s of c.schedules || []) {
        const sh = `${s.day} ${s.start_time} ${s.room}`.toLowerCase();
        if (query && sh.includes(query)) {
          items.push({ type: 'schedule', label: `${c.code} · ${s.day} ${s.start_time}`, action: () => { this.switchView('grid'); this.goToSchedule(); } });
        }
      }
    }
    if (items.length === 0) { results.innerHTML = '<div class="search-empty">Sin resultados</div>'; return; }
    results.innerHTML = items.slice(0, 20).map((it, i) => `<button type="button" class="search-result-item" data-idx="${i}">${escapeHtml(it.label)}</button>`).join('');
    results.querySelectorAll('.search-result-item').forEach((btn, i) => {
      btn.addEventListener('click', () => { items[i].action(); this.closeSearch(); });
    });
  };

  const _switchView = proto.switchView;
  proto.switchView = function (view) {
    const lf = document.getElementById('list-filters');
    if (lf) lf.hidden = view !== 'list';
    _switchView.call(this, view);
  };

  const _renderView = proto.renderView;
  proto.renderView = function () {
    const views = {
      grid: () => this.renderGridView(),
      week: () => this.renderWeekView(),
      list: () => this.renderListView(),
      calc: () => this.renderCalcView(),
      month: () => this.renderMonthView(),
      today: () => this.renderTodayView(),
    };
    (views[this.currentView] || views.grid)();
  };

  const _fetchCourses = proto.fetchCourses;
  proto.fetchCourses = async function () {
    const result = await _fetchCourses.apply(this, arguments);
    this._coursesFull = [...this.courses];
    return result;
  };

  proto.getFilteredCourses = function () {
    const src = this._coursesFull || this.courses;
    const filtered = src.filter((c) => {
      if (this.listFilter.status && c.status !== this.listFilter.status) return false;
      if (this.listFilter.semester && c.semester !== this.listFilter.semester) return false;
      if (this.listFilter.faculty && c.faculty !== this.listFilter.faculty) return false;
      return true;
    });
    return this.sortCourses(filtered);
  };

  proto.sortCourses = function (courses) {
    const sort = this.listFilter.sort || 'default';
    const sorted = [...courses];
    if (sort === 'code') sorted.sort((a, b) => a.code.localeCompare(b.code, 'es'));
    else if (sort === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name, 'es'));
    return sorted;
  };

  const _renderListView = proto.renderListView;
  proto.renderListView = function () {
    const toolbar = document.getElementById('list-filters');
    if (toolbar) this.renderListFilters(toolbar);
    const saved = this.courses;
    this.courses = this.getFilteredCourses();
    _renderListView.call(this);
    this.courses = saved;
  };

  proto.renderListFilters = function (container) {
    container.hidden = false;
    const src = this._coursesFull || this.courses;
    const semesters = [...new Set(src.map((c) => c.semester).filter(Boolean))];
    const faculties = [...new Set(src.map((c) => c.faculty).filter(Boolean))];
    container.innerHTML = `
      <div class="list-filters glass">
        <select class="form-select" id="filter-status" onchange="app.applyListFilter()">
          <option value="">Todos los estados</option>
          <option value="active">Activas</option>
          <option value="paused">En pausa</option>
          <option value="completed">Completadas</option>
          <option value="dropped">Retiradas</option>
        </select>
        <select class="form-select" id="filter-semester" onchange="app.applyListFilter()">
          <option value="">Todos los semestres</option>
          ${semesters.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('')}
        </select>
        <select class="form-select" id="filter-faculty" onchange="app.applyListFilter()">
          <option value="">Todas las facultades</option>
          ${faculties.map((f) => `<option value="${escapeHtml(f)}">${escapeHtml(f)}</option>`).join('')}
        </select>
        <select class="form-select" id="filter-sort" onchange="app.applyListFilter()">
          <option value="default">Orden predeterminado</option>
          <option value="code">Por código</option>
          <option value="name">Por nombre</option>
        </select>
      </div>`;
    document.getElementById('filter-status').value = this.listFilter.status;
    document.getElementById('filter-semester').value = this.listFilter.semester;
    document.getElementById('filter-faculty').value = this.listFilter.faculty;
    document.getElementById('filter-sort').value = this.listFilter.sort || 'default';
  };

  proto.applyListFilter = function () {
    this.listFilter.status = document.getElementById('filter-status')?.value || '';
    this.listFilter.semester = document.getElementById('filter-semester')?.value || '';
    this.listFilter.faculty = document.getElementById('filter-faculty')?.value || '';
    this.listFilter.sort = document.getElementById('filter-sort')?.value || 'default';
    this.renderListView();
  };

  proto.renderTodayView = function () {
    const container = document.getElementById('view-content');
    const now = new Date();
    const todayName = DAY_NAMES[now.getDay()];
    const classes = [];
    for (const c of this.courses) {
      for (const s of c.schedules || []) {
        if (s.day === todayName) classes.push({ ...s, course: c });
      }
    }
    classes.sort((a, b) => a.start_time.localeCompare(b.start_time));
    const current = this.getCurrentClass();

    container.innerHTML = `
      <div class="panel-glass today-panel scroll-panel view-scroll-panel">
        <h2 class="meta-with-icon">${icon("map-pin", "icon-md")} Hoy — ${escapeHtml(todayName)}</h2>
        ${current ? `<div class="today-now glass status-with-dot">${priorityDot('high')} En curso: <strong>${escapeHtml(current.course.name)}</strong> (${escapeHtml(current.schedule.start_time)}–${escapeHtml(current.schedule.end_time)})</div>` : ''}
        <div class="today-section">
          <h3 class="today-section-title">${icon('clock', 'icon-sm')} Clases</h3>
          ${classes.length ? classes.map((c) => `
            <div class="class-item color-${escapeHtml(c.course.color)}" onclick="app.showClassDetails('${escapeJsString(c.course.code)}', ${Number(c.id) || 0})">
              <div class="class-time">${escapeHtml(c.start_time)} – ${escapeHtml(c.end_time)}</div>
              <div class="class-title">${escapeHtml(c.course.name)}</div>
              <div class="class-details">${escapeHtml(c.course.code)}${c.room ? ` · ${icon("building", "icon-sm")} ${escapeHtml(c.room)}` : ''}</div>
            </div>`).join('') : '<p class="muted">Sin clases hoy</p>'}
        </div>
      </div>`;
  };

  proto.changeMonth = function (delta) {
    this.monthOffset = (this.monthOffset || 0) + delta;
    this.renderMonthView();
  };

  proto.renderMonthView = function () {
    const container = document.getElementById('view-content');
    const now = new Date();
    const viewDate = new Date(now.getFullYear(), now.getMonth() + (this.monthOffset || 0), 1);
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    const startPad = this.getMonthStartPad(first);
    const daysInMonth = last.getDate();
    const isCurrentMonth = this.monthOffset === 0;

    const eventsByDate = {};
    for (const c of this.courses) {
      for (const s of c.schedules || []) {
        const dayIdx = DAY_NAMES.indexOf(s.day);
        if (dayIdx < 0) continue;
        for (let d = 1; d <= daysInMonth; d++) {
          const dt = new Date(year, month, d);
          if (dt.getDay() === dayIdx) {
            const key = formatLocalDateKey(dt);
            const list = eventsByDate[key] ||= [];
            if (!list.some((x) => x.code === c.code && !x.isExam && !x.isTask)) {
              list.push({ code: c.code, name: c.name });
            }
          }
        }
      }
    }

    const todayKey = formatLocalDateKey(now);
    this._monthEventsByDate = eventsByDate;
    let cells = '';
    for (let i = 0; i < startPad; i++) cells += '<div class="cal-cell cal-empty"></div>';
    for (let d = 1; d <= daysInMonth; d++) {
      const key = formatLocalDateKey(new Date(year, month, d));
      const ev = eventsByDate[key] || [];
      const isToday = key === todayKey;
      const hasEvents = ev.length > 0;
      cells += `<div class="cal-cell glass cal-clickable ${isToday ? 'cal-today' : ''} ${hasEvents ? 'cal-has-events' : ''}" role="button" tabindex="0" data-date="${key}" onclick="app.showMonthDayDetail('${key}')" onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();app.showMonthDayDetail('${key}')}">
        <span class="cal-day">${d}</span>
        ${ev.slice(0, 3).map((x) => `<span class="cal-dot" title="${escapeHtml(x.name || '')}">${escapeHtml(x.code || '')}</span>`).join('')}
        ${ev.length > 3 ? `<span class="cal-more">+${ev.length - 3}</span>` : ''}
      </div>`;
    }

    const monthName = viewDate.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
    container.innerHTML = `
      <div class="panel-glass month-view-panel">
        <div class="panel-header">
          <h2>${icon("calendar", "icon-md")} ${monthName}</h2>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-secondary btn-small" onclick="app.changeMonth(-1)">←</button>
            <button class="btn btn-secondary btn-small" onclick="app.monthOffset=0;app.renderMonthView()" ${isCurrentMonth ? 'disabled' : ''}>Hoy</button>
            <button class="btn btn-secondary btn-small" onclick="app.changeMonth(1)">→</button>
          </div>
        </div>
        <div class="cal-grid">${cells}</div>
        <div id="month-day-detail" class="month-day-detail glass" hidden>
          <div class="month-day-detail-head">
            <h3 id="month-day-detail-title"></h3>
            <button type="button" class="btn btn-secondary btn-small" aria-label="Cerrar" onclick="app.closeMonthDayDetail()">${icon("x")}</button>
          </div>
          <div id="month-day-detail-body" class="month-day-detail-body"></div>
        </div>
      </div>`;

    if (this._selectedMonthDay && eventsByDate[this._selectedMonthDay]) {
      this.showMonthDayDetail(this._selectedMonthDay);
    }
  };

  proto.showMonthDayDetail = function (dateKey) {
    this._selectedMonthDay = dateKey;
    const panel = document.getElementById('month-day-detail');
    const title = document.getElementById('month-day-detail-title');
    const body = document.getElementById('month-day-detail-body');
    if (!panel || !title || !body) return;
    const events = this._monthEventsByDate?.[dateKey] || [];
    const dt = new Date(dateKey + 'T12:00:00');
    title.textContent = dt.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
    if (!events.length) {
      body.innerHTML = '<p class="muted">Sin eventos este día</p>';
    } else {
      body.innerHTML = events.map((ev) => {
        return `<div class="month-event-row is-class">
          <span class="month-event-type">${icon('book', 'icon-sm')} Clase</span>
          <strong>${escapeHtml(ev.code || '')}</strong>
          <span class="muted">${escapeHtml(ev.name || '')}</span>
        </div>`;
      }).join('');
    }
    panel.hidden = false;
    document.querySelectorAll('.cal-cell[data-date]').forEach((el) => { el.classList.toggle('cal-selected', el.dataset.date === dateKey); });
  };

  proto.closeMonthDayDetail = function () {
    this._selectedMonthDay = null;
    const panel = document.getElementById('month-day-detail');
    if (panel) panel.hidden = true;
    document.querySelectorAll('.cal-cell.cal-selected').forEach((el) => el.classList.remove('cal-selected'));
  };

  proto.showImportPreview = async function (input) {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { this.showAlert('Archivo demasiado grande (máx 2MB)', 'error'); return; }
    try {
      let raw = await file.text();
      raw = raw.replace(/```(?:json)?\s*([\s\S]*?)```/g, '$1').trim();
      const data = JSON.parse(raw);
      let courses = Array.isArray(data) ? data : data.courses;
      if (!Array.isArray(courses)) {
        const vals = Object.values(data).find(v => Array.isArray(v));
        if (vals) courses = vals;
        else throw new Error('Formato inválido');
      }
      courses = courses.map((c) => {
        if (!c) return c;
        const norm = {};
        for (const [k, v] of Object.entries(c)) {
          norm[k.toLowerCase()] = v;
        }
        return { ...c, ...norm };
      });
      const invalid = courses.filter((c) => !c?.name);
      const preview = document.getElementById('import-preview');
      if (preview) {
        preview.hidden = false;
        preview.innerHTML = `<p><strong>${courses.length}</strong> materias detectadas${invalid.length ? ` · <span style="color:var(--error)">${invalid.length} inválidas</span>` : ''}.</p><button class="btn btn-primary" onclick="app.confirmImport()">Confirmar importación</button><button class="btn btn-secondary" onclick="app.cancelImportPreview()">Cancelar</button>`;
      }
      this._pendingImport = courses;
    } catch (e) { this.showAlert('JSON inválido', 'error'); }
    input.value = '';
  };

  proto.confirmImport = async function () {
    if (!this._pendingImport) return;
    try {
      const data = await api.importCourses(this._pendingImport);
      this._pendingImport = null;
      const p = document.getElementById('import-preview');
      if (p) p.hidden = true;
      const iaResults = document.getElementById('ia-results');
      if (iaResults) { iaResults.hidden = true; iaResults.innerHTML = ''; }
      this._resetAIPhotoState();
      await this.fetchCourses();
      this.currentView = 'grid';
      this.renderAll();
      document.getElementById('settings-modal')?.remove();
      this.showAlert(`✓ ${data.imported} materias importadas al horario`, 'success');
    } catch (e) { this.showAlert(e.message || 'Error al importar', 'error'); }
  };

  proto.cancelImportPreview = function () {
    this._pendingImport = null;
    const p = document.getElementById('import-preview');
    if (p) p.hidden = true;
    this._resetAIPhotoState();
  };

  proto._resetAIPhotoState = function () {
    this._pendingPhotoData = null;
    this._pendingIsPdf = false;
    const iaResults = document.getElementById('ia-results');
    if (iaResults) { iaResults.hidden = true; iaResults.innerHTML = ''; }
    const iaLoading = document.getElementById('ia-loading');
    if (iaLoading) iaLoading.hidden = true;
    const analyzeBtn = document.getElementById('ia-analyze-container');
    if (analyzeBtn) analyzeBtn.hidden = false;
    const img = document.getElementById('ia-image-preview');
    if (img) img.src = '';
    const imageContainer = document.getElementById('ia-image-preview-container');
    if (imageContainer) imageContainer.hidden = true;
    const pdfPreview = document.getElementById('ia-pdf-preview');
    if (pdfPreview) { pdfPreview.hidden = true; pdfPreview.innerHTML = ''; }
  };

  proto.triggerPhotoUpload = function () {
    document.getElementById('ia-photo-input')?.click();
  };

  proto.handlePhotoSelect = async function (input) {
    const file = input.files?.[0];
    if (!file) return;
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      this.showAlert('Formato de archivo no soportado (JPG, PNG, WebP, PDF)', 'error');
      input.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.showAlert('Archivo demasiado grande (máximo 5 MB)', 'error');
      input.value = '';
      return;
    }
    this._pendingIsPdf = file.type === 'application/pdf';
    if (this._pendingIsPdf) {
      await this._processPdf(file);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        this._pendingPhotoData = e.target.result;
        const img = document.getElementById('ia-image-preview');
        if (img) img.src = e.target.result;
        document.getElementById('ia-image-preview-container').hidden = false;
        document.getElementById('ia-pdf-preview').hidden = true;
        document.getElementById('ia-model-select-container').hidden = false;
        document.getElementById('ia-analyze-container').hidden = false;
        const results = document.getElementById('ia-results');
        if (results) { results.hidden = true; results.innerHTML = ''; }
      };
      reader.readAsDataURL(file);
    }
    input.value = '';
  };

  proto._processPdf = async function (file) {
    const loadingEl = document.getElementById('ia-loading');
    const analyzeContainer = document.getElementById('ia-analyze-container');
    try {
      loadingEl.hidden = false;
      const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
      const maxPages = 2;
      const pageCount = Math.min(pdf.numPages, maxPages);
      const images = [];
      for (let i = 1; i <= pageCount; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext('2d');
        await page.render({ canvasContext: ctx, viewport }).promise;
        images.push(canvas.toDataURL('image/jpeg', 0.85));
        canvas.remove();
      }
      await pdf.cleanup();
      loadingEl.hidden = true;
      if (!images.length) {
        this.showAlert('No se pudo extraer contenido del PDF', 'error');
        return;
      }
      this._pendingPhotoData = images;
      const pdfPreview = document.getElementById('ia-pdf-preview');
      if (pdfPreview) {
        pdfPreview.hidden = false;
        pdfPreview.innerHTML = `
          <div class="ia-pdf-icon">${icon('file-text', 'icon-sm')}</div>
          <div class="ia-pdf-label">
            <strong>${pdf.numPages > maxPages ? `${pageCount} de ${pdf.numPages}` : pageCount} página${pageCount === 1 ? '' : 's'}</strong>
            <span>${escapeHtml(file.name)}</span>
            ${pdf.numPages > maxPages ? `<span class="ia-pdf-warn">El PDF tiene ${pdf.numPages} páginas. Solo se escanearán las primeras ${maxPages}.</span>` : ''}
          </div>`;
      }
      document.getElementById('ia-image-preview-container').hidden = true;
      document.getElementById('ia-model-select-container').hidden = false;
      document.getElementById('ia-analyze-container').hidden = false;
      const results = document.getElementById('ia-results');
      if (results) { results.hidden = true; results.innerHTML = ''; }
    } catch (e) {
      loadingEl.hidden = true;
      console.error('PDF processing error:', e);
      this.showAlert('No se pudo leer el PDF. Asegurate de que sea un archivo válido.', 'error');
    }
  };

  proto.resetPhotoUpload = function () {
    this._pendingPhotoData = null;
    this._pendingPdfText = null;
    this._pendingIsPdf = false;
    const input = document.getElementById('ia-photo-input');
    if (input) input.value = '';
    const imgContainer = document.getElementById('ia-image-preview-container');
    if (imgContainer) { imgContainer.hidden = true; imgContainer.innerHTML = ''; }
    const pdfPreview = document.getElementById('ia-pdf-preview');
    if (pdfPreview) { pdfPreview.hidden = true; pdfPreview.innerHTML = ''; }
    const analyzeBtn = document.getElementById('ia-analyze-container');
    if (analyzeBtn) analyzeBtn.hidden = true;
    const results = document.getElementById('ia-results');
    if (results) { results.hidden = true; results.innerHTML = ''; }
  };

  proto.analyzePhotoWithIA = async function () {
    if (!this._pendingPhotoData && !this._pendingPdfText) {
      this.showAlert('Primero seleccioná un archivo', 'error');
      return;
    }
    const modelSelect = document.getElementById('ia-model-select');
    const model = modelSelect?.value || 'auto';
    const loadingEl = document.getElementById('ia-loading');
    const analyzeContainer = document.getElementById('ia-analyze-container');
    if (loadingEl) loadingEl.hidden = false;
    if (analyzeContainer) analyzeContainer.hidden = true;

    const payload = { model };
    if (this._pendingPhotoData) {
      payload.images = Array.isArray(this._pendingPhotoData) ? this._pendingPhotoData : [this._pendingPhotoData];
    }
    if (this._pendingPdfText) {
      payload.text = this._pendingPdfText;
    }

    try {
      const response = await fetch('/api/generate-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (loadingEl) loadingEl.hidden = true;
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        this.showAlert(err.error || 'Error al analizar el archivo', 'error');
        if (analyzeContainer) analyzeContainer.hidden = false;
        return;
      }
      const data = await response.json();
      const courses = data.courses || [];
      if (!courses.length) {
        this.showAlert('No se detectaron materias en el archivo. Intentá con otro modelo.', 'warning');
        if (analyzeContainer) analyzeContainer.hidden = false;
        return;
      }
      this._pendingImport = courses;
      this._showAIResults(courses, data.model, model);
    } catch (e) {
      if (loadingEl) loadingEl.hidden = true;
      this.showAlert(e.message || 'Error al conectar con la IA', 'error');
      if (analyzeContainer) analyzeContainer.hidden = false;
    }
  };

  proto._showAIResults = function (courses, usedModel, requestedModel) {
    const container = document.getElementById('ia-results');
    if (!container) return;
    const invalid = courses.filter((c) => !c?.name);
    const validCourses = courses.filter((c) => c && c.name);
    
    let modelBadge = '';
    if (usedModel) {
      const isFallback = requestedModel && requestedModel !== 'auto' && usedModel !== requestedModel;
      if (isFallback) {
        modelBadge = `<div class="ia-fallback-note" style="margin-top:6px;font-size:12px;color:var(--warning);display:flex;align-items:center;gap:4px;">${icon('refresh', 'icon-sm')} El modelo ${escapeHtml(requestedModel)} no respondió. Se usó <strong>${escapeHtml(usedModel)}</strong> automáticamente.</div>`;
      } else {
        modelBadge = `<div class="ia-fallback-note" style="margin-top:6px;font-size:12px;color:var(--success);display:flex;align-items:center;gap:4px;">${icon('check', 'icon-sm')} Procesado exitosamente con <strong>${escapeHtml(usedModel)}</strong></div>`;
      }
    }

    const courseListHtml = validCourses.map(c => 
      `<span style="display:inline-block;padding:2px 8px;border-radius:4px;background:var(--bg-secondary);border:1px solid var(--border);font-size:12px;font-weight:600;margin:2px;">${escapeHtml(c.code || c.name)}</span>`
    ).join('');

    container.hidden = false;
    container.innerHTML = `
      <div class="ia-results-header" style="background:var(--bg-secondary);padding:12px;border-radius:var(--radius-md);border:1px solid var(--border);">
        <h4 style="font-size:15px;margin:0 0 6px 0;color:var(--text-primary);">${icon('check', 'icon-sm')} ¡Información extraída con éxito!</h4>
        <div style="font-size:13px;color:var(--text-secondary);margin-bottom:8px;">
          Se encontraron <strong>${validCourses.length}</strong> materias en tu horario:
        </div>
        <div style="margin-bottom:8px;">${courseListHtml}</div>
        ${modelBadge}
        <div style="display:flex;gap:8px;margin-top:12px;">
          <button type="button" class="btn btn-primary" onclick="app.confirmImport()">${icon('check', 'icon-sm')} Confirmar e importar (${validCourses.length})</button>
          <button type="button" class="btn btn-secondary" onclick="app.cancelImportPreview()">Cancelar</button>
        </div>
      </div>`;
  };

  proto.analyzeTextWithIA = async function () {
    const input = document.getElementById('ia-text-input');
    const text = input?.value.trim();
    if (!text) {
      this.showAlert('Escribí la descripción de tu horario primero', 'error');
      return;
    }
    const modelSelect = document.getElementById('ia-model-select');
    const model = modelSelect?.value || 'auto';
    const loadingEl = document.getElementById('ia-loading');
    if (loadingEl) loadingEl.hidden = false;
    try {
      const response = await fetch('/api/generate-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, model }),
      });
      if (loadingEl) loadingEl.hidden = true;
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Error al procesar la descripción');
      }
      if (!Array.isArray(data.courses) || data.courses.length === 0) {
        throw new Error('La IA no encontró materias en la descripción');
      }
      this._pendingImport = data.courses;
      this._showAIResults(data.courses, data.model, model);
    } catch (e) {
      if (loadingEl) loadingEl.hidden = true;
      this.showAlert(e.message || 'Error al conectar con la IA', 'error');
    }
  };

  proto._compressImage = function (file, maxDim = 1280, quality = 0.8) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        let { width: w, height: h } = img;
        if (w > maxDim || h > maxDim) {
          const ratio = Math.min(maxDim / w, maxDim / h);
          w = Math.round(w * ratio);
          h = Math.round(h * ratio);
        }
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, w, h);
        ctx.drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  };

  proto._processPdf = async function (file) {
    const loadingEl = document.getElementById('ia-loading');
    try {
      if (loadingEl) loadingEl.hidden = false;
      const buffer = await file.arrayBuffer();
      const dataArray = new Uint8Array(buffer);
      const pdf = await pdfjsLib.getDocument({ data: dataArray }).promise;
      const maxPages = 4;
      const pageCount = Math.min(pdf.numPages, maxPages);
      const images = [];
      let pdfText = '';

      for (let i = 1; i <= pageCount; i++) {
        const page = await pdf.getPage(i);
        try {
          const viewport = page.getViewport({ scale: 1.5 });
          const canvas = document.createElement('canvas');
          canvas.width = viewport.width;
          canvas.height = viewport.height;
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          await page.render({ canvasContext: ctx, viewport }).promise;
          images.push(canvas.toDataURL('image/jpeg', 0.8));
          canvas.remove();
        } catch (renderErr) {
          console.warn(`Canvas render fallback for PDF page ${i}:`, renderErr);
        }

        try {
          const textContent = await page.getTextContent();
          const pageStr = textContent.items.map((it) => it.str).join(' ').trim();
          if (pageStr) pdfText += `\n--- PÁGINA ${i} ---\n` + pageStr;
        } catch (textErr) {
          console.warn(`Text content extraction error on page ${i}:`, textErr);
        }
      }

      await pdf.cleanup();
      if (loadingEl) loadingEl.hidden = true;

      if (!images.length && !pdfText.trim()) {
        this.showAlert('No se pudo extraer texto ni imágenes del PDF. Verifica que no esté protegido.', 'error');
        return;
      }

      this._pendingPhotoData = images.length ? images : null;
      this._pendingPdfText = pdfText.trim() || null;

      const pdfPreview = document.getElementById('ia-pdf-preview');
      if (pdfPreview) {
        pdfPreview.hidden = false;
        pdfPreview.innerHTML = `
          <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--bg-secondary);border-radius:var(--radius-md);border:1px solid var(--success);margin-top:8px;">
            <div class="ia-pdf-icon" style="color:var(--success);">${icon('check', 'icon-md')}</div>
            <div class="ia-pdf-label" style="font-size:13px;">
              <strong style="color:var(--text-primary);">✓ PDF procesado: ${pageCount} página${pageCount === 1 ? '' : 's'} listas</strong>
              <div style="color:var(--text-secondary);font-size:12px;">${escapeHtml(file.name)} (${images.length ? `${images.length} imágenes` : 'Texto extraído'})</div>
              ${pdf.numPages > maxPages ? `<span class="ia-pdf-warn" style="color:var(--warning);font-size:11px;">(El PDF tiene ${pdf.numPages} páginas; se analizaron las primeras ${maxPages})</span>` : ''}
            </div>
            <button type="button" class="btn btn-secondary btn-small" onclick="app.resetPhotoUpload()" style="margin-left:auto;">
              ${icon('trash', 'icon-sm')} Cambiar
            </button>
          </div>`;
      }
      const imgContainer = document.getElementById('ia-image-preview-container');
      if (imgContainer) imgContainer.hidden = true;
      const analyzeContainer = document.getElementById('ia-analyze-container');
      if (analyzeContainer) analyzeContainer.hidden = false;
      const results = document.getElementById('ia-results');
      if (results) { results.hidden = true; results.innerHTML = ''; }
    } catch (e) {
      if (loadingEl) loadingEl.hidden = true;
      console.error('PDF processing error:', e);
      this.showAlert(`No se pudo leer el PDF: ${e.message || 'Archivo dañado o protegido'}`, 'error');
    }
  };

  proto.handlePhotoSelect = async function (input) {
    const file = input.files?.[0];
    if (!file) return;
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      this.showAlert('Formato de archivo no soportado (JPG, PNG, WebP, PDF)', 'error');
      input.value = '';
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      this.showAlert('Archivo demasiado grande (máximo 5 MB)', 'error');
      input.value = '';
      return;
    }
    this._pendingIsPdf = file.type === 'application/pdf';
    if (this._pendingIsPdf) {
      await this._processPdf(file);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        this._pendingPhotoData = e.target.result;
        const imgContainer = document.getElementById('ia-image-preview-container');
        if (imgContainer) {
          imgContainer.hidden = false;
          imgContainer.innerHTML = `
            <div style="display:flex;align-items:center;gap:10px;padding:8px 12px;background:var(--bg-secondary);border-radius:var(--radius-md);border:1px solid var(--success);margin-top:8px;">
              <img id="ia-image-preview" src="${e.target.result}" style="width:48px;height:48px;object-fit:cover;border-radius:6px;border:1px solid var(--border);">
              <div style="font-size:13px;">
                <strong style="color:var(--text-primary);">✓ Imagen lista para analizar</strong>
                <div style="color:var(--text-secondary);font-size:12px;">${escapeHtml(file.name)}</div>
              </div>
              <button type="button" class="btn btn-secondary btn-small" onclick="app.resetPhotoUpload()" style="margin-left:auto;">
                ${icon('trash', 'icon-sm')} Cambiar
              </button>
            </div>`;
        }
        document.getElementById('ia-pdf-preview').hidden = true;
        document.getElementById('ia-model-select-container').hidden = false;
        document.getElementById('ia-analyze-container').hidden = false;
        const results = document.getElementById('ia-results');
        if (results) { results.hidden = true; results.innerHTML = ''; }
      };
      reader.readAsDataURL(file);
    }
    input.value = '';
  };

  proto.generateWithAI = async function (event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      this.showAlert('El archivo es demasiado grande (máx 10MB)', 'error');
      event.target.value = '';
      return;
    }
    const statusEl = document.getElementById('ai-import-status');
    const uploadBtn = document.getElementById('ai-upload-btn');
    if (uploadBtn) uploadBtn.disabled = true;
    const isPdf = file.type === 'application/pdf' || file.name.endsWith('.pdf');
    if (statusEl) statusEl.innerHTML = `${icon('clock', 'icon-sm')} Procesando ${isPdf ? 'PDF' : 'imagen'} con IA...`;
    try {
      let b64;
      if (isPdf) {
        b64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
      } else {
        b64 = await this._compressImage(file);
      }
      const res = await fetch('/api/generate-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: b64 }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Error del servidor (${res.status})`);
      }
      if (!Array.isArray(data.courses) || data.courses.length === 0) {
        throw new Error(`La IA no encontró materias en el ${isPdf ? 'PDF' : 'archivo'}`);
      }
      const result = await api.importCourses(data.courses);
      if (statusEl) statusEl.innerHTML = `${icon('check', 'icon-sm')} ${result.imported} materias importadas${result.skipped > 0 ? `, ${result.skipped} omitidas` : ''}`;
      await this.fetchCourses();
      this.renderAll();
      this.showAlert(`${result.imported} materias importadas desde IA`, 'success');
    } catch (e) {
      if (statusEl) statusEl.innerHTML = `${icon('warning', 'icon-sm')} Error: ${escapeHtml(e.message)}`;
      this.showAlert(e.message || 'Error al procesar con IA', 'error');
    } finally {
      if (uploadBtn) uploadBtn.disabled = false;
      event.target.value = '';
    }
  };

  proto.generateWithAIText = async function () {
    const input = document.getElementById('ai-text-input');
    const text = input?.value.trim();
    if (!text) {
      this.showAlert('Escribí la descripción de tu horario primero', 'error');
      return;
    }
    const statusEl = document.getElementById('ai-import-status');
    if (statusEl) statusEl.innerHTML = `${icon('clock', 'icon-sm')} Procesando descripción con IA...`;
    try {
      const res = await fetch('/api/generate-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Error del servidor (${res.status})`);
      }
      if (!Array.isArray(data.courses) || data.courses.length === 0) {
        throw new Error('La IA no encontró materias en la descripción');
      }
      const result = await api.importCourses(data.courses);
      if (statusEl) statusEl.innerHTML = `${icon('check', 'icon-sm')} ${result.imported} materias importadas${result.skipped > 0 ? `, ${result.skipped} omitidas` : ''}`;
      input.value = '';
      await this.fetchCourses();
      this.renderAll();
      this.showAlert(`${result.imported} materias importadas desde IA`, 'success');
    } catch (e) {
      if (statusEl) statusEl.innerHTML = `${icon('warning', 'icon-sm')} Error: ${escapeHtml(e.message)}`;
      this.showAlert(e.message || 'Error al procesar con IA', 'error');
    }
  };

  proto.toggleGridHourRange = function () {
    this.settings.gridHourRange = this.settings.gridHourRange === 'full' ? 'active' : 'full';
    this.saveSettingsToServer();
    if (this.currentView === 'grid') this.renderGridView();
    document.getElementById('settings-modal')?.remove();
  };

  proto._settingsToggleBtn = function (label, iconName, onclick) {
    return `<button type="button" class="btn btn-secondary settings-action-btn" onclick="${onclick}">${icon(iconName, 'icon-sm')} ${label}</button>`;
  };

  proto._buildSettingsTabContent = function (tab) {
    const s = this.settings;
    const pg = this.getPassingGrade();
    const viewOpts = VIEW_OPTIONS.map((v) => `<option value="${v.id}" ${(s.defaultView || 'grid') === v.id ? 'selected' : ''}>${v.label}</option>`).join('');

    if (tab === 'apariencia') {
      const activeThemeName = (document.documentElement.getAttribute('data-theme') || 'light').toUpperCase();
      return `
        <div class="settings-section">
          <h3 class="settings-section-title">${icon('palette', 'icon-sm')} Apariencia</h3>
          <button type="button" class="btn btn-secondary settings-action-btn" onclick="app.cycleTheme()">${icon('palette', 'icon-sm')} Tema actual: <strong>${activeThemeName}</strong> (Click para cambiar)</button>
          <div class="settings-row" style="margin-top:10px;">
            <span class="settings-row-label">${icon('file-text', 'icon-sm')} Tamaño de texto</span>
            <div class="settings-btn-group">
              <button type="button" class="btn ${s.fontSize === 'small' ? 'btn-primary' : 'btn-secondary'} btn-small" onclick="app.setFontSize('small')">Pequeño</button>
              <button type="button" class="btn ${s.fontSize === 'normal' ? 'btn-primary' : 'btn-secondary'} btn-small" onclick="app.setFontSize('normal')">Normal</button>
              <button type="button" class="btn ${s.fontSize === 'large' ? 'btn-primary' : 'btn-secondary'} btn-small" onclick="app.setFontSize('large')">Grande</button>
            </div>
          </div>
          <div class="settings-field" style="margin-top:10px;">
            <label>${icon('maximize', 'icon-sm')} Ancho de pantalla del Grid</label>
            <select class="form-select" onchange="app.setGridWidth(this.value)">
              <option value="compact" ${(s.gridWidth || 'wide') === 'compact' ? 'selected' : ''}>Original (1200px)</option>
              <option value="normal" ${(s.gridWidth || 'wide') === 'normal' ? 'selected' : ''}>Estándar (1400px)</option>
              <option value="wide" ${(s.gridWidth || 'wide') === 'wide' ? 'selected' : ''}>Amplio (1800px · Recomendado)</option>
              <option value="full" ${(s.gridWidth || 'wide') === 'full' ? 'selected' : ''}>Pantalla Completa (100%)</option>
            </select>
          </div>
          ${this._settingsToggleBtn(s.gridCompact ? 'Grid altura normal' : 'Grid compacto', s.gridCompact ? 'maximize' : 'minimize', 'app.toggleGridCompact()')}
          ${this._settingsToggleBtn(s.listCompact ? 'Lista altura normal' : 'Lista compacta', s.listCompact ? 'maximize' : 'minimize', 'app.toggleListCompact()')}
          ${this._settingsToggleBtn(s.showClassBadge !== false ? 'Ocultar badge "En clase"' : 'Mostrar badge "En clase"', 'clock', 'app.toggleShowClassBadge()')}
        </div>`;
    }

    if (tab === 'horario') {
      return `
        <div class="settings-section">
          <h3 class="settings-section-title">${icon('calendar', 'icon-sm')} Configuración de Horario</h3>
          <div class="settings-field">
            <label>${icon('grid', 'icon-sm')} Vista inicial predeterminada</label>
            <select class="form-select" onchange="app.setDefaultView(this.value)">${viewOpts}</select>
          </div>
          <div class="settings-field">
            <label>${icon('calendar', 'icon-sm')} Primer día de la semana</label>
            <select class="form-select" onchange="app.setWeekStartsOn(this.value)">
              <option value="monday" ${s.weekStartsOn !== 'sunday' ? 'selected' : ''}>Lunes</option>
              <option value="sunday" ${s.weekStartsOn === 'sunday' ? 'selected' : ''}>Domingo</option>
            </select>
          </div>
          <div class="settings-field">
            <label>${icon('maximize', 'icon-sm')} Ancho del Grid</label>
            <select class="form-select" onchange="app.setGridWidth(this.value)">
              <option value="compact" ${(s.gridWidth || 'wide') === 'compact' ? 'selected' : ''}>Original (1200px)</option>
              <option value="normal" ${(s.gridWidth || 'wide') === 'normal' ? 'selected' : ''}>Estándar (1400px)</option>
              <option value="wide" ${(s.gridWidth || 'wide') === 'wide' ? 'selected' : ''}>Amplio (1800px)</option>
              <option value="full" ${(s.gridWidth || 'wide') === 'full' ? 'selected' : ''}>Pantalla Completa (100%)</option>
            </select>
          </div>
          ${this._settingsToggleBtn(s.timeFormat24h !== false ? 'Formato 12 horas (AM/PM)' : 'Formato 24 horas', 'clock', 'app.toggleTimeFormat()')}
          ${this._settingsToggleBtn(s.gridHourRange === 'full' ? 'Mostrar solo horas con clase' : 'Mostrar 24 horas completas', 'clock', 'app.toggleGridHourRange()')}
          ${this._settingsToggleBtn(s.gridDragDisabled ? 'Activar arrastrar materias' : 'Desactivar arrastrar materias', s.gridDragDisabled ? 'edit' : 'lock', 'app.toggleGridDragDisabled()')}
          ${this._settingsToggleBtn(s.confirmDeleteCourse !== false ? 'Desactivar confirmación al borrar' : 'Activar confirmación al borrar', 'warning', 'app.toggleConfirmDeleteCourse()')}
        </div>`;
    }

    if (tab === 'notificaciones') {
      return `
        <div class="settings-section">
          <h3 class="settings-section-title">${icon('bell', 'icon-sm')} Notificaciones de Clase</h3>
          ${this._settingsToggleBtn(s.notifications === false ? 'Activar notificaciones' : 'Desactivar notificaciones', s.notifications === false ? 'bell' : 'bell-off', 'app.toggleNotifications()')}
          <div class="settings-field">
            <label>${icon('clock', 'icon-sm')} Avisarme antes de cada clase</label>
            <select class="form-select" onchange="app.setNotifyMinutes(Number(this.value))">
              ${[5, 10, 15, 30, 60].map((m) => `<option value="${m}" ${(s.notifyMinutesBefore ?? 15) === m ? 'selected' : ''}>${m} minutos antes</option>`).join('')}
            </select>
          </div>
        </div>`;
    }

    if (tab === 'calculadora') {
      return `
        <div class="settings-section">
          <h3 class="settings-section-title">${icon('calculator', 'icon-sm')} Promedios y Umbrales</h3>
          <div class="settings-field">
            <label>${icon('target', 'icon-sm')} Nota mínima para aprobar</label>
            <input type="number" class="form-input" value="${pg}" min="${GRADE_MIN}" max="${GRADE_MAX}" step="0.1" onchange="app.setPassingGrade(this.value)">
            <p class="muted" style="font-size:12px;margin-top:4px;">Las notas iguales o superiores a este umbral se mostrarán en verde.</p>
          </div>
        </div>`;
    }

    if (tab === 'datos') {
      return `
        <div class="settings-section">
          <h3 class="settings-section-title">${icon('folder', 'icon-sm')} Copias de Seguridad y Datos</h3>
          <button type="button" class="btn btn-secondary settings-action-btn" onclick="app.exportData()">${icon('download', 'icon-sm')} Exportar copia JSON</button>
          <button type="button" class="btn btn-secondary settings-action-btn" onclick="app.triggerImport()">${icon('upload', 'icon-sm')} Importar copia JSON</button>
          <input type="file" id="import-file" accept=".json" hidden>
          <button type="button" class="btn btn-secondary settings-action-btn" onclick="app.exportIcs()">${icon('calendar', 'icon-sm')} Exportar a Calendario (.ics)</button>
          <button type="button" class="btn btn-secondary settings-action-btn" onclick="window.print()">${icon('printer', 'icon-sm')} Imprimir o Guardar en PDF</button>
          <div style="margin-top:16px;border-top:1px solid var(--border);padding-top:12px;">
            <button type="button" class="btn btn-danger settings-action-btn" onclick="app.deleteAllCourses()">${icon('trash', 'icon-sm')} Borrar todas las materias</button>
          </div>
        </div>`;
    }

    if (tab === 'ia') {
      return `
        <div class="settings-section" style="padding-bottom:0;">
          <h3 class="settings-section-title" style="margin-bottom:6px;">${icon('zap', 'icon-sm')} Cargar Horario con IA</h3>
          <p class="muted" style="font-size:12px;line-height:1.4;margin-bottom:10px;">Subí una foto/PDF o escribí tu horario. La IA extraerá automáticamente las materias.</p>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:10px;">
            <div style="background:var(--bg-secondary);padding:10px;border-radius:var(--radius-md);border:1px solid var(--border);">
              <label style="font-size:12px;font-weight:600;display:flex;align-items:center;gap:4px;margin-bottom:6px;">${icon('upload', 'icon-sm')} 1. Foto o PDF</label>
              <input type="file" id="ia-photo-input" accept="image/*,application/pdf" hidden>
              <button type="button" class="btn btn-secondary btn-small" onclick="app.triggerPhotoUpload()" style="width:100%;">
                ${icon('upload', 'icon-sm')} Seleccionar archivo
              </button>
              <div style="font-size:11px;color:var(--text-tertiary);margin-top:4px;text-align:center;">JPG, PNG, WebP, PDF</div>
            </div>

            <div style="background:var(--bg-secondary);padding:10px;border-radius:var(--radius-md);border:1px solid var(--border);">
              <label style="font-size:12px;font-weight:600;display:flex;align-items:center;gap:4px;margin-bottom:6px;">${icon('settings', 'icon-sm')} 2. Modelo de IA</label>
              <select id="ia-model-select" class="form-select" style="font-size:12px;padding:4px 8px;">
                <option value="auto" selected>⚡ Auto-detectar modelo</option>
                <option value="google/gemini-3.6-flash">Gemini 3.6 Flash</option>
                <option value="google/gemini-2.5-flash">Gemini 2.5 Flash</option>
                <option value="google/gemini-2.5-pro">Gemini 2.5 Pro</option>
                <option value="anthropic/claude-sonnet-4.5">Claude Sonnet 4.5</option>
                <option value="openai/gpt-4o">GPT-4o</option>
              </select>
              <div style="font-size:11px;color:var(--text-tertiary);margin-top:4px;text-align:center;">Conmuta si se agota cuota</div>
            </div>
          </div>

          <div id="ia-image-preview-container" hidden></div>
          <div id="ia-pdf-preview" class="ia-pdf-preview" hidden></div>

          <div id="ia-analyze-container" hidden style="margin-top:8px;">
            <button type="button" class="btn btn-primary" onclick="app.analyzePhotoWithIA()" style="width:100%;">
              ${icon('zap', 'icon-sm')} Analizar archivo seleccionado con IA
            </button>
          </div>

          <details style="margin-top:8px;background:var(--bg-secondary);padding:8px 10px;border-radius:var(--radius-md);border:1px solid var(--border);">
            <summary style="cursor:pointer;font-size:12px;font-weight:600;display:flex;align-items:center;gap:6px;">
              ${icon('file-text', 'icon-sm')} O describir horario en texto
            </summary>
            <div style="margin-top:8px;">
              <textarea id="ia-text-input" class="form-input" placeholder="Ej: Lunes 8:40-10:20 Cálculo Vectorial A-301, Martes 10:30-12:10 Física II..." style="min-height:50px;font-size:12px;margin-bottom:6px;"></textarea>
              <button type="button" class="btn btn-primary btn-small" onclick="app.analyzeTextWithIA()">${icon('zap', 'icon-sm')} Analizar texto con IA</button>
            </div>
          </details>

          <div id="ia-loading" class="ia-loading" hidden style="margin-top:8px;padding:10px;">
            <div class="ia-loading-spinner">${icon('refresh', 'icon-sm')}</div>
            <span class="ia-loading-text" style="font-size:13px;">Procesando horario con IA…</span>
          </div>

          <div id="ia-results" class="ia-results" hidden style="margin-top:8px;padding:0;"></div>
        </div>`;
    }

    return `<p class="muted">Sección no encontrada.</p>`;
  };

  const _bindSettingsTabEvents = proto._bindSettingsTabEvents;
  proto._bindSettingsTabEvents = function (modal, tab) {
    _bindSettingsTabEvents.call(this, modal, tab);
    const iaInput = modal.querySelector('#ia-photo-input');
    if (iaInput) iaInput.onchange = function () { app.handlePhotoSelect(this); };
  };

  const _setupEventListeners = proto.setupEventListeners;
  proto.setupEventListeners = function () {
    _setupEventListeners.call(this);

    document.getElementById('search-input')?.addEventListener('input', (e) => { this.runSearch(e.target.value); });
    document.getElementById('search-modal')?.addEventListener('click', (e) => { if (e.target.id === 'search-modal') this.closeSearch(); });

    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); this.openSearch(); }
      if (['6', '7', '8', '9'].includes(e.key) && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const map = { '6': 'month', '7': 'today', '8': 'calc', '9': 'stats' };
        this.switchView(map[e.key]);
      }
    });
  };

  const _openEditCourseModal = proto.openEditCourseModal;
  proto.openEditCourseModal = function (code) {
    _openEditCourseModal.call(this, code);
    const actions = document.getElementById('course-extra-actions');
    if (actions) {
      actions.innerHTML = `<button type="button" class="btn btn-secondary btn-small" onclick="app.duplicateCourse('${escapeJsString(code)}')">${icon("copy")} Duplicar</button>`;
    }
  };
}
