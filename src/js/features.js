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
    this.applyFontSize();
    if (this.settings.theme) {
      document.documentElement.setAttribute('data-theme', this.settings.theme);
      localStorage.setItem('amellify-theme', this.settings.theme);
      this.updateThemeIcon(this.settings.theme);
    }
    this.updateHeaderClassStatus();
    this.refreshNotifications?.();
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
      this.renderAll();
      this.showAlert(`${data.imported} importadas · ${data.skipped} omitidas`, 'success');
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
      await pdf.destroy();
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
      this.showAlert('No se pudo leer el PDF. Asegurate de que sea un archivo válido.', 'error');
    }
  };

  proto.resetPhotoUpload = function () {
    this._pendingPhotoData = null;
    this._pendingIsPdf = false;
    const input = document.getElementById('ia-photo-input');
    if (input) input.value = '';
    const img = document.getElementById('ia-image-preview');
    if (img) img.src = '';
    document.getElementById('ia-image-preview-container').hidden = true;
    const pdfPreview = document.getElementById('ia-pdf-preview');
    if (pdfPreview) { pdfPreview.hidden = true; pdfPreview.innerHTML = ''; }
    document.getElementById('ia-model-select-container').hidden = true;
    document.getElementById('ia-analyze-container').hidden = true;
    const results = document.getElementById('ia-results');
    if (results) { results.hidden = true; results.innerHTML = ''; }
  };

  proto.analyzePhotoWithIA = async function () {
    if (!this._pendingPhotoData) {
      this.showAlert('Primero seleccioná un archivo', 'error');
      return;
    }
    const modelSelect = document.getElementById('ia-model-select');
    const model = modelSelect?.value || 'google/gemini-2.0-flash-001';
    const loadingEl = document.getElementById('ia-loading');
    const analyzeContainer = document.getElementById('ia-analyze-container');
    loadingEl.hidden = false;
    analyzeContainer.hidden = true;
    const images = Array.isArray(this._pendingPhotoData) ? this._pendingPhotoData : [this._pendingPhotoData];
    try {
      const response = await fetch('/api/generate-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          images: images,
          model: model,
        }),
      });
      loadingEl.hidden = true;
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        this.showAlert(err.error || 'Error al analizar el archivo', 'error');
        analyzeContainer.hidden = false;
        return;
      }
      const data = await response.json();
      const courses = data.courses || [];
      if (!courses.length) {
        this.showAlert('No se detectaron materias en el archivo. Intentá con otro modelo.', 'warning');
        analyzeContainer.hidden = false;
        return;
      }
      this._pendingImport = courses;
      this._showAIResults(courses);
    } catch (e) {
      loadingEl.hidden = true;
      this.showAlert(e.message || 'Error al conectar con la IA', 'error');
      analyzeContainer.hidden = false;
    }
  };

  proto._showAIResults = function (courses) {
    const container = document.getElementById('ia-results');
    if (!container) return;
    const invalid = courses.filter((c) => !c?.name);
    container.hidden = false;
    container.innerHTML = `
      <div class="ia-results-header">
        <h4>${icon('check', 'icon-sm')} Análisis completado</h4>
        <p class="muted" style="margin-top:4px;">${courses.length} materias detectadas${invalid.length ? ` · <span style="color:var(--error)">${invalid.length} inválidas</span>` : ''}.</p>
      </div>
      <div style="display:flex;gap:8px;margin-top:12px;">
        <button type="button" class="btn btn-primary" onclick="app.confirmImport()">Confirmar importación</button>
        <button type="button" class="btn btn-secondary" onclick="app.cancelImportPreview()">Cancelar</button>
      </div>`;
  };

  proto._settingsToggleBtn = function (label, iconName, onclick) {
    return `<button type="button" class="btn btn-secondary settings-action-btn" onclick="${onclick}">${icon(iconName, 'icon-sm')} ${label}</button>`;
  };

  proto._buildSettingsTabContent = function (tab) {
    const s = this.settings;
    const pg = this.getPassingGrade();
    const viewOpts = VIEW_OPTIONS.map((v) => `<option value="${v.id}" ${(s.defaultView || 'grid') === v.id ? 'selected' : ''}>${v.label}</option>`).join('');

    if (tab === 'apariencia') {
      return `
        <div class="settings-section">
          <h3 class="settings-section-title">${icon('palette', 'icon-sm')} Apariencia</h3>
          <button type="button" class="btn btn-secondary settings-action-btn" onclick="app.cycleTheme()">${icon('palette', 'icon-sm')} Cambiar tema (4 modos)</button>
          <div class="settings-row">
            <span class="settings-row-label">${icon('file-text', 'icon-sm')} Tamaño de texto</span>
            <div class="settings-btn-group">
              <button type="button" class="btn ${s.fontSize === 'small' ? 'btn-primary' : 'btn-secondary'} btn-small" onclick="app.setFontSize('small')">Pequeño</button>
              <button type="button" class="btn ${s.fontSize === 'normal' ? 'btn-primary' : 'btn-secondary'} btn-small" onclick="app.setFontSize('normal')">Normal</button>
              <button type="button" class="btn ${s.fontSize === 'large' ? 'btn-primary' : 'btn-secondary'} btn-small" onclick="app.setFontSize('large')">Grande</button>
            </div>
          </div>
          ${this._settingsToggleBtn(s.gridCompact ? 'Grid normal' : 'Grid compacto', s.gridCompact ? 'maximize' : 'minimize', 'app.toggleGridCompact()')}
          ${this._settingsToggleBtn(s.listCompact ? 'Lista normal' : 'Lista compacta', s.listCompact ? 'maximize' : 'minimize', 'app.toggleListCompact()')}
        </div>`;
    }

    if (tab === 'horario') {
      return `
        <div class="settings-section">
          <h3 class="settings-section-title">${icon('calendar', 'icon-sm')} Horario</h3>
          <div class="settings-field">
            <label>${icon('grid', 'icon-sm')} Vista inicial</label>
            <select class="form-select" onchange="app.setDefaultView(this.value)">${viewOpts}</select>
          </div>
          <div class="settings-field">
            <label>${icon('calendar', 'icon-sm')} Inicio de semana</label>
            <select class="form-select" onchange="app.setWeekStartsOn(this.value)">
              <option value="monday" ${s.weekStartsOn !== 'sunday' ? 'selected' : ''}>Lunes</option>
              <option value="sunday" ${s.weekStartsOn === 'sunday' ? 'selected' : ''}>Domingo</option>
            </select>
          </div>
          ${this._settingsToggleBtn(s.timeFormat24h !== false ? 'Formato 12 horas' : 'Formato 24 horas', 'clock', 'app.toggleTimeFormat()')}
          ${this._settingsToggleBtn(s.gridDragDisabled ? 'Activar arrastrar clases' : 'Desactivar arrastrar clases', s.gridDragDisabled ? 'edit' : 'lock', 'app.toggleGridDragDisabled()')}
        </div>`;
    }

    if (tab === 'notificaciones') {
      return `
        <div class="settings-section">
          <h3 class="settings-section-title">${icon('bell', 'icon-sm')} Notificaciones</h3>
          ${this._settingsToggleBtn(s.notifications === false ? 'Activar notificaciones de clase' : 'Desactivar notificaciones de clase', s.notifications === false ? 'bell' : 'bell-off', 'app.toggleNotifications()')}
          <div class="settings-field">
            <label>${icon('clock', 'icon-sm')} Recordatorio antes de clase</label>
            <select class="form-select" onchange="app.setNotifyMinutes(Number(this.value))">
              ${[5, 10, 15, 30, 60].map((m) => `<option value="${m}" ${(s.notifyMinutesBefore ?? 15) === m ? 'selected' : ''}>${m} minutos</option>`).join('')}
            </select>
          </div>
        </div>`;
    }

    if (tab === 'calculadora') {
      return `
        <div class="settings-section">
          <h3 class="settings-section-title">${icon('calculator', 'icon-sm')} Calculadora</h3>
          <div class="settings-field">
            <label>${icon('target', 'icon-sm')} Umbral de aprobación</label>
            <input type="number" class="form-input" value="${pg}" min="${GRADE_MIN}" max="${GRADE_MAX}" step="0.01" onchange="app.setPassingGrade(this.value)">
          </div>
        </div>`;
    }

    if (tab === 'datos') {
      return `
        <div class="settings-section">
          <h3 class="settings-section-title">${icon('folder', 'icon-sm')} Gestión de datos</h3>
          <button type="button" class="btn btn-secondary settings-action-btn" onclick="app.exportData()">${icon('download', 'icon-sm')} Exportar JSON</button>
          <button type="button" class="btn btn-secondary settings-action-btn" onclick="app.triggerImport()">${icon('upload', 'icon-sm')} Importar JSON</button>
          <input type="file" id="import-file" accept=".json" hidden>
          <button type="button" class="btn btn-secondary settings-action-btn" onclick="app.exportIcs()">${icon('calendar', 'icon-sm')} Exportar .ics</button>
          <button type="button" class="btn btn-danger settings-action-btn" onclick="app.deleteAllCourses()">${icon('trash', 'icon-sm')} Borrar horario</button>
        </div>`;
    }

    if (tab === 'ia') {
      return `
        <div class="settings-section">
          <h3 class="settings-section-title">${icon('photo', 'icon-sm')} Cargar horario con IA</h3>
          <p class="muted" style="font-size:13px;line-height:1.6;">Subí una foto o un PDF de tu horario de clases y la IA lo analizará automáticamente, extrayendo las materias y horarios en formato JSON listo para importar.</p>
          <div class="ia-upload-area" id="ia-upload-area">
            <input type="file" id="ia-photo-input" accept="image/*,application/pdf" hidden>
            <button type="button" class="btn btn-secondary" onclick="app.triggerPhotoUpload()">
              ${icon('upload', 'icon-sm')} Seleccionar archivo
            </button>
            <div class="ia-upload-hint">Formatos: JPG, PNG, WebP, PDF · Máx. 5 MB</div>
          </div>
          <div id="ia-image-preview-container" hidden class="ia-image-wrapper">
            <img id="ia-image-preview" class="ia-image-preview" alt="Vista previa de la foto">
            <button type="button" class="btn btn-secondary btn-small" onclick="app.resetPhotoUpload()" style="margin-top:8px;">
              ${icon('trash', 'icon-sm')} Cambiar archivo
            </button>
          </div>
          <div id="ia-pdf-preview" class="ia-pdf-preview" hidden></div>
          <div id="ia-model-select-container" hidden style="margin-top:12px;">
            <label style="display:flex;align-items:center;gap:8px;font-size:13px;color:var(--text-secondary);margin-bottom:8px;">
              ${icon('settings', 'icon-sm')} Modelo de IA
            </label>
            <select id="ia-model-select" class="form-select">
              <option value="google/gemini-2.0-flash-001">Gemini 2.0 Flash (rápido · recomendado)</option>
              <option value="google/gemini-2.5-pro">Gemini 2.5 Pro</option>
              <option value="anthropic/claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
              <option value="openai/gpt-4o">GPT-4o</option>
            </select>
          </div>
          <div id="ia-analyze-container" hidden style="margin-top:16px;">
            <button type="button" class="btn btn-primary" onclick="app.analyzePhotoWithIA()">
              ${icon('zap', 'icon-sm')} Analizar horario con IA
            </button>
          </div>
          <div id="ia-loading" class="ia-loading" hidden>
            <div class="ia-loading-spinner">${icon('refresh', 'icon-sm')}</div>
            <span class="ia-loading-text">Analizando horario con IA…</span>
          </div>
          <div id="ia-results" class="ia-results" hidden></div>
          <details class="settings-section" style="margin-top:16px;">
            <summary style="cursor:pointer;font-weight:600;font-size:14px;padding:8px 0;">${icon('search', 'icon-sm')} Copiar prompt (alternativa manual)</summary>
            <div style="display:flex;gap:8px;margin-top:8px;">
              <button class="btn btn-secondary btn-small" id="copy-prompt-btn" onclick="navigator.clipboard.writeText(document.getElementById('ai-prompt-text').textContent).then(()=>{const b=document.getElementById('copy-prompt-btn');const o=b.innerHTML;b.innerHTML='Copiado';setTimeout(()=>b.innerHTML=o,2000)})">${icon('copy', 'icon-sm')} Copiar prompt</button>
            </div>
            <div id="ai-prompt-text" style="font-size:12px;color:var(--text-secondary);line-height:1.7;margin-top:8px;padding:12px;background:var(--bg-tertiary);border-radius:var(--radius-sm);white-space:pre-wrap;font-family:var(--font-mono);">Quiero que actúes como un generador de horarios universitarios en formato JSON. Te voy a pasar una descripción (texto o imagen) de mi horario de clases y debés devolver SOLO un arreglo JSON válido, sin markdown fences, sin explicaciones, sin texto adicional.

FORMATO EXACTO DE SALIDA:
[
  {
    "code": "CALCVEC",
    "name": "Cálculo Vectorial",
    "professor": "Juan Pérez",
    "email": "",
    "faculty": "Ingeniería de Sistemas",
    "semester": "2025-1",
    "credits": 3,
    "status": "active",
    "color": "blue",
    "schedules": [
      { "day": "Lunes", "start_time": "08:40", "end_time": "10:20", "room": "A-301" }
    ],
    "partials": []
  }
]

REGLAS POR CAMPO:
- code: Obligatorio. Máx 8 caracteres, solo mayúsculas, sin espacios, sin acentos. Inventar sigla si no se sabe. NUNCA vacío.
- name: Obligatorio. Nombre completo exacto.
- professor, email, faculty, semester: Opcional, string vacío si no se sabe.
- credits: Obligatorio. Entero 1-6. Default 3.
- status: Siempre "active".
- color: "blue", "red", "green", "orange", "purple", "teal". Default "blue". Distribuir distintos.
- schedules: Array con UNO o MÁS objetos. Una materia que se ve varios días tiene un objeto por cada día.
  - day: Valor EXACTO: "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo". Con mayúscula y tilde. NUNCA en inglés.
  - start_time / end_time: "HH:MM" en 24h, siempre dos dígitos. Ej: "07:00", "08:40", "14:30". Incorrecto: "7:00", "3pm".
  - room: Opcional, string vacío.
- partials: Siempre [].

VALIDACIÓN FINAL:
- Todos los name presentes y no vacíos.
- Todos los code mayúsculas, sin espacios ni acentos, máx 8 chars.
- Todos los day escritos exactamente como en la lista (con mayúscula y tilde).
- Todas las horas en formato "HH:MM" con dos dígitos.
- Días en español, NO en inglés.
- partials siempre [], status siempre "active".
- El JSON debe ser parseable sin errores.

INSTRUCCIÓN: Devolvé SOLAMENTE el arreglo JSON. Sin comillas invertidas, sin explicaciones, sin saludos. Solo [ ... ]. Si necesitás aclarar algo preguntá primero, si está claro producí el JSON directamente.</div>
          </details>`;
    }

    if (tab === 'datos') {
      return `
        <div class="settings-section">
          <h3 class="settings-section-title">${icon('folder', 'icon-sm')} Gestión de datos</h3>
          <button type="button" class="btn btn-secondary settings-action-btn" onclick="app.exportData()">${icon('download', 'icon-sm')} Exportar JSON</button>
          <button type="button" class="btn btn-secondary settings-action-btn" onclick="app.triggerImport()">${icon('upload', 'icon-sm')} Importar JSON</button>
          <input type="file" id="import-file" accept=".json" hidden>
          <button type="button" class="btn btn-secondary settings-action-btn" onclick="app.exportIcs()">${icon('calendar', 'icon-sm')} Exportar .ics</button>
          <button type="button" class="btn btn-danger settings-action-btn" onclick="app.deleteAllCourses()">${icon('trash', 'icon-sm')} Borrar horario</button>
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
