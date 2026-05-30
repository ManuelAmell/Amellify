/**
 * Extensiones del plan de producto (R1–R8, M1–M4, U3–U4)
 */
import { downloadIcs } from './ics.js';
import { ClassNotificationManager } from './notifications.js';
import { escapeHtml, escapeJsString, formatLocalDateKey, icon, priorityDot, PASSING_GRADE, GRADE_MIN, GRADE_MAX } from './utils.js';
import { api } from './api.js';

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const SCHEDULE_DAYS_MON = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const SCHEDULE_DAYS_SUN = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const VIEW_OPTIONS = [
  { id: 'grid', label: 'Grid semanal' },
  { id: 'week', label: 'Vista semana' },
  { id: 'list', label: 'Lista' },
  { id: 'today', label: 'Hoy' },
  { id: 'tasks', label: 'Tareas' },
  { id: 'exams', label: 'Exámenes' },
  { id: 'month', label: 'Mes' },
  { id: 'calc', label: 'Calculadora' },
  { id: 'stats', label: 'Estadísticas' },
  { id: 'exam-mode', label: 'Modo examen' },
];

export function installFeatures(AmellifyApp) {
  const proto = AmellifyApp.prototype;

  proto.tasks = [];
  proto.exams = [];
  proto.listFilter = { status: '', semester: '', faculty: '', sort: 'default' };
  proto.monthOffset = 0;
  proto._editingTaskId = null;
  proto._editingExamId = null;

  const _init = proto.init;
  proto.init = async function (...args) {
    this.notifications = new ClassNotificationManager(this);
    await _init.apply(this, args);
  };

  proto._bootstrapFeaturesAfterAuth = async function () {
    await Promise.all([this.fetchTasks(), this.fetchExams()]);
    this.maybeShowOnboarding();
    this.updateHeaderClassStatus();
    await this.notifications.requestPermission();
    this.notifications.schedule(this.courses);
    await this.loadSettingsFromServer();
    this.applySettings();
    const dv = this.settings.defaultView;
    if (dv && VIEW_OPTIONS.some((v) => v.id === dv)) {
      this.switchView(dv);
    }
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
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
    this.notifications?.schedule(this.courses);
    this.notifications?.scheduleTasks(this.tasks);
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
    this.notifications?.schedule(this.courses);
    this.notifications?.scheduleTasks(this.tasks);
  };

  proto.getScheduleDays = function () {
    return this.settings.weekStartsOn === 'sunday' ? SCHEDULE_DAYS_SUN : SCHEDULE_DAYS_MON;
  };

  proto.getMonthStartPad = function (firstOfMonth) {
    const d = firstOfMonth.getDay();
    return this.settings.weekStartsOn === 'sunday' ? d : (d + 6) % 7;
  };

  proto.loadSettingsFromServer = async function () {
    try {
      const { value } = await api.getConfig('amellify-settings');
      if (value) {
        const parsed = typeof value === 'string' ? JSON.parse(value) : value;
        this.settings = { ...this.settings, ...parsed };
        this.applySettings();
      }
    } catch (_e) { /* offline */ }
  };

  proto.applyRemoteSettings = function (raw) {
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (!parsed || typeof parsed !== 'object') return;
      this.settings = { ...this.settings, ...parsed };
      this.applySettings();
    } catch (_e) { /* ignore */ }
  };

  proto.saveSettingsToServer = async function () {
    const theme = document.documentElement.getAttribute('data-theme') || 'light';
    this.settings.theme = theme;
    localStorage.setItem('amellify-settings', JSON.stringify(this.settings));
    try {
      await api.setConfig('amellify-settings', this.settings);
    } catch (_e) { /* offline */ }
  };

  proto.fetchTasks = async function () {
    try {
      this.tasks = await api.getTasks();
    } catch (_e) {
      this.tasks = [];
    }
    return this.tasks;
  };

  proto.fetchExams = async function () {
    try {
      this.exams = await api.getExams();
    } catch (_e) {
      this.exams = [];
    }
    return this.exams;
  };

  proto.exportIcs = function () {
    downloadIcs(this.courses);
    this.showAlert('Calendario .ics exportado', 'success');
    document.getElementById('settings-modal')?.remove();
  };

  proto.createBackup = async function () {
    try {
      const data = await api.backup();
      this.showAlert(`Respaldo: ${data.file}`, 'success');
    } catch (e) {
      this.showAlert(e.message || 'Error al crear respaldo', 'error');
    }
    document.getElementById('settings-modal')?.remove();
  };

  proto.showBackupHistory = async function () {
    try {
      const backups = await api.listBackups();
      const body = document.getElementById('modal-body');
      const classModal = document.getElementById('class-modal');
      if (!body || !classModal) return;
      const titleEl = classModal.querySelector('.modal-title');
      if (titleEl) titleEl.textContent = 'Historial de respaldos';
      body.innerHTML = backups.length
        ? `${backups.map((b) => `
          <div class="task-row glass" style="margin-bottom:8px;">
            <div>
              <strong>${escapeHtml(b.file)}</strong>
              <div class="task-meta">${new Date(b.createdAt).toLocaleString('es-MX')} · ${Math.round(b.size / 1024)} KB</div>
            </div>
            <button class="btn btn-primary btn-small" onclick="app.restoreBackup('${escapeJsString(b.file)}')">Restaurar</button>
          </div>`).join('')}
          <button class="btn btn-secondary" style="width:100%;margin-top:12px;" onclick="document.getElementById('class-modal').classList.remove('active')">Cerrar</button>`
        : '<p class="muted">No hay respaldos guardados aún.</p>';
      classModal.classList.add('active');
      document.getElementById('settings-modal')?.remove();
    } catch (e) {
      this.showAlert(e.message || 'Error al listar respaldos', 'error');
    }
  };

  proto.restoreBackup = async function (file) {
    if (!confirm(`¿Restaurar el horario desde "${file}"?\n\nSe reemplazarán todas las materias actuales.`)) return;
    try {
      const data = await api.restoreBackup(file);
      this._skipNextSocketSync = true;
      await this.fetchCourses();
      this.renderAll();
      document.getElementById('class-modal')?.classList.remove('active');
      this.showAlert(`Restauradas ${data.imported} materias`, 'success');
    } catch (e) {
      this.showAlert(e.message || 'Error al restaurar', 'error');
    }
  };

  proto.duplicateCourse = async function (code) {
    try {
      const data = await api.duplicateCourse(code);
      this._skipNextSocketSync = true;
      await this.fetchCourses();
      this.renderAll();
      this.showAlert(`Duplicada: ${data.code}`, 'success');
    } catch (e) {
      this.showAlert(e.message || 'Error al duplicar', 'error');
    }
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
    if (this.settings.showClassBadge === false) {
      el.hidden = true;
      return;
    }
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
    if (this.courses.length > 0) {
      localStorage.setItem('amellify-onboarding-done', '1');
      return;
    }
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

  proto.toggleTaskNotifications = function () {
    this.settings.taskNotifications = this.settings.taskNotifications === false;
    this.saveSettingsToServer();
    this.notifications?.scheduleTasks(this.tasks);
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
    if (this.currentView === 'grid' || this.currentView === 'week' || this.currentView === 'list') {
      this.renderView();
    }
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
      if (p !== 'granted') {
        this.settings.notifications = false;
        this.showAlert('Permiso de notificaciones denegado', 'warning');
      }
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
      const hay = [c.code, c.name, c.professor, c.faculty, c.semester, c.email]
        .join(' ')
        .toLowerCase();
      if (!query || hay.includes(query)) {
        items.push({ type: 'course', label: `${c.code} — ${c.name}`, action: () => this.openEditCourseModal(c.code) });
      }
      for (const s of c.schedules || []) {
        const sh = `${s.day} ${s.start_time} ${s.room}`.toLowerCase();
        if (query && sh.includes(query)) {
          items.push({
            type: 'schedule',
            label: `${c.code} · ${s.day} ${s.start_time}`,
            action: () => { this.switchView('grid'); this.goToSchedule(); },
          });
        }
      }
    }

    for (const t of this.tasks) {
      if (!query || t.title.toLowerCase().includes(query)) {
        items.push({ type: 'task', label: t.title, action: () => this.switchView('tasks') });
      }
    }

    if (items.length === 0) {
      results.innerHTML = '<div class="search-empty">Sin resultados</div>';
      return;
    }

    results.innerHTML = items
      .slice(0, 20)
      .map(
        (it, i) =>
          `<button type="button" class="search-result-item" data-idx="${i}">${escapeHtml(it.label)}</button>`
      )
      .join('');

    results.querySelectorAll('.search-result-item').forEach((btn, i) => {
      btn.addEventListener('click', () => {
        items[i].action();
        this.closeSearch();
      });
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
      tasks: () => this.renderTasksView(),
      exams: () => this.renderExamsView(),
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

  proto.renderTasksView = function () {
    const container = document.getElementById('view-content');
    const pending = this.tasks.filter((t) => !t.completed);
    const done = this.tasks.filter((t) => t.completed);
    const courseOpts = this.courses
      .map((c) => `<option value="${escapeHtml(c.code)}">${escapeHtml(c.code)}</option>`)
      .join('');
    const editing = this._editingTaskId
      ? this.tasks.find((t) => t.id === this._editingTaskId)
      : null;

    container.innerHTML = `
      <div class="panel-glass scroll-panel view-scroll-panel">
        <div class="panel-header">
          <h2>${icon("clipboard", "icon-md")} Tareas y entregas</h2>
          <button class="btn btn-primary btn-small" onclick="app.showTaskForm()">${icon("plus")} Nueva tarea</button>
        </div>
        <div id="task-form-wrap" class="task-form-wrap" ${editing ? '' : 'hidden'}>
          <input class="form-input" id="task-title" placeholder="Título de la tarea" value="${editing ? escapeHtml(editing.title) : ''}">
          <input class="form-input" id="task-due" type="date" value="${editing ? escapeHtml(editing.due_date) : ''}">
          <select class="form-select" id="task-course"><option value="">Sin materia</option>${courseOpts}</select>
          <select class="form-select" id="task-priority">
            <option value="low">Baja</option>
            <option value="normal">Normal</option>
            <option value="high">Alta</option>
          </select>
          <button class="btn btn-primary" onclick="app.saveTask()">${editing ? 'Actualizar' : 'Guardar'}</button>
          ${editing ? '<button class="btn btn-secondary" onclick="app.cancelEditTask()">Cancelar</button>' : ''}
        </div>
        <div class="task-section">
          <h3>Pendientes (${pending.length})</h3>
          ${pending.length ? pending.map((t) => this.taskRowHtml(t)).join('') : '<p class="muted">No hay tareas pendientes</p>'}
        </div>
        <div class="task-section">
          <h3>Completadas (${done.length})</h3>
          ${done.map((t) => this.taskRowHtml(t)).join('') || '<p class="muted">—</p>'}
        </div>
      </div>`;

    if (editing) {
      document.getElementById('task-form-wrap').hidden = false;
      document.getElementById('task-course').value = editing.course_code || '';
      document.getElementById('task-priority').value = editing.priority || 'normal';
    }
  };

  proto.taskRowHtml = function (t) {
    const pri = priorityDot(t.priority);
    return `
      <div class="task-row glass ${t.completed ? 'is-done' : ''}">
        <label><input type="checkbox" ${t.completed ? 'checked' : ''} onchange="app.toggleTask(${t.id}, this.checked)"> ${pri} ${escapeHtml(t.title)}</label>
        <span class="task-meta">${escapeHtml(t.due_date)}${t.course_code ? ` · ${escapeHtml(t.course_code)}` : ''}</span>
        <button class="btn btn-secondary btn-small" aria-label="Editar" onclick="app.editTask(${t.id})">${icon("edit")}</button>
        <button class="btn btn-danger btn-small" aria-label="Eliminar" onclick="app.deleteTask(${t.id})">${icon("x")}</button>
      </div>`;
  };

  proto.editTask = function (id) {
    this._editingTaskId = id;
    this.renderTasksView();
  };

  proto.cancelEditTask = function () {
    this._editingTaskId = null;
    this.renderTasksView();
  };

  proto.showTaskForm = function () {
    this._editingTaskId = null;
    const w = document.getElementById('task-form-wrap');
    if (w) w.hidden = !w.hidden;
  };

  proto.saveTask = async function () {
    const body = {
      title: document.getElementById('task-title').value,
      due_date: document.getElementById('task-due').value,
      course_code: document.getElementById('task-course').value,
      priority: document.getElementById('task-priority').value,
    };
    try {
      if (this._editingTaskId) {
        await api.updateTask(this._editingTaskId, body);
        this._editingTaskId = null;
        this.showAlert('Tarea actualizada', 'success');
      } else {
        await api.createTask(body);
        this.showAlert('Tarea creada', 'success');
      }
      await this.fetchTasks();
      this.renderTasksView();
    } catch (e) {
      this.showAlert(e.message, 'error');
    }
  };

  proto.toggleTask = async function (id, completed) {
    await api.updateTask(id, { completed });
    await this.fetchTasks();
    this.renderTasksView();
  };

  proto.deleteTask = async function (id) {
    await api.deleteTask(id);
    await this.fetchTasks();
    this.renderTasksView();
  };

  proto.renderExamsView = function () {
    const container = document.getElementById('view-content');
    const today = new Date().toISOString().slice(0, 10);
    const upcoming = this.exams.filter((e) => e.exam_date >= today);
    const courseOpts = this.courses
      .map((c) => `<option value="${escapeHtml(c.code)}">${escapeHtml(c.code)} — ${escapeHtml(c.name)}</option>`)
      .join('');
    const editing = this._editingExamId
      ? this.exams.find((e) => e.id === this._editingExamId)
      : null;

    container.innerHTML = `
      <div class="panel-glass scroll-panel view-scroll-panel">
        <div class="panel-header">
          <h2>${icon("file-text", "icon-md")} Exámenes</h2>
          <button class="btn btn-primary btn-small" onclick="app.showExamForm()">${icon("plus")} Nuevo examen</button>
        </div>
        <div id="exam-form-wrap" class="task-form-wrap" ${editing ? '' : 'hidden'}>
          <select class="form-select" id="exam-course">${courseOpts}</select>
          <input class="form-input" id="exam-title" placeholder="Ej. Parcial 1" value="${editing ? escapeHtml(editing.title) : ''}">
          <input class="form-input" id="exam-date" type="date" value="${editing ? escapeHtml(editing.exam_date) : ''}">
          <input class="form-input" id="exam-time" type="time" value="${editing ? escapeHtml(editing.exam_time || '') : ''}">
          <input class="form-input" id="exam-room" placeholder="Aula" value="${editing ? escapeHtml(editing.room || '') : ''}">
          <button class="btn btn-primary" onclick="app.saveExam()">${editing ? 'Actualizar' : 'Guardar'}</button>
          ${editing ? '<button class="btn btn-secondary" onclick="app.cancelEditExam()">Cancelar</button>' : ''}
        </div>
        ${upcoming.length ? upcoming.map((e) => this.examRowHtml(e)).join('') : '<p class="muted">No hay exámenes próximos</p>'}
      </div>`;

    if (editing) {
      document.getElementById('exam-form-wrap').hidden = false;
      document.getElementById('exam-course').value = editing.course_code;
    }
  };

  proto.examRowHtml = function (e) {
    const days = Math.ceil((new Date(e.exam_date) - new Date()) / 86400000);
    return `
      <div class="task-row glass">
        <div><strong>${escapeHtml(e.title)}</strong> · ${escapeHtml(e.course_code)}</div>
        <span class="task-meta meta-with-icon">${icon("calendar", "icon-sm")} ${escapeHtml(e.exam_date)} ${escapeHtml(e.exam_time || '')} · en ${days} día(s)</span>
        <button class="btn btn-secondary btn-small" aria-label="Editar" onclick="app.editExam(${e.id})">${icon("edit")}</button>
        <button class="btn btn-danger btn-small" aria-label="Eliminar" onclick="app.deleteExam(${e.id})">${icon("x")}</button>
      </div>`;
  };

  proto.showExamForm = function () {
    this._editingExamId = null;
    const w = document.getElementById('exam-form-wrap');
    if (w) w.hidden = !w.hidden;
  };

  proto.editExam = function (id) {
    this._editingExamId = id;
    this.renderExamsView();
  };

  proto.cancelEditExam = function () {
    this._editingExamId = null;
    this.renderExamsView();
  };

  proto.saveExam = async function () {
    const body = {
      course_code: document.getElementById('exam-course').value,
      title: document.getElementById('exam-title').value,
      exam_date: document.getElementById('exam-date').value,
      exam_time: document.getElementById('exam-time').value,
      room: document.getElementById('exam-room').value,
    };
    try {
      if (this._editingExamId) {
        await api.updateExam(this._editingExamId, body);
        this._editingExamId = null;
        this.showAlert('Examen actualizado', 'success');
      } else {
        await api.createExam(body);
        this.showAlert('Examen registrado', 'success');
      }
      await this.fetchExams();
      this.renderExamsView();
    } catch (e) {
      this.showAlert(e.message, 'error');
    }
  };

  proto.deleteExam = async function (id) {
    await api.deleteExam(id);
    await this.fetchExams();
    this.renderExamsView();
  };

  proto.renderTodayView = function () {
    const container = document.getElementById('view-content');
    const todayName = DAY_NAMES[new Date().getDay()];
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
        ${classes.length ? classes.map((c) => `
          <div class="class-item color-${escapeHtml(c.course.color)}" onclick="app.showClassDetails('${escapeJsString(c.course.code)}', ${Number(c.id) || 0})">
            <div class="class-time">${escapeHtml(c.start_time)} – ${escapeHtml(c.end_time)}</div>
            <div class="class-title">${escapeHtml(c.course.name)}</div>
            <div class="class-details">${escapeHtml(c.course.code)}${c.room ? ` · ${icon("building", "icon-sm")} ${escapeHtml(c.room)}` : ''}</div>
          </div>`).join('') : '<p class="muted">Sin clases hoy</p>'}
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
            if (!list.some((x) => !x.isExam && !x.isTask && x.code === c.code)) {
              list.push({ code: c.code, name: c.name, isExam: false, isTask: false });
            }
          }
        }
      }
    }
    for (const e of this.exams) {
      if (!e.exam_date.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)) continue;
      (eventsByDate[e.exam_date] ||= []).push({ code: e.course_code, name: e.title, isExam: true, isTask: false });
    }
    for (const t of this.tasks.filter((x) => !x.completed)) {
      if (!t.due_date.startsWith(`${year}-${String(month + 1).padStart(2, '0')}`)) continue;
      (eventsByDate[t.due_date] ||= []).push({
        code: t.course_code || 'Tarea',
        name: t.title,
        isExam: false,
        isTask: true,
      });
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
        ${ev.slice(0, 3).map((x) => `<span class="cal-dot ${x.isExam ? 'is-exam' : ''} ${x.isTask ? 'is-task' : ''}" title="${escapeHtml(x.name || '')}">${escapeHtml(x.code || '')}</span>`).join('')}
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
    title.textContent = dt.toLocaleDateString('es-MX', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });

    if (!events.length) {
      body.innerHTML = '<p class="muted">Sin eventos este día</p>';
    } else {
      body.innerHTML = events
        .map((ev) => {
          const typeLabel = ev.isExam ? 'Examen' : ev.isTask ? 'Tarea' : 'Clase';
          const typeClass = ev.isExam ? 'is-exam' : ev.isTask ? 'is-task' : 'is-class';
          const typeIcon = ev.isExam ? 'file-text' : ev.isTask ? 'clipboard' : 'book';
          return `<div class="month-event-row ${typeClass}">
            <span class="month-event-type">${icon(typeIcon, 'icon-sm')} ${typeLabel}</span>
            <strong>${escapeHtml(ev.code || '')}</strong>
            <span class="muted">${escapeHtml(ev.name || '')}</span>
          </div>`;
        })
        .join('');
    }

    panel.hidden = false;
    document.querySelectorAll('.cal-cell[data-date]').forEach((el) => {
      el.classList.toggle('cal-selected', el.dataset.date === dateKey);
    });
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
    if (file.size > 2 * 1024 * 1024) {
      this.showAlert('Archivo demasiado grande (máx 2MB)', 'error');
      return;
    }
    try {
      const data = JSON.parse(await file.text());
      const courses = Array.isArray(data) ? data : data.courses;
      if (!Array.isArray(courses)) throw new Error('Formato inválido');
      const invalid = courses.filter((c) => !c?.code || !c?.name);
      const preview = document.getElementById('import-preview');
      if (preview) {
        preview.hidden = false;
        preview.innerHTML = `
          <p><strong>${courses.length}</strong> materias detectadas${invalid.length ? ` · <span style="color:var(--error)">${invalid.length} inválidas</span>` : ''}.</p>
          <p class="muted" style="font-size:12px;">Se validarán en el servidor antes de importar.</p>
          <button class="btn btn-primary" onclick="app.confirmImport()">Confirmar importación</button>
          <button class="btn btn-secondary" onclick="app.cancelImportPreview()">Cancelar</button>`;
      }
      this._pendingImport = courses;
    } catch (e) {
      this.showAlert('JSON inválido', 'error');
    }
    input.value = '';
  };

  proto.confirmImport = async function () {
    if (!this._pendingImport) return;
    try {
      const data = await api.importCourses(this._pendingImport);
      this._pendingImport = null;
      document.getElementById('import-preview').hidden = true;
      this._skipNextSocketSync = true;
      await this.fetchCourses();
      this.renderAll();
      this.showAlert(`${data.imported} importadas · ${data.skipped} omitidas`, 'success');
    } catch (e) {
      this.showAlert(e.message || 'Error al importar', 'error');
    }
  };

  proto.importData = async function (input) {
    await this.showImportPreview(input);
  };

  proto.cancelImportPreview = function () {
    this._pendingImport = null;
    const p = document.getElementById('import-preview');
    if (p) p.hidden = true;
  };

  proto._settingsToggleBtn = function (label, iconName, onclick) {
    return `<button type="button" class="btn btn-secondary settings-action-btn" onclick="${onclick}">${icon(iconName, 'icon-sm')} ${label}</button>`;
  };

  proto._buildSettingsTabContent = function (tab, user) {
    const s = this.settings;
    const pg = this.getPassingGrade();
    const viewOpts = VIEW_OPTIONS.map(
      (v) => `<option value="${v.id}" ${(s.defaultView || 'grid') === v.id ? 'selected' : ''}>${v.label}</option>`,
    ).join('');

    if (tab === 'cuenta') {
      const roleLine = user?.role === 'admin'
        ? `<p class="settings-field-hint admin-account-role">${icon('shield', 'icon-sm')} Cuenta de administrador — puedes gestionar usuarios en la pestaña Usuarios.</p>`
        : '';
      return `
        <div class="settings-section">
          <h3 class="settings-section-title">${icon('user', 'icon-sm')} Perfil</h3>
          ${roleLine}
          <form id="settings-profile-form" class="settings-form">
            <div class="settings-field">
              <label for="settings-name">Nombre</label>
              <input type="text" id="settings-name" name="name" class="form-input" value="${escapeHtml(user?.name || '')}" autocomplete="name">
            </div>
            <div class="settings-field">
              <label>Correo electrónico</label>
              <input type="email" class="form-input" value="${escapeHtml(user?.email || '')}" disabled readonly>
              <p class="settings-field-hint">El correo no se puede cambiar desde la aplicación.</p>
            </div>
            <button type="submit" class="btn btn-primary">${icon('check', 'icon-sm')} Guardar perfil</button>
          </form>
        </div>
        <div class="settings-section">
          <h3 class="settings-section-title">${icon('lock', 'icon-sm')} Cambiar contraseña</h3>
          <form id="settings-password-form" class="settings-form">
            <div class="settings-field">
              <label for="settings-current-pw">Contraseña actual</label>
              <input type="password" id="settings-current-pw" name="currentPassword" class="form-input" autocomplete="current-password" minlength="8" required>
            </div>
            <div class="settings-field">
              <label for="settings-new-pw">Nueva contraseña</label>
              <input type="password" id="settings-new-pw" name="newPassword" class="form-input" autocomplete="new-password" minlength="8" required>
            </div>
            <button type="submit" class="btn btn-secondary">${icon('lock', 'icon-sm')} Actualizar contraseña</button>
          </form>
        </div>
        <div class="settings-section settings-section--danger">
          <button type="button" class="btn btn-secondary settings-action-btn" onclick="app.logout()">${icon('log-out', 'icon-sm')} Cerrar sesión</button>
        </div>
      `;
    }

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
        </div>
      `;
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
        </div>
      `;
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
          ${this._settingsToggleBtn(s.taskNotifications === false ? 'Activar avisos de tareas' : 'Desactivar avisos de tareas', s.taskNotifications === false ? 'check' : 'ban', 'app.toggleTaskNotifications()')}
        </div>
      `;
    }

    if (tab === 'calculadora') {
      return `
        <div class="settings-section">
          <h3 class="settings-section-title">${icon('calculator', 'icon-sm')} Calculadora</h3>
          <div class="settings-field">
            <label>${icon('target', 'icon-sm')} Umbral de aprobación</label>
            <input type="number" class="form-input" value="${pg}" min="${GRADE_MIN}" max="${GRADE_MAX}" step="0.01" onchange="app.setPassingGrade(this.value)">
          </div>
        </div>
      `;
    }

    if (tab === 'privacidad') {
      return `
        <div class="settings-section">
          <h3 class="settings-section-title">${icon('shield', 'icon-sm')} Privacidad y comportamiento</h3>
          ${this._settingsToggleBtn(s.showClassBadge !== false ? 'Ocultar badge en clase' : 'Mostrar badge en clase', s.showClassBadge !== false ? 'ban' : 'eye', 'app.toggleShowClassBadge()')}
          ${this._settingsToggleBtn(s.confirmDeleteCourse !== false ? 'Borrar sin confirmar' : 'Confirmar al borrar materia', s.confirmDeleteCourse !== false ? 'unlock' : 'lock', 'app.toggleConfirmDeleteCourse()')}
          <button type="button" class="btn btn-secondary settings-action-btn" onclick="app.setupPin()">${icon('lock', 'icon-sm')} Configurar PIN</button>
          <button type="button" class="btn btn-secondary settings-action-btn" onclick="app.removePin()">${icon('unlock', 'icon-sm')} Quitar PIN</button>
        </div>
      `;
    }

    if (tab === 'datos') {
      return `
        <div class="settings-section">
          <h3 class="settings-section-title">${icon('folder', 'icon-sm')} Gestión de datos</h3>
          <button type="button" class="btn btn-secondary settings-action-btn" onclick="app.exportData()">${icon('download', 'icon-sm')} Exportar JSON</button>
          <button type="button" class="btn btn-secondary settings-action-btn" onclick="app.triggerImport()">${icon('upload', 'icon-sm')} Importar JSON</button>
          <input type="file" id="import-file" accept=".json" hidden>
          <button type="button" class="btn btn-secondary settings-action-btn" onclick="app.exportIcs()">${icon('calendar', 'icon-sm')} Exportar .ics</button>
          <button type="button" class="btn btn-secondary settings-action-btn" onclick="app.createBackup()">${icon('save', 'icon-sm')} Respaldo automático</button>
          <button type="button" class="btn btn-secondary settings-action-btn" onclick="app.showBackupHistory()">${icon('folder', 'icon-sm')} Historial de respaldos</button>
          <button type="button" class="btn btn-danger settings-action-btn" onclick="app.deleteAllCourses()">${icon('trash', 'icon-sm')} Borrar horario</button>
        </div>
      `;
    }

    return `<p class="muted">Sección no encontrada.</p>`;
  };

  const _setupEventListeners = proto.setupEventListeners;
  proto.setupEventListeners = function () {
    _setupEventListeners.call(this);

    document.getElementById('search-input')?.addEventListener('input', (e) => {
      this.runSearch(e.target.value);
    });

    document.getElementById('search-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'search-modal') this.closeSearch();
    });

    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        this.openSearch();
      }
      if (['4', '5', '6', '7', '8', '9', '0'].includes(e.key) && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        const map = {
          '4': 'tasks',
          '5': 'exams',
          '6': 'month',
          '7': 'today',
          '8': 'calc',
          '9': 'stats',
          '0': 'exam-mode',
        };
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
