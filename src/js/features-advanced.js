/**
 * Features avanzadas: M8, M9, A2, A6, U2, estadísticas, modo examen
 */
import { setupGridDragDrop } from './grid-dnd.js';
import { escapeHtml, escapeJsString, icon } from './utils.js';
import { api } from './api.js';

const THEMES = ['light', 'dark', 'amoled', 'contrast'];

export function installAdvancedFeatures(AmellifyApp) {
  const proto = AmellifyApp.prototype;

  proto.examModeNotes = JSON.parse(
    localStorage.getItem('amellify-exam-notes') || '{}'
  );

  // ─── PIN ───────────────────────────────────────────────────────
  proto.hashPin = async function (pin) {
    const data = new TextEncoder().encode(pin + ':amellify');
    const buf = await crypto.subtle.digest('SHA-256', data);
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  };

  proto.hasPin = function () {
    return !!localStorage.getItem('amellify-pin-hash');
  };

  proto.showLockScreen = function () {
    if (!this.hasPin()) return;
    let el = document.getElementById('pin-lock-screen');
    if (el) return;
    el = document.createElement('div');
    el.id = 'pin-lock-screen';
    el.className = 'pin-lock-screen';
    el.innerHTML = `
      <div class="pin-lock-card glass-strong">
        <h2>${icon("lock", "icon-md")} Amellify bloqueado</h2>
        <input type="password" id="pin-input" class="form-input" placeholder="PIN" maxlength="8" autocomplete="off">
        <button class="btn btn-primary" style="width:100%;margin-top:12px;" onclick="app.unlockPin()">Desbloquear</button>
        <p class="muted" style="margin-top:12px;font-size:12px;">Introduce tu PIN de 4–8 dígitos</p>
      </div>`;
    document.body.appendChild(el);
    setTimeout(() => document.getElementById('pin-input')?.focus(), 100);
  };

  proto.unlockPin = async function () {
    const input = document.getElementById('pin-input');
    const hash = await this.hashPin(input?.value || '');
    if (hash !== localStorage.getItem('amellify-pin-hash')) {
      this.showAlert('PIN incorrecto', 'error');
      return;
    }
    document.getElementById('pin-lock-screen')?.remove();
    sessionStorage.setItem('amellify-unlocked', '1');
  };

  proto.setupPin = async function () {
    const pin = prompt('Nuevo PIN (4-8 dígitos):');
    if (!pin || pin.length < 4) return;
    const confirm = prompt('Confirma el PIN:');
    if (pin !== confirm) {
      this.showAlert('Los PIN no coinciden', 'error');
      return;
    }
    const hash = await this.hashPin(pin);
    localStorage.setItem('amellify-pin-hash', hash);
    this.showAlert('PIN configurado', 'success');
    document.getElementById('settings-modal')?.remove();
  };

  proto.removePin = function () {
    if (!confirm('¿Eliminar el PIN?')) return;
    localStorage.removeItem('amellify-pin-hash');
    this.showAlert('PIN eliminado', 'success');
    document.getElementById('settings-modal')?.remove();
  };

  // ─── Temas extendidos ──────────────────────────────────────────
  proto.cycleTheme = function () {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const idx = THEMES.indexOf(current);
    const next = THEMES[(idx + 1) % THEMES.length];
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('amellify-theme', next);
    this.settings.theme = next;
    if (typeof this.saveSettingsToServer === 'function') {
      this.saveSettingsToServer();
    }
    this.updateThemeIcon(next);
    const names = { light: 'Claro', dark: 'Oscuro', amoled: 'AMOLED', contrast: 'Alto contraste' };
    this.showSilentNotification(`Tema: ${names[next]}`);
  };

  const _toggleTheme = proto.toggleTheme;
  proto.toggleTheme = function () {
    this.cycleTheme();
  };

  const _updateThemeIcon = proto.updateThemeIcon;
  proto.updateThemeIcon = function (theme) {
    const icon = document.getElementById('theme-icon');
    if (!icon) return;
    if (theme === 'light') {
      icon.innerHTML = '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>';
    } else if (theme === 'contrast') {
      icon.innerHTML = '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="16"></line>';
    } else {
      _updateThemeIcon.call(this, theme === 'amoled' ? 'dark' : theme);
    }
  };

  const _init = proto.init;
  proto.init = async function (...args) {
    const saved = localStorage.getItem('amellify-theme');
    if (saved && THEMES.includes(saved)) {
      document.documentElement.setAttribute('data-theme', saved);
      this.updateThemeIcon(saved);
    }
    await _init.apply(this, args);
    if (this.hasPin() && !sessionStorage.getItem('amellify-unlocked')) {
      this.showLockScreen();
    }
  };

  // ─── Mover horario (drag) ──────────────────────────────────────
  proto.moveSchedule = async function (code, schedId, patch) {
    const course = this.courses.find((c) => c.code === code);
    if (!course) return;

    const schedules = (course.schedules || []).map((s) => {
      const idMatch = schedId > 0 && Number(s.id) === Number(schedId);
      const slotMatch =
        !idMatch &&
        s.day === patch._oldDay &&
        s.start_time === patch._oldStart &&
        s.end_time === patch._oldEnd;
      if (idMatch || slotMatch) {
        return { ...s, day: patch.day, start_time: patch.start_time, end_time: patch.end_time };
      }
      return s;
    });

    try {
      await api.updateCourse(code, { ...course, schedules });
      this._skipNextSocketSync = true;
      await this.fetchCourses();
      this.renderAll();
      this.showToast('Horario actualizado', 'success');
    } catch (e) {
      this.showAlert(e.message || 'Error al mover clase', 'error');
    }
  };

  const _renderGridView = proto.renderGridView;
  proto.renderGridView = function () {
    _renderGridView.call(this);
    if (!this.settings?.gridDragDisabled) setupGridDragDrop(this);
  };

  // ─── M8 Estadísticas ───────────────────────────────────────────
  proto.renderStatsView = async function () {
    const container = document.getElementById('view-content');
    container.innerHTML = '<div class="panel-glass"><p class="muted">Cargando estadísticas…</p></div>';

    let ext = { hoursByDay: {}, pendingTasks: 0, upcomingExams: 0 };
    try {
      ext = await api.getStatsExtended();
    } catch (_e) { /* */ }

    const active = this.courses.filter((c) => c.status === 'active');
    const maxH = Math.max(1, ...Object.values(ext.hoursByDay || {}));

    const dayBars = Object.entries(ext.hoursByDay || {})
      .map(([day, hrs]) => {
        const pct = Math.round((hrs / maxH) * 100);
        return `<div class="stat-bar-row">
          <span class="stat-bar-label">${escapeHtml(day)}</span>
          <div class="stat-bar-track"><div class="stat-bar-fill" style="width:${pct}%"></div></div>
          <span class="stat-bar-value">${hrs.toFixed(1)}h</span>
        </div>`;
      })
      .join('');

    const byCourse = active.map((c) => {
      let mins = 0;
      for (const s of c.schedules || []) {
        const [sh, sm] = s.start_time.split(':').map(Number);
        const [eh, em] = s.end_time.split(':').map(Number);
        mins += Math.max(0, eh * 60 + em - (sh * 60 + sm));
      }
      return { code: c.code, name: c.name, hours: mins / 60, credits: c.credits };
    }).sort((a, b) => b.hours - a.hours);

    const maxCH = Math.max(1, ...byCourse.map((c) => c.hours));
    const courseBars = byCourse
      .map((c) => {
        const pct = Math.round((c.hours / maxCH) * 100);
        return `<div class="stat-bar-row">
          <span class="stat-bar-label" title="${escapeHtml(c.name)}">${escapeHtml(c.code)}</span>
          <div class="stat-bar-track"><div class="stat-bar-fill is-accent" style="width:${pct}%"></div></div>
          <span class="stat-bar-value">${c.hours.toFixed(1)}h</span>
        </div>`;
      })
      .join('');

    container.innerHTML = `
      <div class="stats-dashboard scroll-panel view-scroll-panel">
        <div class="stats-cards-row">
          <div class="mini-stat glass"><span class="mini-stat-val">${active.length}</span><span class="mini-stat-lbl">Materias activas</span></div>
          <div class="mini-stat glass"><span class="mini-stat-val">${ext.pendingTasks ?? 0}</span><span class="mini-stat-lbl">Tareas pendientes</span></div>
          <div class="mini-stat glass"><span class="mini-stat-val">${ext.upcomingExams ?? 0}</span><span class="mini-stat-lbl">Exámenes próximos</span></div>
          <div class="mini-stat glass"><span class="mini-stat-val">${ext.totalHours ?? 0}h</span><span class="mini-stat-lbl">Horas / semana</span></div>
        </div>
        <div class="panel-glass">
          <h3>Horas por día</h3>
          ${dayBars || '<p class="muted">Sin horarios</p>'}
        </div>
        <div class="panel-glass">
          <h3>Carga por materia</h3>
          ${courseBars || '<p class="muted">Sin datos</p>'}
        </div>
      </div>`;
  };

  // ─── M9 Modo examen ──────────────────────────────────────────────
  proto.renderExamModeView = function () {
    const container = document.getElementById('view-content');
    const today = new Date().toISOString().slice(0, 10);
    const upcoming = [...this.exams]
      .filter((e) => e.exam_date >= today)
      .sort((a, b) => a.exam_date.localeCompare(b.exam_date));

    const courseMap = Object.fromEntries(this.courses.map((c) => [c.code, c]));

    container.innerHTML = `
      <div class="exam-mode-panel panel-glass scroll-panel view-scroll-panel">
        <div class="panel-header">
          <h2>${icon("target", "icon-md")} Modo examen</h2>
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <span class="muted">${upcoming.length} examen(es) por delante</span>
            ${upcoming.length ? `<button type="button" class="btn btn-secondary btn-small" onclick="app.exportExamNotes()">${icon("download")} Exportar notas</button>` : ''}
          </div>
        </div>
        <p class="muted" style="margin-bottom:16px;">Enfócate en lo urgente. Marca temas repasados y prioriza por fecha.</p>
        ${
          upcoming.length
            ? upcoming
                .map((e) => {
                  const course = courseMap[e.course_code];
                  const days = Math.ceil(
                    (new Date(e.exam_date) - new Date()) / 86400000
                  );
                  const urgency =
                    days <= 3 ? 'urgent' : days <= 7 ? 'soon' : 'normal';
                  const noteKey = `${e.id}`;
                  const checked = this.examModeNotes[noteKey] ? 'checked' : '';
                  return `
            <div class="exam-mode-card glass ${urgency}">
              <div class="exam-mode-head">
                <strong>${escapeHtml(e.title)}</strong>
                <span class="exam-badge">${days}d</span>
              </div>
              <div class="exam-mode-meta">${escapeHtml(e.course_code)} · ${escapeHtml(course?.name || '')}</div>
              <div class="exam-mode-meta meta-with-icon">${icon("calendar", "icon-sm")} ${escapeHtml(e.exam_date)} ${escapeHtml(e.exam_time || '')} ${e.room ? `· ${icon("building", "icon-sm")} ${escapeHtml(e.room)}` : ''}</div>
              <label class="exam-checklist">
                <input type="checkbox" ${checked} onchange="app.toggleExamTopic(${e.id}, this.checked)">
                Temas repasados
              </label>
              <textarea class="form-input exam-notes-input" placeholder="Notas de estudio…" onchange="app.saveExamNote(${e.id}, this.value)">${escapeHtml(this.examModeNotes['note-' + e.id] || '')}</textarea>
            </div>`;
                })
                .join('')
            : '<p class="muted">No hay exámenes registrados. Agrégalos en la pestaña Exámenes.</p>'
        }
      </div>`;
  };

  proto.toggleExamTopic = function (id, checked) {
    this.examModeNotes[id] = checked;
    localStorage.setItem('amellify-exam-notes', JSON.stringify(this.examModeNotes));
  };

  proto.saveExamNote = function (id, text) {
    this.examModeNotes['note-' + id] = text;
    localStorage.setItem('amellify-exam-notes', JSON.stringify(this.examModeNotes));
  };

  proto.exportExamNotes = function () {
    const today = new Date().toISOString().slice(0, 10);
    const upcoming = [...this.exams]
      .filter((e) => e.exam_date >= today)
      .sort((a, b) => a.exam_date.localeCompare(b.exam_date));
    const courseMap = Object.fromEntries(this.courses.map((c) => [c.code, c]));
    const lines = ['Notas de estudio — Amellify', `Exportado: ${new Date().toLocaleString('es-MX')}`, ''];

    for (const e of upcoming) {
      const course = courseMap[e.course_code];
      const reviewed = this.examModeNotes[e.id] ? 'Sí' : 'No';
      const note = this.examModeNotes['note-' + e.id] || '';
      lines.push(`## ${e.title} (${e.course_code})`);
      lines.push(`Materia: ${course?.name || '—'}`);
      lines.push(`Fecha: ${e.exam_date}${e.exam_time ? ' ' + e.exam_time : ''}${e.room ? ' · ' + e.room : ''}`);
      lines.push(`Temas repasados: ${reviewed}`);
      lines.push(note ? `Notas:\n${note}` : 'Notas: (vacío)');
      lines.push('');
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `amellify-examenes-${today}.txt`;
    a.click();
    URL.revokeObjectURL(url);
    this.showAlert('Notas exportadas', 'success');
  };

  // ─── Integrar vistas ───────────────────────────────────────────
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
      stats: () => this.renderStatsView(),
      'exam-mode': () => this.renderExamModeView(),
    };
    (views[this.currentView] || views.grid)();
  };
}
