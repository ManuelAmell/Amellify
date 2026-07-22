import { api } from './api.js';
import { setupGridDragDrop } from './grid-dnd.js';
import { escapeHtml, icon } from './utils.js';

const THEMES = ['light', 'dark', 'amoled', 'contrast'];

export function installAdvancedFeatures(AmellifyApp) {
  const proto = AmellifyApp.prototype;

  proto.cycleTheme = function () {
    const current = document.documentElement.getAttribute('data-theme') || 'light';
    const idx = THEMES.indexOf(current);
    const next = THEMES[(idx + 1) % THEMES.length];
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('amellify-theme', next);
    this.settings.theme = next;
    if (typeof this.saveSettingsToServer === 'function') { this.saveSettingsToServer(); }
    this.updateThemeIcon(next);
    const names = { light: 'Claro', dark: 'Oscuro', amoled: 'AMOLED', contrast: 'Alto contraste' };
    this.showSilentNotification(`Tema: ${names[next]}`);
  };

  const _toggleTheme = proto.toggleTheme;
  proto.toggleTheme = function () { this.cycleTheme(); };

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
  };

  proto.moveSchedule = async function (code, schedId, patch) {
    const course = this.courses.find((c) => c.code === code);
    if (!course) return;
    const schedules = (course.schedules || []).map((s) => {
      const idMatch = schedId > 0 && Number(s.id) === Number(schedId);
      const slotMatch = !idMatch && s.day === patch._oldDay && s.start_time === patch._oldStart && s.end_time === patch._oldEnd;
      if (idMatch || slotMatch) {
        return { ...s, day: patch.day, start_time: patch.start_time, end_time: patch.end_time };
      }
      return s;
    });
    try {
      await api.updateCourse(code, { ...course, schedules });
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

  proto.renderStatsView = async function () {
    const container = document.getElementById('view-content');
    container.innerHTML = '<div class="panel-glass"><p class="muted">Cargando estadísticas…</p></div>';

    const active = this.courses.filter((c) => c.status === 'active');
    const hoursByDay = {};
    for (const c of active) {
      for (const s of c.schedules || []) {
        const [sh, sm] = s.start_time.split(':').map(Number);
        const [eh, em] = s.end_time.split(':').map(Number);
        const hrs = Math.max(0, eh * 60 + em - (sh * 60 + sm)) / 60;
        hoursByDay[s.day] = (hoursByDay[s.day] || 0) + hrs;
      }
    }
    let totalHours = 0;
    for (const h of Object.values(hoursByDay)) totalHours += h;

    const maxH = Math.max(1, ...Object.values(hoursByDay));

    const dayBars = Object.entries(hoursByDay).map(([day, hrs]) => {
      const pct = Math.round((hrs / maxH) * 100);
      return `<div class="stat-bar-row"><span class="stat-bar-label">${escapeHtml(day)}</span><div class="stat-bar-track"><div class="stat-bar-fill" style="width:${pct}%"></div></div><span class="stat-bar-value">${hrs.toFixed(1)}h</span></div>`;
    }).join('');

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
    const courseBars = byCourse.map((c) => {
      const pct = Math.round((c.hours / maxCH) * 100);
      return `<div class="stat-bar-row"><span class="stat-bar-label" title="${escapeHtml(c.name)}">${escapeHtml(c.code)}</span><div class="stat-bar-track"><div class="stat-bar-fill is-accent" style="width:${pct}%"></div></div><span class="stat-bar-value">${c.hours.toFixed(1)}h</span></div>`;
    }).join('');

    container.innerHTML = `
      <div class="stats-dashboard scroll-panel view-scroll-panel">
        <div class="stats-cards-row">
          <div class="mini-stat glass"><span class="mini-stat-val">${active.length}</span><span class="mini-stat-lbl">Materias activas</span></div>
          <div class="mini-stat glass"><span class="mini-stat-val">${totalHours.toFixed(1)}h</span><span class="mini-stat-lbl">Horas / semana</span></div>
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

  const _renderView = proto.renderView;
  proto.renderView = function () {
    const views = {
      grid: () => this.renderGridView(),
      week: () => this.renderWeekView(),
      list: () => this.renderListView(),
      calc: () => this.renderCalcView(),
      month: () => this.renderMonthView(),
      today: () => this.renderTodayView(),
      stats: () => this.renderStatsView(),
    };
    (views[this.currentView] || views.grid)();
  };
}
