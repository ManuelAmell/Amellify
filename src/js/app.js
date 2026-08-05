import {
  escapeHtml,
  escapeJsString,
  icon,
  statusDot,
  statusLabel,
  calculateFinalGrade as calcFinalGrade,
  evaluatePartials,
  evaluateWithHypothetical,
  computeRequiredGrade,
  validatePartialRows,
  findWeakestPartial,
  CALC_PRESETS,
  PASSING_GRADE,
  GRADE_MIN,
  GRADE_MAX,
  gradeScaleHint,
  validateCourseCode,
  validateScheduleSlot,
  formatTime,
} from "./utils.js";
import { api, getCurrentUser } from "./api.js";
import { installFeatures } from "./features.js";
import { installAdvancedFeatures } from "./features-advanced.js";

class AmellifyApp {
  constructor() {
    this.courses = [];
    this.currentView = "grid";
    this.scheduleSlots = [];
    this.editingCode = null;
    this.countdownInterval = null;
    this.currentTimeUpdateInterval = null;
    this._menuClickHandler = null;
    this._updateSlotTimeout = null;
    this._initialLoadDone = false;

    this.settings = {
      fontSize: 'large',
      gridCompact: true,
      notifications: true,
      notifyMinutesBefore: 15,
      defaultView: 'grid',
      weekStartsOn: 'monday',
      gridDragDisabled: false,
      passingGrade: PASSING_GRADE,
      timeFormat24h: true,
      showClassBadge: true,
      confirmDeleteCourse: true,
      listCompact: false,
    };

    this.init();
  }

  getPassingGrade() {
    const g = parseFloat(this.settings?.passingGrade);
    return Number.isFinite(g) && g >= GRADE_MIN && g <= GRADE_MAX ? g : PASSING_GRADE;
  }

  formatTimeDisplay(timeStr) {
    return formatTime(timeStr, this.settings?.timeFormat24h !== false);
  }

  async init() {
    const savedTheme = localStorage.getItem("amellify-theme") || "light";
    document.documentElement.setAttribute("data-theme", savedTheme);
    this.updateThemeIcon(savedTheme);

    const savedSettings = localStorage.getItem("amellify-settings");
    if (savedSettings) {
      this.settings = { ...this.settings, ...JSON.parse(savedSettings) };
    }
    if (typeof this.applySettings === "function") this.applySettings();
    else this.applyFontSize();

    await this.onAuthenticated(getCurrentUser());
  }

  async onAuthenticated(user) {
    this._initialLoadDone = false;
    try {
      await this.fetchCourses();
    } finally {
      this._initialLoadDone = true;
    }
    this.renderAll();
    this.setupEventListeners();
  }

  async fetchCourses() {
    try {
      this.courses = await api.getCourses();
      return this.courses;
    } catch (err) {
      console.error(err);
      return this.courses;
    }
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container') || (() => {
      const div = document.createElement('div');
      div.id = 'toast-container';
      div.style.cssText = 'position:fixed;top:20px;right:20px;z-index:9999;display:flex;flex-direction:column;gap:8px;';
      document.body.appendChild(div);
      return div;
    })();

    const toast = document.createElement('div');
    const colors = {
      success: 'var(--success)',
      error: 'var(--error)',
      warning: '#f5a623',
      info: 'var(--accent)'
    };
    toast.style.cssText = `
      background: var(--bg-secondary);
      border: 1px solid ${colors[type] || colors.info};
      color: ${colors[type] || colors.info};
      padding: 12px 20px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 500;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      animation: slideIn 0.3s ease-out;
    `;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'fadeOut 0.3s ease-out forwards';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  renderAll() {
    this.updateStats();
    this.renderNextClassHero();
    this.renderView();
    this.startCountdown();
  }

  updateStats() {
    const active = this.courses.filter((c) => c.status === "active");
    document.getElementById("total-courses").textContent = this.courses.length;
    document.getElementById("total-credits").textContent = active.reduce(
      (s, c) => s + (c.credits || 0),
      0,
    );

    let totalMins = 0;
    for (const c of active) {
      for (const s of c.schedules || []) {
        const [sh, sm] = s.start_time.split(":").map(Number);
        const [eh, em] = s.end_time.split(":").map(Number);
        totalMins += Math.max(0, eh * 60 + em - (sh * 60 + sm));
      }
    }
    document.getElementById("total-hours").textContent = Math.round(
      totalMins / 60,
    );

    const now = new Date();
    const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
    document.getElementById("current-day-stat").textContent =
      dayNames[now.getDay()];
    document.getElementById("current-date").textContent =
      now.toLocaleDateString("es-MX", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
  }

  renderNextClassHero() {
    const hero = document.getElementById("next-class-hero");
    const next = this.getNextClass();

    if (!next) {
      hero.innerHTML = "";
      return;
    }

    hero.innerHTML = `
      <div class="next-class-hero glass-hero">
        <div class="glass-hero-shine" aria-hidden="true"></div>
        <div class="next-class-content">
          <div class="next-class-label">${icon("zap", "icon-sm")} Próxima Clase</div>
          <div class="next-class-name">${escapeHtml(next.course.name)}</div>
          <div class="next-class-details">
            <span>${icon("clock", "icon-sm")} ${escapeHtml(next.schedule.start_time)} – ${escapeHtml(next.schedule.end_time)}</span>
            <span>${icon("calendar", "icon-sm")} ${escapeHtml(next.schedule.day)}</span>
            ${next.schedule.room ? `<span>${icon("building", "icon-sm")} ${escapeHtml(next.schedule.room)}</span>` : ""}
            ${next.course.professor ? `<span>${icon("user", "icon-sm")} ${escapeHtml(next.course.professor)}</span>` : ""}
            <span style="font-family:'IBM Plex Mono',monospace; opacity:0.8;">${escapeHtml(next.course.code)}</span>
          </div>
          <div class="countdown" id="countdown-display">--:--:--</div>
        </div>
      </div>`;
  }

  getNextClass() {
    const dayMap = {
      Domingo: 0, Lunes: 1, Martes: 2, Miércoles: 3,
      Jueves: 4, Viernes: 5, Sábado: 6,
    };
    const now = new Date();
    let nearest = null;
    let nearestMs = Infinity;
    const active = this.courses.filter((c) => c.status === "active");

    for (const course of active) {
      for (const s of course.schedules || []) {
        const targetDay = dayMap[s.day];
        if (targetDay === undefined) continue;
        const [sh, sm] = s.start_time.split(":").map(Number);
        const currentDay = now.getDay();
        const currentTime = now.getHours() * 60 + now.getMinutes();
        const targetTime = sh * 60 + sm;
        let daysUntil = targetDay - currentDay;
        if (daysUntil === 0 && currentTime >= targetTime) daysUntil = 7;
        else if (daysUntil < 0) daysUntil += 7;
        const candidate = new Date(now);
        candidate.setDate(candidate.getDate() + daysUntil);
        candidate.setHours(sh, sm, 0, 0);
        const diff = candidate - now;
        if (diff > 0 && diff < nearestMs) {
          nearestMs = diff;
          nearest = { course, schedule: s, msUntil: diff };
        }
      }
    }
    return nearest;
  }

  startCountdown() {
    if (this.countdownInterval) clearInterval(this.countdownInterval);
    this.countdownInterval = setInterval(() => {
      const el = document.getElementById("countdown-display");
      if (!el) return;
      const next = this.getNextClass();
      if (!next) { el.textContent = "--:--:--"; return; }
      const diff = next.msUntil;
      const totalSecs = Math.floor(diff / 1000);
      const days = Math.floor(totalSecs / 86400);
      const hours = Math.floor((totalSecs % 86400) / 3600);
      const mins = Math.floor((totalSecs % 3600) / 60);
      const secs = totalSecs % 60;
      if (days > 0) {
        el.textContent = `${days} día${days !== 1 ? 's' : ''} ${String(hours).padStart(2, "0")} hrs ${String(mins).padStart(2, "0")} min`;
      } else if (hours > 0) {
        el.textContent = `${String(hours).padStart(2, "0")} hrs ${String(mins).padStart(2, "0")} min ${String(secs).padStart(2, "0")} seg`;
      } else {
        el.textContent = `${String(mins).padStart(2, "0")} min ${String(secs).padStart(2, "0")} seg`;
      }
    }, 1000);
  }

  switchView(view) {
    this.currentView = view;
    document.querySelectorAll(".view-tab").forEach((t) => {
      t.classList.toggle("active", t.dataset.view === view);
    });
    const content = document.getElementById("view-content");
    if (content) {
      content.classList.add("is-switching");
      requestAnimationFrame(() => {
        this.renderView();
        requestAnimationFrame(() => content.classList.remove("is-switching"));
      });
      return;
    }
    this.renderView();
  }

  renderView() {
    const views = {
      grid: () => this.renderGridView(),
      week: () => this.renderWeekView(),
      list: () => this.renderListView(),
      calc: () => this.renderCalcView(),
    };
    (views[this.currentView] || views.grid)();
  }

  calculateFinalGrade(partials) {
    return calcFinalGrade(partials);
  }

  _partialRowHtml(name, grade, percent, context) {
    const gradeVal = grade !== null && grade !== undefined && grade !== "" ? grade : "";
    const percentVal = percent !== null && percent !== undefined && percent !== "" ? percent : "";
    const safeName = escapeHtml(name || "P1");
    return `
      <div class="partial-row partial-item" data-context="${context}">
        <input type="text" class="partial-name-input" value="${safeName}" placeholder="P1" maxlength="20" aria-label="Nombre del parcial" oninput="app.onPartialInputChange('${context}')">
        <input type="number" class="partial-grade partial-grade-input" value="${gradeVal}" placeholder="0.0" min="0" max="5" step="0.01" aria-label="Nota del parcial" oninput="app.onPartialInputChange('${context}')">
        <div class="partial-percent-wrap">
          <input type="number" class="partial-percent partial-percent-input" value="${percentVal}" placeholder="%" min="0" max="100" step="1" aria-label="Peso porcentual" oninput="app.onPartialInputChange('${context}')">
          <span>%</span>
        </div>
        <button type="button" class="btn-remove-partial" aria-label="Eliminar parcial" onclick="app.removePartialRow(this, '${context}')">${icon("x")}</button>
      </div>`;
  }

  renderPartialsContainer(containerId, partials, context) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";
    const rows = partials?.length
      ? partials
      : [
        { name: "P1", grade: "", percent: 30 },
        { name: "P2", grade: "", percent: 30 },
        { name: "P3", grade: "", percent: 40 },
      ];
    rows.forEach((p) => {
      container.insertAdjacentHTML(
        "beforeend",
        this._partialRowHtml(p.name, p.grade, p.percent, context),
      );
    });
    this.updatePartialsSummary(context);
  }

  addPartial(name, grade, percent) {
    const container = document.getElementById("partials-container");
    if (!container) return;
    const count = container.querySelectorAll(".partial-item").length;
    const partialName = name || `P${count + 1}`;
    container.insertAdjacentHTML(
      "beforeend",
      this._partialRowHtml(partialName, grade ?? "", percent ?? "", "form"),
    );
    this.updatePartialsSummary("form");
  }

  addCalcPartial(name, grade, percent) {
    const container = document.getElementById("calc-partials-container");
    if (!container) return;
    const count = container.querySelectorAll(".partial-item").length;
    const partialName = name || `P${count + 1}`;
    container.insertAdjacentHTML(
      "beforeend",
      this._partialRowHtml(partialName, grade ?? "", percent ?? "", "calc"),
    );
    this.updatePartialsSummary("calc");
    this.persistCalcState();
  }

  removePartialRow(btn, context) {
    const row = btn.closest(".partial-item");
    const container = row?.parentElement;
    if (!row || !container) return;
    if (container.querySelectorAll(".partial-item").length <= 1) {
      this.showAlert("Debe haber al menos un parcial", "error");
      return;
    }
    row.remove();
    this.updatePartialsSummary(context);
    if (context === "calc") {
      this.persistCalcState();
      this.calculateCalcGrade(true);
    } else {
      this.calculateGrade(true);
    }
  }

  getPartialsFromContainer(selector) {
    const items = document.querySelectorAll(selector);
    const partials = [];
    items.forEach((item) => {
      const nameInput = item.querySelector(".partial-name-input");
      const gradeInput = item.querySelector(".partial-grade");
      const percentInput = item.querySelector(".partial-percent");
      if (gradeInput && percentInput) {
        const gradeRaw = gradeInput.value;
        partials.push({
          name: (nameInput?.value || "").trim() || "Parcial",
          grade: gradeRaw === "" ? "" : parseFloat(gradeRaw) || 0,
          percent: parseFloat(percentInput.value) || 0,
        });
      }
    });
    return partials;
  }

  getPartialsFromForm() {
    return this.getPartialsFromContainer("#partials-container .partial-item");
  }

  getPartialsFromCalc() {
    return this.getPartialsFromContainer("#calc-partials-container .partial-item");
  }

  updatePartialsSummary(context) {
    const partials =
      context === "calc" ? this.getPartialsFromCalc() : this.getPartialsFromForm();
    const { totalPercent } = evaluatePartials(partials, this.getPassingGrade());
    const totalEl = document.getElementById(
      context === "calc" ? "calc-partials-total" : "form-partials-total",
    );
    if (!totalEl) return;
    totalEl.textContent = `Total ponderación: ${totalPercent}%`;
    totalEl.classList.remove("is-warning", "is-ok");
    if (totalPercent === 100) totalEl.classList.add("is-ok");
    else if (totalPercent > 0) totalEl.classList.add("is-warning");
  }

  onPartialInputChange(context) {
    this.updatePartialsSummary(context);
    if (context === "calc") {
      this.persistCalcState();
      this.calculateCalcGrade(true);
    } else {
      this.calculateGrade(true);
    }
  }

  _renderGradeResult(resultEl, finalEl, statusEl, partials, silent) {
    const { totalPercent, grade, passed, isValid } = evaluatePartials(partials, this.getPassingGrade());
    if (!resultEl || !finalEl || !statusEl) return;
    resultEl.classList.remove("is-visible", "is-error", "is-pass", "is-fail");
    if (partials.length === 0) { if (!silent) return; return; }
    if (!isValid) {
      resultEl.classList.add("is-visible", "is-error");
      finalEl.textContent = totalPercent > 0 ? "—" : "—";
      finalEl.style.color = "var(--error)";
      statusEl.innerHTML =
        totalPercent === 0
          ? "Ingresa notas y porcentajes"
          : `<span class="status-with-icon">${icon("warning")} Los porcentajes deben sumar 100% (actual: ${totalPercent}%)</span>`;
      statusEl.style.color = "var(--error)";
      return;
    }
    const finalGrade = grade.toFixed(2);
    resultEl.classList.add("is-visible", passed ? "is-pass" : "is-fail");
    finalEl.textContent = finalGrade;
    finalEl.style.color = passed ? "var(--success)" : "var(--error)";
    statusEl.innerHTML = passed
      ? `<span class="status-with-icon">${icon("check")} Aprobado</span>`
      : `<span class="status-with-icon">${icon("x")} Reprobado</span>`;
    statusEl.style.color = passed ? "var(--success)" : "var(--error)";
  }

  calculateGrade(silent = false) {
    const partials = this.getPartialsFromForm();
    this._renderGradeResult(
      document.getElementById("grade-result"),
      document.getElementById("final-grade"),
      document.getElementById("grade-status"),
      partials,
      silent,
    );
    const errEl = document.getElementById("partials-error");
    const { totalPercent } = evaluatePartials(partials, this.getPassingGrade());
    if (errEl && totalPercent > 0 && totalPercent !== 100) {
      errEl.textContent = `Faltan ${100 - totalPercent}% para completar la ponderación`;
      errEl.classList.add("is-visible");
    } else if (errEl) {
      errEl.textContent = "";
      errEl.classList.remove("is-visible");
    }
  }

  initPartialInputs() {
    this.renderPartialsContainer("partials-container", [], "form");
  }

  renderCalcView() {
    const courseOptions = this.courses
      .filter((c) => c.status !== "dropped")
      .map(
        (c) =>
          `<option value="${escapeHtml(c.code)}">${escapeHtml(c.code)} — ${escapeHtml(c.name)}</option>`,
      )
      .join("");

    const presetBtns = Object.entries(CALC_PRESETS)
      .map(
        ([key, preset]) =>
          `<button type="button" class="btn btn-secondary btn-small calc-preset-btn" onclick="app.applyCalcPreset('${key}')">${escapeHtml(preset.label)}</button>`,
      )
      .join("");

    const container = document.getElementById("view-content");
    container.innerHTML = `
      <div class="grade-calc-wrap">
        <div class="grade-calc-sticky-bar glass" id="calc-sticky-bar">
          <div class="calc-sticky-left">
            <div class="calc-progress-ring" aria-hidden="true">
              <svg viewBox="0 0 36 36" class="calc-ring-svg">
                <circle class="calc-ring-bg" cx="18" cy="18" r="15.9"></circle>
                <circle class="calc-ring-fill" id="calc-ring-fill" cx="18" cy="18" r="15.9"></circle>
              </svg>
              <span class="calc-ring-label" id="calc-ring-label">0%</span>
            </div>
            <div class="calc-sticky-meta">
              <span class="calc-sticky-grade" id="calc-sticky-grade">—</span>
              <span class="calc-sticky-hint muted">${gradeScaleHint(this.getPassingGrade())}</span>
            </div>
          </div>
          <span class="calc-pass-badge calc-pass-badge--pending" id="calc-pass-badge">Sin datos</span>
        </div>

        <div class="glass-calc-panel grade-calc-panel">
          <div class="grade-calc-header">
            <h2>${icon("calculator", "icon-md")} Calculadora de Notas</h2>
            <p class="grade-calc-subtitle">Calcula, simula y planifica tu nota final ponderada.</p>
          </div>

          <div class="calc-card glass">
            <div class="calc-card-title">${icon("book", "icon-sm")} Materia y plantillas</div>
            <label class="form-label" for="calc-course-select">Sincronizar con materia</label>
            <select id="calc-course-select" class="form-select grade-calc-course-select" onchange="app.onCalcCourseChange(this.value)">
              <option value="">— Manual / sin materia —</option>
              ${courseOptions}
            </select>
            <div class="calc-preset-row">${presetBtns}</div>
            <button type="button" class="btn btn-primary btn-small calc-save-course-btn" id="calc-save-course-btn" onclick="app.saveCalcToCourse()" disabled>
              ${icon("save")} Guardar parciales en materia
            </button>
          </div>

          <div class="calc-card glass">
            <div class="calc-card-title">${icon("clipboard", "icon-sm")} Parciales</div>
            <div class="grade-calc-columns" aria-hidden="true">
              <span>Parcial</span><span>Nota (0–5)</span><span>Peso</span><span></span>
            </div>
            <div id="calc-partials-container" class="partials-scroll-list"></div>
            <div id="calc-validation-warnings" class="calc-validation-warnings" hidden></div>
            <div class="grade-calc-weight-bar" aria-hidden="true">
              <div class="grade-calc-weight-fill" id="calc-weight-fill" style="width:0%"></div>
            </div>
            <div class="grade-calc-summary">
              <span class="grade-calc-total" id="calc-partials-total">Total ponderación: 0%</span>
              <span class="grade-calc-threshold">Mínimo aprobatorio: ${this.getPassingGrade()}</span>
            </div>
            <div class="grade-calc-actions">
              <button type="button" class="btn btn-secondary" onclick="app.addCalcPartial()">${icon("plus")} Agregar parcial</button>
            </div>
          </div>

          <div class="calc-card glass">
            <div class="calc-card-title">${icon("target", "icon-sm")} ¿Qué nota necesito?</div>
            <p class="muted calc-card-desc">Calcula la nota mínima en el peso restante para alcanzar tu meta.</p>
            <div class="calc-required-grid">
              <label class="form-label" for="calc-target-grade">Nota meta</label>
              <input type="number" id="calc-target-grade" class="form-input" value="${this.getPassingGrade()}" min="${GRADE_MIN}" max="${GRADE_MAX}" step="0.01" oninput="app.updateCalcRequired()">
              <label class="form-label" for="calc-remaining-weight">Peso restante (%)</label>
              <input type="number" id="calc-remaining-weight" class="form-input" placeholder="Auto" min="0" max="100" step="1" oninput="app.updateCalcRequired()">
            </div>
            <div id="calc-required-result" class="calc-required-result muted">Ingresa parciales para calcular</div>
          </div>

          <div class="calc-card glass">
            <div class="calc-card-title">${icon("eye", "icon-sm")} Simulador</div>
            <p class="muted calc-card-desc">Agrega un parcial hipotético sin guardarlo.</p>
            <div class="calc-sim-grid">
              <input type="text" id="calc-sim-name" class="form-input" placeholder="Ej. Examen final" maxlength="20">
              <input type="number" id="calc-sim-grade" class="form-input" placeholder="Nota" min="${GRADE_MIN}" max="${GRADE_MAX}" step="0.01" oninput="app.updateCalcSimulator()">
              <input type="number" id="calc-sim-percent" class="form-input" placeholder="Peso %" min="0" max="100" step="1" oninput="app.updateCalcSimulator()">
            </div>
            <div id="calc-sim-result" class="calc-sim-result muted">Sin simulación activa</div>
          </div>

          <div class="calc-card glass" id="calc-insights-card">
            <div class="calc-card-title">${icon("lightbulb", "icon-sm")} Insights</div>
            <div id="calc-insights" class="calc-insights muted">Ingresa notas para ver análisis</div>
          </div>

          <div id="calc-grade-result" class="grade-result-box">
            <div class="grade-result-label">Nota final ponderada</div>
            <div class="grade-result-value" id="calc-final-grade">—</div>
            <div class="grade-result-status" id="calc-grade-status">Ingresa tus parciales</div>
          </div>
        </div>
      </div>`;

    this.loadCalcState();
    this.calculateCalcGrade(true);
    this.updateCalcRequired();
    this.updateCalcSimulator();
  }

  _updateCalcStickyBar(partials, evalResult) {
    const { totalPercent, grade, passed, isValid } = evalResult;
    const ringFill = document.getElementById("calc-ring-fill");
    const ringLabel = document.getElementById("calc-ring-label");
    const stickyGrade = document.getElementById("calc-sticky-grade");
    const badge = document.getElementById("calc-pass-badge");
    const weightFill = document.getElementById("calc-weight-fill");
    const pct = Math.min(100, Math.max(0, totalPercent));
    const dash = `${pct * 0.942} 100`;
    if (ringFill) {
      ringFill.style.strokeDasharray = dash;
      ringFill.classList.toggle("is-complete", pct === 100);
      ringFill.classList.toggle("is-over", pct > 100);
    }
    if (ringLabel) ringLabel.textContent = `${pct}%`;
    if (weightFill) {
      weightFill.style.width = `${pct}%`;
      weightFill.classList.toggle("is-complete", pct === 100);
      weightFill.classList.toggle("is-over", pct > 100);
    }
    if (stickyGrade) {
      stickyGrade.textContent = isValid && grade != null ? grade.toFixed(2) : "—";
      stickyGrade.classList.toggle("is-pass", isValid && passed);
      stickyGrade.classList.toggle("is-fail", isValid && !passed);
    }
    if (badge) {
      badge.classList.remove("calc-pass-badge--pass", "calc-pass-badge--fail", "calc-pass-badge--pending", "calc-pass-badge--warn");
      if (!partials.length || totalPercent === 0) {
        badge.textContent = "Sin datos";
        badge.classList.add("calc-pass-badge--pending");
      } else if (!isValid) {
        badge.textContent = `${totalPercent}%`;
        badge.classList.add("calc-pass-badge--warn");
      } else if (passed) {
        badge.textContent = "Aprobado";
        badge.classList.add("calc-pass-badge--pass");
      } else {
        badge.textContent = "Reprobado";
        badge.classList.add("calc-pass-badge--fail");
      }
    }
  }

  _updateCalcValidation(partials) {
    const el = document.getElementById("calc-validation-warnings");
    if (!el) return;
    const warnings = validatePartialRows(partials);
    if (!warnings.length) { el.hidden = true; el.innerHTML = ""; return; }
    el.hidden = false;
    el.innerHTML = warnings
      .map((w) => `<div class="calc-warning-item">${icon("warning", "icon-sm")} ${escapeHtml(w.message)}</div>`)
      .join("");
  }

  _updateCalcInsights(partials) {
    const el = document.getElementById("calc-insights");
    if (!el) return;
    const weakest = findWeakestPartial(partials);
    const withGrades = partials.filter((p) => p.grade !== "" && !Number.isNaN(parseFloat(p.grade)));
    if (!withGrades.length) {
      el.innerHTML = `<span class="muted">Ingresa notas para ver análisis</span>`;
      return;
    }
    const items = [];
    if (weakest) {
      items.push(
        `<div class="calc-insight-item calc-insight-weak">${icon("bar-chart", "icon-sm")} Parcial más débil: <strong>${escapeHtml(weakest.name)}</strong> (${weakest.grade.toFixed(2)}) · ${weakest.percent}% del total</div>`,
      );
    }
    items.push(`<div class="calc-insight-item muted">${gradeScaleHint(this.getPassingGrade())}</div>`);
    const avg = withGrades.reduce((s, p) => s + parseFloat(p.grade), 0) / withGrades.length;
    items.push(
      `<div class="calc-insight-item">${icon("clipboard", "icon-sm")} Promedio simple de ingresados: <strong>${avg.toFixed(2)}</strong></div>`,
    );
    el.innerHTML = items.join("");
  }

  _updateCalcSaveButton() {
    const btn = document.getElementById("calc-save-course-btn");
    const code = document.getElementById("calc-course-select")?.value;
    if (btn) btn.disabled = !code;
  }

  applyCalcPreset(key) {
    const preset = CALC_PRESETS[key];
    if (!preset) return;
    this.renderPartialsContainer("calc-partials-container", preset.partials.map((p) => ({ ...p })), "calc");
    this.persistCalcState();
    this.calculateCalcGrade(true);
  }

  updateCalcRequired() {
    const partials = this.getPartialsFromCalc();
    const target = parseFloat(document.getElementById("calc-target-grade")?.value) || this.getPassingGrade();
    const remainingRaw = document.getElementById("calc-remaining-weight")?.value;
    const remaining = remainingRaw === "" || remainingRaw == null ? null : remainingRaw;
    const result = computeRequiredGrade(partials, target, remaining);
    const el = document.getElementById("calc-required-result");
    if (!el) return;
    if (result.reason === "no-remaining-weight") {
      el.innerHTML = `<span class="muted">${icon("warning", "icon-sm")} No hay peso restante definido</span>`; return;
    }
    if (result.alreadyMet) {
      el.innerHTML = `<span class="calc-required-ok">${icon("check", "icon-sm")} Ya alcanzas la meta con 0.0 en el ${result.remainingWeight}% restante</span>`; return;
    }
    if (result.impossible) {
      el.innerHTML = `<span class="calc-required-fail">${icon("x", "icon-sm")} Necesitarías ${result.neededRounded.toFixed(2)} (máx. ${GRADE_MAX}) — meta inalcanzable</span>`; return;
    }
    el.innerHTML = `<span class="calc-required-ok">${icon("target", "icon-sm")} Necesitas al menos <strong>${result.neededRounded.toFixed(2)}</strong> en el ${result.remainingWeight}% restante para llegar a ${target.toFixed(2)}</span>`;
  }

  updateCalcSimulator() {
    const partials = this.getPartialsFromCalc();
    const name = document.getElementById("calc-sim-name")?.value || "Simulado";
    const grade = document.getElementById("calc-sim-grade")?.value;
    const percent = parseFloat(document.getElementById("calc-sim-percent")?.value);
    const el = document.getElementById("calc-sim-result");
    if (!el) return;
    if (!percent || percent <= 0) {
      el.innerHTML = `<span class="muted">Ingresa peso % para simular</span>`; return;
    }
    const evalResult = evaluateWithHypothetical(partials, { name, grade: grade === "" ? 0 : grade, percent });
    if (!evalResult.isValid) {
      el.innerHTML = `<span class="muted">${icon("warning", "icon-sm")} Con «${escapeHtml(name)}» (${percent}%) la ponderación total sería ${evalResult.totalPercent}%</span>`; return;
    }
    const status = evalResult.passed ? "Aprobado" : "Reprobado";
    const statusClass = evalResult.passed ? "calc-sim-pass" : "calc-sim-fail";
    el.innerHTML = `<span class="${statusClass}">${icon("eye", "icon-sm")} Proyección con simulación: <strong>${evalResult.grade.toFixed(2)}</strong> · ${status}</span>`;
  }

  async saveCalcToCourse() {
    const code = document.getElementById("calc-course-select")?.value;
    if (!code) { this.showAlert("Selecciona una materia primero", "error"); return; }
    const course = this.courses.find((c) => c.code === code);
    if (!course) return;
    const partials = this.getPartialsFromCalc();
    const { totalPercent } = evaluatePartials(partials, this.getPassingGrade());
    if (totalPercent !== 100) {
      this.showAlert(`La ponderación debe sumar 100% (actual: ${totalPercent}%)`, "error"); return;
    }
    try {
      await api.updateCourse(code, { ...course, partials });
      const idx = this.courses.findIndex((c) => c.code === code);
      if (idx >= 0) this.courses[idx] = { ...course, partials };
      if (this._coursesFull) {
        const fidx = this._coursesFull.findIndex((c) => c.code === code);
        if (fidx >= 0) this._coursesFull[fidx] = { ...course, partials };
      }
      this.showAlert(`Parciales guardados en ${code}`, "success");
    } catch (e) {
      this.showAlert(e.message || "Error al guardar", "error");
    }
  }

  loadCalcState() {
    let partials = [];
    try {
      const saved = localStorage.getItem("amellify-calc-state");
      if (saved) partials = JSON.parse(saved);
    } catch { partials = []; }
    if (!Array.isArray(partials) || partials.length === 0) {
      partials = [
        { name: "P1", grade: "", percent: 30 },
        { name: "P2", grade: "", percent: 30 },
        { name: "P3", grade: "", percent: 40 },
      ];
    }
    this.renderPartialsContainer("calc-partials-container", partials, "calc");
  }

  persistCalcState() {
    try {
      localStorage.setItem("amellify-calc-state", JSON.stringify(this.getPartialsFromCalc()));
    } catch { }
  }

  onCalcCourseChange(code) {
    if (!code) { this.loadCalcState(); this.calculateCalcGrade(true); this._updateCalcSaveButton(); return; }
    const course = this.courses.find((c) => c.code === code);
    const partials = course?.partials?.length
      ? course.partials
      : [{ name: "P1", grade: "", percent: 30 }, { name: "P2", grade: "", percent: 30 }, { name: "P3", grade: "", percent: 40 }];
    this.renderPartialsContainer("calc-partials-container", partials, "calc");
    document.getElementById("calc-course-select").value = code;
    this.persistCalcState();
    this.calculateCalcGrade(true);
    this._updateCalcSaveButton();
  }

  calculateCalcGrade(silent = false) {
    const partials = this.getPartialsFromCalc();
    const evalResult = evaluatePartials(partials, this.getPassingGrade());
    this._renderGradeResult(
      document.getElementById("calc-grade-result"),
      document.getElementById("calc-final-grade"),
      document.getElementById("calc-grade-status"),
      partials, silent,
    );
    this._updateCalcStickyBar(partials, evalResult);
    this._updateCalcValidation(partials);
    this._updateCalcInsights(partials);
    this.updateCalcRequired();
    this.updateCalcSimulator();
    this._updateCalcSaveButton();
  }

  initCalcPartials() { this.loadCalcState(); }

  renderGridView() {
    const container = document.getElementById("view-content");
    const days = typeof this.getScheduleDays === "function"
      ? this.getScheduleDays()
      : ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

    const allSchedules = [];
    for (const course of this.courses) {
      for (const s of course.schedules || []) {
        allSchedules.push({ ...s, course });
      }
    }

    const SLOT_MIN = 10;

    const timeToMin = (t) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };

    let startHour = 0;
    let endHour = 24;

    if (this.settings.gridHourRange === 'active' && allSchedules.length > 0) {
      let minH = 24;
      let maxH = 0;
      for (const s of allSchedules) {
        const sh = parseInt(s.start_time.split(':')[0], 10);
        const [ehStr, emStr] = s.end_time.split(':').map(Number);
        const eh = emStr > 0 ? ehStr + 1 : ehStr;
        if (sh < minH) minH = sh;
        if (eh > maxH) maxH = eh;
      }
      startHour = Math.max(0, minH - 1);
      endHour = Math.min(24, maxH + 1);
    } else if (this.settings.gridHourRange === 'active') {
      startHour = 6;
      endHour = 22;
    }

    const originMin = startHour * 60;
    const totalSlots = (endHour * 60 - originMin) / SLOT_MIN;

    let SLOT_H = this.settings.gridCompact ? 10 : 16;
    if (this.settings.gridFitScreen) {
      SLOT_H = Math.max(6, Math.min(14, Math.floor((window.innerHeight - 250) / totalSlots)));
    }

    const timeToRow = (t) => {
      const min = timeToMin(t);
      return Math.round((min - originMin) / SLOT_MIN) + 2;
    };

    let hourLabels = '';
    const slotsPerHour = 60 / SLOT_MIN;
    for (let h = startHour; h < endHour; h++) {
      const rowStart = Math.round((h * 60 - originMin) / SLOT_MIN) + 2;
      const rowEnd = rowStart + slotsPerHour;
      const label = this.formatTimeDisplay(`${String(h).padStart(2, '0')}:00`);
      hourLabels += `<div class="grid-hour-label" style="grid-column:1; grid-row:${rowStart} / ${rowEnd};">${label}</div>`;
    }

    let hourLines = '';
    for (let h = startHour; h <= endHour; h++) {
      const row = Math.round((h * 60 - originMin) / SLOT_MIN) + 2;
      hourLines += `<div class="grid-hour-line" style="grid-column:1 / -1; grid-row:${row};"></div>`;
    }

    let emptySlots = '';
    for (let di = 0; di < days.length; di++) {
      const col = di + 2;
      for (let h = startHour; h < endHour; h++) {
        const rowStart = Math.round((h * 60 - originMin) / SLOT_MIN) + 2;
        const rowEnd = rowStart + slotsPerHour;
        const timeStr = `${String(h).padStart(2, '0')}:00`;
        emptySlots += `<div class="grid-empty-slot" style="grid-column:${col}; grid-row:${rowStart} / ${rowEnd}; cursor:pointer;" onclick="app.openAddCourseModal('${days[di]}', '${timeStr}')" title="Click para agregar materia los ${days[di]} a las ${timeStr}"></div>`;
      }
    }

    const now = new Date();
    const todayMap = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const todayName = todayMap[now.getDay()];
    const nowMin = now.getHours() * 60 + now.getMinutes();

    let daySeparators = '';
    for (let di = 0; di < days.length; di++) {
      const isToday = days[di] === todayName;
      if (isToday) {
        daySeparators += `<div class="grid-today-bg" style="grid-column:${di + 2}; grid-row:1 / ${totalSlots + 2};"></div>`;
      }
      daySeparators += `<div class="grid-day-separator" style="grid-column:${di + 2}; grid-row:2 / ${totalSlots + 2};"></div>`;
    }
    daySeparators += `<div class="grid-day-separator" style="grid-column:${days.length + 2}; grid-row:2 / ${totalSlots + 2}; border-left:none; border-right:1px solid var(--border);"></div>`;

    let currentTimeIndicator = '';
    if (nowMin >= originMin && nowMin < endHour * 60) {
      const currentRow = Math.round((nowMin - originMin) / SLOT_MIN) + 2;
      const todayColumnIndex = days.indexOf(todayName);
      const circleColumn = todayColumnIndex >= 0 ? todayColumnIndex + 2 : 1;
      currentTimeIndicator = `
        <div class="current-time-indicator" style="grid-column: 1 / -1; grid-row: ${currentRow}; position: relative; z-index: 100; pointer-events: none;">
          <div style="position: absolute; left: 0; right: 0; top: 0; height: 2px; background: var(--danger); box-shadow: 0 0 8px rgba(255, 59, 48, 0.5);"></div>
        </div>
        <div class="current-time-circle" style="grid-column: ${circleColumn}; grid-row: ${currentRow}; position: relative; z-index: 101; pointer-events: none; display: flex; justify-content: center; align-items: flex-start;">
          <div style="width: 10px; height: 10px; background: var(--danger); border-radius: 50%; box-shadow: 0 0 8px rgba(255, 59, 48, 0.7), 0 0 16px rgba(255, 59, 48, 0.4); border: 2px solid var(--bg-secondary); margin-top: -4px;"></div>
        </div>`;
    }

    let classBlocks = '';
    for (const s of allSchedules) {
      const dayIdx = days.indexOf(s.day);
      if (dayIdx === -1) continue;
      const rowStart = timeToRow(s.start_time);
      const rowEnd = timeToRow(s.end_time);
      if (rowEnd <= 2 || rowStart >= totalSlots + 2) continue;
      const col = dayIdx + 2;
      const isToday = s.day === todayName;
      const partials = s.course.partials || [];
      let gradeHtml = '';
      if (partials.length > 0) {
        const finalGrade = this.calculateFinalGrade(partials);
        if (finalGrade !== null) {
          const passed = finalGrade >= this.getPassingGrade();
          const gradeColor = passed ? 'var(--success)' : 'var(--error)';
          gradeHtml = '<div class="class-cell-grade" style="font-size:11px;font-weight:700;margin-top:4px;padding:2px 6px;border-radius:4px;background:' + gradeColor + ';color:#fff;">' + finalGrade.toFixed(2) + '</div>';
        }
      }
      classBlocks += `
        <div class="class-cell${this.settings.gridDragDisabled ? '' : ' draggable-cell'} color-${escapeHtml(s.course.color)}"
             ${this.settings.gridDragDisabled ? '' : 'draggable="true"'}
             data-code="${escapeJsString(s.course.code)}"
             data-sched-id="${Number(s.id) || 0}"
             data-day="${escapeHtml(s.day)}"
             data-start="${escapeHtml(s.start_time)}"
             data-end="${escapeHtml(s.end_time)}"
             onclick="app.showClassDetails('${escapeJsString(s.course.code)}', ${Number(s.id) || 0})"
             title="${escapeHtml(s.course.name)}${s.course.professor ? ` · ${escapeHtml(s.course.professor)}` : ''}${this.settings.gridDragDisabled ? '' : ' — arrastra para mover'}"
             style="grid-column:${col}; grid-row:${rowStart} / ${rowEnd}; margin:1px 2px;${isToday ? ' box-shadow: var(--shadow-sm);' : ''}">
          <div class="class-cell-code">${escapeHtml(s.course.code)}</div>
          <div class="class-cell-name">${escapeHtml(s.course.name)}</div>
          ${s.course.professor ? `<div class="class-cell-prof" style="font-size:11px;opacity:0.8;margin-top:2px;">${icon("user", "icon-sm")} ${escapeHtml(s.course.professor)}</div>` : ''}
          ${gradeHtml}
          ${s.room ? `<div class="class-cell-room meta-with-icon">${icon("building", "icon-sm")} ${escapeHtml(s.room)}</div>` : ''}
          <div style="font-size:var(--grid-cell-time-size, 14px);margin-top:auto;opacity:0.5;font-family:'IBM Plex Mono',monospace;">${escapeHtml(s.start_time)}–${escapeHtml(s.end_time)}</div>
        </div>`;
    }

    const dayHeaders = days.map((d, i) => {
      const isToday = d === todayName;
      const style = isToday
        ? `grid-column:${i + 2}; grid-row:1; color:var(--accent); font-weight:700;`
        : `grid-column:${i + 2}; grid-row:1;`;
      return `<div class="grid-header-cell" style="${style}">${d}</div>`;
    }).join('');

    const emptyOverlay = allSchedules.length === 0 ? `
      <div id="empty-state-backdrop" onclick="this.nextElementSibling.remove(); this.remove();" style="position: fixed; inset: 0; background: rgba(0, 0, 0, 0.4); backdrop-filter: blur(4px); z-index: 199; animation: fadeIn 0.3s ease-out;"></div>
      <div id="empty-state-overlay" style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 200; background: var(--bg-secondary); border-radius: 20px; padding: 48px 40px; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4); border: 1px solid var(--border); max-width: 480px; text-align: center; animation: fadeInScale 0.3s ease-out;">
        <button onclick="document.getElementById('empty-state-overlay').remove(); document.getElementById('empty-state-backdrop').remove();" style="position: absolute; top: 16px; right: 16px; background: transparent; border: none; font-size: 28px; color: var(--text-tertiary); cursor: pointer; opacity: 0.4; transition: opacity 0.2s, transform 0.2s; padding: 4px 8px; line-height: 1; font-weight: 300;" onmouseover="this.style.opacity='0.8'; this.style.transform='rotate(90deg)';" onmouseout="this.style.opacity='0.4'; this.style.transform='rotate(0deg)';">×</button>
        <div class="empty-state-icon">${icon("calendar", "icon-lg")}</div>
        <div style="font-size: 20px; font-weight: 700; color: var(--text-primary); margin-bottom: 12px;">No hay materias con horarios asignados</div>
        <div style="font-size: 15px; color: var(--text-secondary); line-height: 1.6; margin-bottom: 28px;">Comienza agregando tu primera materia para ver tu horario semanal</div>
        <button class="btn btn-primary" onclick="app.openAddCourseModal(); document.getElementById('empty-state-overlay').remove(); document.getElementById('empty-state-backdrop').remove();" style="font-size: 16px; padding: 14px 32px; box-shadow: 0 4px 12px rgba(0, 122, 255, 0.3);">${icon("plus")} Agregar Primera Materia</button>
      </div>
      <style>
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeInScale { from { opacity: 0; transform: translate(-50%, -50%) scale(0.9); } to { opacity: 1; transform: translate(-50%, -50%) scale(1); } }
      </style>
    ` : '';

    const internalWidthVal = this.settings.internalGridWidth || '1500px';
    const minWidthVal = internalWidthVal === '100%' ? '100%' : (internalWidthVal.endsWith('px') ? internalWidthVal : `${internalWidthVal}px`);

    container.innerHTML = `
      <div class="grid-schedule" id="grid-schedule-container">
        <div class="grid-timeline" id="grid-timeline" style="display: grid; grid-template-columns: 56px repeat(${days.length}, 1fr); grid-template-rows: auto repeat(${totalSlots}, ${SLOT_H}px); min-width: ${minWidthVal}; position: relative;">
          <div class="grid-header-cell" style="grid-column:1; grid-row:1;">Hora</div>
          ${dayHeaders}
          ${daySeparators}
          ${emptySlots}
          ${hourLines}
          ${hourLabels}
          ${currentTimeIndicator}
          ${classBlocks}
        </div>
      </div>
      ${emptyOverlay}`;

    const slotHeight = SLOT_H;
    setTimeout(() => {
      const scheduleContainer = document.getElementById('grid-schedule-container');
      if (!scheduleContainer) return;
      const headerHeight = 40;
      if (allSchedules.length > 0) {
        const todaySchedules = allSchedules.filter(s => s.day === todayName);
        if (todaySchedules.length > 0) {
          let targetSchedule = null;
          for (const s of todaySchedules) {
            const startMin = timeToMin(s.start_time);
            const endMin = timeToMin(s.end_time);
            if (nowMin >= startMin && nowMin <= endMin) { targetSchedule = s; break; }
          }
          if (!targetSchedule) {
            const futureClasses = todaySchedules.filter(s => timeToMin(s.start_time) > nowMin).sort((a, b) => timeToMin(a.start_time) - timeToMin(b.start_time));
            if (futureClasses.length > 0) targetSchedule = futureClasses[0];
          }
          if (!targetSchedule) {
            targetSchedule = todaySchedules.sort((a, b) => timeToMin(a.start_time) - timeToMin(b.start_time))[0];
          }
          if (targetSchedule) {
            const classStartMin = timeToMin(targetSchedule.start_time);
            const classEndMin = timeToMin(targetSchedule.end_time);
            const classMidMin = (classStartMin + classEndMin) / 2;
            const pixelsFromOrigin = (classMidMin - originMin) * (slotHeight / SLOT_MIN);
            const scrollPosition = pixelsFromOrigin - (scheduleContainer.clientHeight / 2) + headerHeight;
            scheduleContainer.scrollTop = Math.max(0, scrollPosition);
            return;
          }
        }
        const earliestClass = allSchedules.sort((a, b) => timeToMin(a.start_time) - timeToMin(b.start_time))[0];
        if (earliestClass) {
          const classStartMin = timeToMin(earliestClass.start_time);
          const pixelsFromOrigin = (classStartMin - originMin) * (slotHeight / SLOT_MIN);
          const scrollPosition = pixelsFromOrigin - (scheduleContainer.clientHeight / 2) + headerHeight;
          scheduleContainer.scrollTop = Math.max(0, scrollPosition);
          return;
        }
      }
      if (nowMin >= 0 && nowMin < 1440) {
        const pixelsFromOrigin = (nowMin - originMin) * (slotHeight / SLOT_MIN);
        const scrollPosition = pixelsFromOrigin - (scheduleContainer.clientHeight / 2) + headerHeight;
        scheduleContainer.scrollTop = Math.max(0, scrollPosition);
      }
    }, 50);

    if (this.currentTimeUpdateInterval) clearInterval(this.currentTimeUpdateInterval);
    this.currentTimeUpdateInterval = setInterval(() => {
      if (this.currentView === 'grid') this.renderGridView();
    }, 60000);
  }

  renderWeekView() {
    const container = document.getElementById("view-content");
    const days = typeof this.getScheduleDays === "function"
      ? this.getScheduleDays()
      : ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

    const byDay = {};
    for (const d of days) byDay[d] = [];
    for (const course of this.courses) {
      for (const s of course.schedules || []) {
        if (byDay[s.day]) byDay[s.day].push({ ...s, course });
      }
    }
    for (const d of days)
      byDay[d].sort((a, b) => a.start_time.localeCompare(b.start_time));

    const todayMap = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
    const today = todayMap[new Date().getDay()];

    let html = `<div class="week-grid">`;
    for (const day of days) {
      const classes = byDay[day];
      const isToday = day === today;
      html += `
        <div class="day-card" style="${isToday ? "box-shadow: 0 0 0 2px var(--accent);" : ""}">
          <div class="day-header" style="${isToday ? "background: var(--accent); color: white;" : ""}">
            <div class="day-name">${isToday ? icon("map-pin", "icon-sm") + " " : ""}${day}</div>
            <div class="day-count" style="${isToday ? "color:rgba(255,255,255,0.8)" : ""}">${classes.length} clase${classes.length !== 1 ? "s" : ""}</div>
          </div>
          <div class="day-classes">`;
      if (classes.length === 0) {
        html += `<div style="text-align:center;padding:24px 12px;color:var(--text-tertiary);font-size:13px;">Sin clases</div>`;
      } else {
        for (const c of classes) {
          html += `
            <div class="class-item color-${escapeHtml(c.course.color)}" onclick="app.showClassDetails('${escapeJsString(c.course.code)}', ${Number(c.id) || 0})">
              <div class="class-time">${escapeHtml(this.formatTimeDisplay(c.start_time))} – ${escapeHtml(this.formatTimeDisplay(c.end_time))}</div>
              <div class="class-title">${escapeHtml(c.course.name)}</div>
              <div class="class-details">
                ${escapeHtml(c.course.code)}${c.room ? " · " + icon("building", "icon-sm") + " " + escapeHtml(c.room) : ""}${c.course.professor ? " · " + escapeHtml(c.course.professor) : ""}
              </div>
            </div>`;
        }
      }
      html += `</div></div>`;
    }
    html += `</div>`;
    container.innerHTML = html;
  }

  renderListView() {
    const container = document.getElementById("view-content");
    if (this.courses.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">${icon("book", "icon-lg")}</div>
          <div class="empty-state-text">No tienes materias registradas aún</div>
          <button class="btn btn-primary" style="margin-top:16px" onclick="app.openAddCourseModal()">${icon("plus")} Agregar Primera Materia</button>
        </div>`;
      return;
    }
    const statusLabelMap = { active: "Activas", paused: "En Pausa", completed: "Completadas", dropped: "Retiradas" };
    const groups = [
      { key: "active", label: statusLabelMap.active, courses: this.courses.filter((c) => c.status === "active") },
      { key: "paused", label: statusLabelMap.paused, courses: this.courses.filter((c) => c.status === "paused") },
      { key: "completed", label: statusLabelMap.completed, courses: this.courses.filter((c) => c.status === "completed") },
      { key: "dropped", label: statusLabelMap.dropped, courses: this.courses.filter((c) => c.status === "dropped") },
    ].filter((g) => g.courses.length > 0);

    let html = '<div class="scroll-panel view-scroll-panel">';
    for (const group of groups) {
      html += `<div class="group-label-with-dot" style="margin-bottom:8px;font-size:13px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;">${statusDot(group.key)} ${group.label}</div>`;
      html += `<div class="course-list" style="margin-bottom:24px;">`;
      for (const course of group.courses) {
        html += `
          <div class="course-card color-${escapeHtml(course.color)}">
            <div class="course-header">
              <div style="flex:1;">
                <div class="course-name">${escapeHtml(course.name)}</div>
                <div class="course-code">${escapeHtml(course.code)}${course.semester ? " · " + escapeHtml(course.semester) : ""}</div>
              </div>
              <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
                <div class="course-credits">${Number(course.credits) || 0} cr.</div>
              </div>
            </div>
            ${(course.schedules || []).length > 0 ? `
              <div class="course-schedule">
                ${course.schedules.map((s) => `
                  <span class="schedule-tag meta-with-icon">${icon("calendar", "icon-sm")} ${escapeHtml(s.day)} ${escapeHtml(this.formatTimeDisplay(s.start_time))}–${escapeHtml(this.formatTimeDisplay(s.end_time))}${s.room ? " · " + escapeHtml(s.room) : ""}</span>
                `).join("")}
              </div>` : ""}
            ${course.professor ? `<div class="course-professor meta-with-icon">${icon("user", "icon-sm")} ${escapeHtml(course.professor)}${course.email ? ` · <a href="mailto:${escapeHtml(course.email)}" style="color:inherit;text-decoration:underline;">${escapeHtml(course.email)}</a>` : ""}</div>` : ""}
            ${course.faculty ? `<div class="meta-with-icon" style="font-size:13px;color:var(--text-secondary);margin-top:4px;">${icon("landmark", "icon-sm")} ${escapeHtml(course.faculty)}</div>` : ""}
            ${course.notes ? `<div style="font-size:13px;color:var(--text-secondary);margin-top:8px;font-style:italic;padding:8px;background:var(--bg-primary);border-radius:6px;">${escapeHtml(course.notes)}</div>` : ""}
            <div class="course-actions">
              <button class="btn btn-secondary btn-small" onclick="app.openEditCourseModal('${escapeJsString(course.code)}')">${icon("edit")} Editar</button>
              <button class="btn btn-danger btn-small" onclick="app.confirmDeleteCourse('${escapeJsString(course.code)}')">${icon("trash")} Eliminar</button>
            </div>
          </div>`;
      }
      html += `</div>`;
    }
    html += `</div>`;
    container.innerHTML = html;
  }

  openAddCourseModal() {
    this.editingCode = null;
    this.scheduleSlots = [];
    document.getElementById("course-modal-title").innerHTML = `${icon("plus", "icon-md")} Nueva Materia`;
    document.getElementById("course-form").reset();
    document.getElementById("edit-course-code").value = "";
    document.getElementById("btn-delete-course").style.display = "none";
    document.getElementById("course-extra-actions").innerHTML = "";
    this.clearCourseFormErrors();
    this.renderScheduleSlots();
    this.initPartialInputs();
    this.setColor("blue");
    document.getElementById("grade-result")?.classList.remove("is-visible");
    document.getElementById("course-modal").classList.add("active");
  }

  openEditCourseModal(code) {
    const course = this.courses.find((c) => c.code === code);
    if (!course) return;
    this.editingCode = code;
    this.scheduleSlots = (course.schedules || []).map((s) => ({ ...s }));
    document.getElementById("course-modal-title").innerHTML = `${icon("edit", "icon-md")} Editar Materia`;
    document.getElementById("edit-course-code").value = code;
    document.getElementById("course-code").value = course.code;
    document.getElementById("course-name").value = course.name;
    document.getElementById("course-credits").value = course.credits;
    document.getElementById("course-professor").value = course.professor || "";
    document.getElementById("course-email").value = course.email || "";
    document.getElementById("course-faculty").value = course.faculty || "";
    document.getElementById("course-semester").value = course.semester || "";
    document.getElementById("course-status").value = course.status || "active";
    document.getElementById("course-notes").value = course.notes || "";
    document.getElementById("btn-delete-course").style.display = "inline-flex";
    this.clearCourseFormErrors();
    this.setColor(course.color || "blue");
    this.renderScheduleSlots();
    this.renderPartialsContainer("partials-container", course.partials?.length ? course.partials : [], "form");
    this.calculateGrade(true);
    document.getElementById("class-modal").classList.remove("active");
    document.getElementById("course-modal").classList.add("active");
  }

  clearCourseFormErrors() {
    document.querySelectorAll("#course-form .form-field-error").forEach((el) => { el.textContent = ""; el.classList.remove("is-visible"); });
    document.querySelectorAll("#course-form .form-input.is-invalid, #course-form .form-select.is-invalid").forEach((el) => el.classList.remove("is-invalid"));
  }

  setFieldError(fieldId, errorId, message) {
    const field = document.getElementById(fieldId);
    const error = document.getElementById(errorId);
    if (field) field.classList.add("is-invalid");
    if (error) { error.textContent = message; error.classList.add("is-visible"); }
  }

  validateCourseFormData() {
    this.clearCourseFormErrors();
    let valid = true;
    const isEdit = !!this.editingCode;
    const codeResult = validateCourseCode(document.getElementById("course-code").value);
    if (!codeResult.valid) { this.setFieldError("course-code", "course-code-error", codeResult.error); valid = false; }
    else if (!isEdit && this.courses.some((c) => c.code === codeResult.code)) { this.setFieldError("course-code", "course-code-error", `Ya existe una materia con el código ${codeResult.code}`); valid = false; }
    else if (isEdit && codeResult.code !== this.editingCode && this.courses.some((c) => c.code === codeResult.code)) { this.setFieldError("course-code", "course-code-error", `Ya existe una materia con el código ${codeResult.code}`); valid = false; }
    const name = document.getElementById("course-name").value.trim();
    if (!name) { this.setFieldError("course-name", "course-name-error", "El nombre es obligatorio"); valid = false; }
    const credits = parseInt(document.getElementById("course-credits").value, 10);
    if (!credits || credits < 1 || credits > 20) { this.setFieldError("course-credits", "course-credits-error", "Ingresa créditos entre 1 y 20"); valid = false; }
    const email = document.getElementById("course-email").value.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { this.setFieldError("course-email", "course-email-error", "Email no válido"); valid = false; }
    const partials = this.getPartialsFromForm();
    const allEmpty = partials.every((p) => p.grade === '' || p.grade === null || p.grade === undefined);
    const noWeights = partials.every((p) => !p.percent);
    if (!allEmpty && !noWeights) {
      const { totalPercent } = evaluatePartials(partials, this.getPassingGrade());
      if (totalPercent !== 100) {
        const errEl = document.getElementById("partials-error");
        if (errEl) { errEl.textContent = `Los parciales deben sumar 100% (actual: ${totalPercent}%)`; errEl.classList.add("is-visible"); }
        valid = false;
      }
    }
    const scheduleErrors = [];
    this.scheduleSlots.forEach((slot, i) => {
      const result = validateScheduleSlot(slot);
      if (!result.valid) scheduleErrors.push(`Horario ${i + 1}: ${result.error}`);
    });
    if (scheduleErrors.length) {
      const errEl = document.getElementById("schedule-error");
      if (errEl) { errEl.textContent = scheduleErrors.join(" · "); errEl.classList.add("is-visible"); }
      valid = false;
    }
    return valid;
  }

  checkCourseCodeDuplicate() {
    const isEdit = !!this.editingCode;
    const codeResult = validateCourseCode(document.getElementById("course-code").value);
    const errorEl = document.getElementById("course-code-error");
    const field = document.getElementById("course-code");
    if (!codeResult.valid) return;
    const duplicate = (!isEdit && this.courses.some((c) => c.code === codeResult.code)) ||
      (isEdit && codeResult.code !== this.editingCode && this.courses.some((c) => c.code === codeResult.code));
    if (duplicate) {
      field?.classList.add("is-invalid");
      if (errorEl) { errorEl.textContent = `Ya existe una materia con el código ${codeResult.code}`; errorEl.classList.add("is-visible"); }
    } else if (errorEl?.textContent.includes("Ya existe")) {
      field?.classList.remove("is-invalid");
      errorEl.textContent = ""; errorEl.classList.remove("is-visible");
    }
  }

  addScheduleSlot() {
    this.scheduleSlots.push({ day: "Lunes", start_time: "08:00", end_time: "10:00", room: "" });
    this.renderScheduleSlots();
  }

  removeScheduleSlot(index) {
    this.scheduleSlots.splice(index, 1);
    this.renderScheduleSlots();
  }

  updateSlot(index, field, value) {
    if (this.scheduleSlots[index]) {
      this.scheduleSlots[index][field] = value;
      if (this._updateSlotTimeout) clearTimeout(this._updateSlotTimeout);
      if (field === 'day' || field === 'start_time' || field === 'end_time') {
        this._updateSlotTimeout = setTimeout(() => { this.renderScheduleSlots(); }, 800);
      }
    }
  }

  renderScheduleSlots() {
    const container = document.getElementById("schedule-list");
    const days = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
    if (this.scheduleSlots.length === 0) {
      container.innerHTML = `<div class="schedule-empty">Sin horarios asignados. Agrega bloques de clase abajo.</div>`;
      return;
    }
    const slotConflicts = this.scheduleSlots.map((slot) => {
      if (!slot.day || !slot.start_time || !slot.end_time) return [];
      return this.getConflicts([slot], this.editingCode);
    });
    container.innerHTML = this.scheduleSlots.map((slot, i) => {
      const conflicts = slotConflicts[i];
      const hasConflict = conflicts.length > 0;
      const timeValidation = validateScheduleSlot(slot);
      const rowClass = ["schedule-slot-row", hasConflict ? "has-conflict" : "", !timeValidation.valid && slot.start_time && slot.end_time ? "has-time-error" : ""].filter(Boolean).join(" ");
      const conflictWarning = hasConflict ? `<div class="schedule-slot-warning"><strong>Conflicto:</strong> ${conflicts.map(c => `<strong>${escapeHtml(c.course.name)}</strong> (${escapeHtml(c.existing.start_time)}–${escapeHtml(c.existing.end_time)})`).join(", ")} ya ocupa este horario.</div>` : "";
      const timeWarning = !timeValidation.valid && slot.start_time && slot.end_time ? `<div class="schedule-slot-warning">${escapeHtml(timeValidation.error)}</div>` : "";
      return `<div class="${rowClass}">
        <div><label class="form-label" for="schedule-day-${i}">Día</label><select id="schedule-day-${i}" class="form-select" onchange="app.updateSlot(${i},'day',this.value)">${days.map(d => `<option value="${d}" ${slot.day === d ? 'selected' : ''}>${d}</option>`).join('')}</select></div>
        <div><label class="form-label" for="schedule-start-${i}">Inicio</label><input id="schedule-start-${i}" type="time" class="form-input" value="${slot.start_time}" oninput="app.updateSlot(${i},'start_time',this.value)"></div>
        <div><label class="form-label" for="schedule-end-${i}">Fin</label><input id="schedule-end-${i}" type="time" class="form-input" value="${slot.end_time}" oninput="app.updateSlot(${i},'end_time',this.value)"></div>
        <div><label class="form-label" for="schedule-room-${i}">Aula</label><input id="schedule-room-${i}" type="text" class="form-input" value="${escapeHtml(slot.room || '')}" placeholder="A-201" oninput="app.updateSlot(${i},'room',this.value)"></div>
        <div style="padding-bottom:1px;"><button type="button" class="btn btn-danger btn-small" aria-label="Eliminar horario" onclick="app.removeScheduleSlot(${i})">${icon("x")}</button></div>
        ${timeWarning}${conflictWarning}
      </div>`;
    }).join('');
  }

  setColor(color) {
    document.querySelectorAll(".color-option").forEach((el) => { el.classList.toggle("selected", el.dataset.color === color); });
    document.getElementById("course-color").value = color;
    const colorMap = {
      red: { bg: "#ffebee", border: "#ef5350", text: "#c62828" },
      blue: { bg: "#e3f2fd", border: "#42a5f5", text: "#1565c0" },
      green: { bg: "#e8f5e9", border: "#66bb6a", text: "#2e7d32" },
      orange: { bg: "#fff3e0", border: "#ffa726", text: "#e65100" },
      purple: { bg: "#f3e5f5", border: "#ab47bc", text: "#6a1b9a" },
      teal: { bg: "#e0f2f1", border: "#26a69a", text: "#00695c" },
    };
    const c = colorMap[color] || colorMap.blue;
    const preview = document.getElementById("color-preview");
    if (preview) { preview.style.background = c.bg; preview.style.borderColor = c.border; preview.style.color = c.text; preview.style.borderWidth = "1px"; preview.style.borderStyle = "solid"; }
  }

  timeToMin(t) { const [h, m] = t.split(':').map(Number); return h * 60 + m; }

  slotsOverlap(a, b) {
    if (a.day !== b.day) return false;
    const aStart = this.timeToMin(a.start_time), aEnd = this.timeToMin(a.end_time);
    const bStart = this.timeToMin(b.start_time), bEnd = this.timeToMin(b.end_time);
    return aStart < bEnd && bStart < aEnd;
  }

  getConflicts(newSlots, excludeCode = null) {
    const conflicts = [];
    for (const newSlot of newSlots) {
      for (const course of this.courses) {
        if (excludeCode && course.code === excludeCode) continue;
        if (course.status === 'dropped') continue;
        for (const existing of (course.schedules || [])) {
          if (this.slotsOverlap(newSlot, existing)) conflicts.push({ newSlot, existing, course });
        }
      }
    }
    return conflicts;
  }

  showConflictModal(conflicts, onForceCancel) {
    document.getElementById('conflict-modal')?.remove();
    const rows = conflicts.map(({ newSlot, existing, course }) => `
      <div class="conflict-row">
        <div class="conflict-row-title">${icon("zap", "icon-sm")} Conflicto detectado — ${icon("calendar", "icon-sm")} ${escapeHtml(newSlot.day)}</div>
        <div class="conflict-row-grid">
          <div class="conflict-block conflict-block-new">
            <div class="conflict-block-label">${icon("clock", "icon-sm")} Quieres agregar</div>
            <div class="conflict-block-time">${escapeHtml(newSlot.start_time)} – ${escapeHtml(newSlot.end_time)}</div>
            ${newSlot.room ? `<div class="conflict-block-meta">${icon("building", "icon-sm")} ${escapeHtml(newSlot.room)}</div>` : ""}
          </div>
          <div class="conflict-vs">${icon("x", "icon-md")}</div>
          <div class="conflict-block">
            <div class="conflict-block-label">${icon("book", "icon-sm")} Ya existe</div>
            <div class="conflict-block-time">${escapeHtml(existing.start_time)} – ${escapeHtml(existing.end_time)}</div>
            <div class="conflict-block-name">${escapeHtml(course.name)}</div>
            <div class="conflict-block-meta">${escapeHtml(course.code)}${existing.room ? ` · ${icon("building", "icon-sm")} ${escapeHtml(existing.room)}` : ""}</div>
          </div>
        </div>
      </div>
    `).join('');

    const modal = document.createElement('div');
    modal.id = 'conflict-modal';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);backdrop-filter:blur(12px);z-index:2000;display:flex;align-items:center;justify-content:center;padding:24px;animation:fadeInConflict 0.2s ease-out;';

    if (!document.getElementById('conflict-keyframe')) {
      const style = document.createElement('style');
      style.id = 'conflict-keyframe';
      style.textContent = '@keyframes fadeInConflict{from{opacity:0}to{opacity:1}}@keyframes shakeModal{0%,100%{transform:translateX(0)}20%{transform:translateX(-8px)}40%{transform:translateX(8px)}60%{transform:translateX(-5px)}80%{transform:translateX(5px)}}';
      document.head.appendChild(style);
    }

    modal.innerHTML = `
      <div class="conflict-modal-panel scroll-panel">
        <div class="conflict-modal-header">
          <div class="conflict-modal-icon">${icon("ban", "icon-lg")}</div>
          <div class="conflict-modal-title">¡Choque de horarios!</div>
          <div class="conflict-modal-subtitle">${conflicts.length === 1 ? 'Este horario se traslapa con una materia existente.' : `Se encontraron <strong>${conflicts.length}</strong> conflictos de horario.`}</div>
        </div>
        <div class="conflict-modal-list">${rows}</div>
        <div class="conflict-modal-actions">
          <button onclick="document.getElementById('conflict-modal').remove()" class="btn btn-primary" style="flex:1;min-width:140px;">${icon("edit")} Corregir horarios</button>
          <button onclick="document.getElementById('conflict-modal').remove(); ${onForceCancel ? onForceCancel : ''}" class="btn btn-secondary" style="flex:1;min-width:140px;">Cancelar</button>
        </div>
      </div>`;

    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
  }

  async saveCourse(e) {
    e.preventDefault();
    if (!this.validateCourseFormData()) { this.showAlert("Revisa los campos marcados en el formulario", "error"); return; }

    const isEdit = !!this.editingCode;
    const codeResult = validateCourseCode(document.getElementById("course-code").value);
    const data = {
      code: codeResult.code,
      name: document.getElementById("course-name").value.trim().toUpperCase(),
      professor: document.getElementById("course-professor").value.trim(),
      email: document.getElementById("course-email").value.trim(),
      faculty: document.getElementById("course-faculty").value.trim(),
      semester: document.getElementById("course-semester").value,
      credits: parseInt(document.getElementById("course-credits").value) || 3,
      status: document.getElementById("course-status").value,
      notes: document.getElementById("course-notes").value.trim(),
      color: document.getElementById("course-color").value || "blue",
      partials: this.getPartialsFromForm(),
      schedules: this.scheduleSlots.filter((s) => s.day && s.start_time && s.end_time),
    };

    const status = data.status;
    if (status !== 'dropped' && status !== 'completed') {
      const conflicts = this.getConflicts(data.schedules, isEdit ? this.editingCode : null);
      if (conflicts.length > 0) { this.showConflictModal(conflicts); return; }
    }

    try {
      if (isEdit) {
        await api.updateCourse(this.editingCode, data);
      } else {
        await api.createCourse(data);
      }
      document.getElementById("course-modal").classList.remove("active");
      await this.fetchCourses();
      this.renderAll();
      this.showAlert(isEdit ? "Materia actualizada" : "Materia creada", "success");
    } catch (err) {
      this.showAlert(err.message || "Error al guardar la materia", "error");
    }
  }

  async deleteCurrentCourse() {
    if (!this.editingCode) return;
    const course = this.courses.find((c) => c.code === this.editingCode);
    if (this.settings.confirmDeleteCourse !== false) {
      if (!confirm(`¿Eliminar "${course?.name || this.editingCode}"?\n\nEsta acción no se puede deshacer.`)) return;
    }
    document.getElementById("course-modal").classList.remove("active");
    await this._deleteCourse(this.editingCode);
  }

  async confirmDeleteCourse(code) {
    const course = this.courses.find((c) => c.code === code);
    if (this.settings.confirmDeleteCourse !== false) {
      if (!confirm(`¿Eliminar "${course?.name || code}"?\n\nEsta acción no se puede deshacer.`)) return;
    }
    await this._deleteCourse(code);
  }

  async _deleteCourse(code) {
    try {
      await api.deleteCourse(code);
      await this.fetchCourses();
      this.renderAll();
      this.showAlert("Materia eliminada", "success");
    } catch (e) {
      this.showAlert(e.message || "Error de conexión", "error");
    }
  }

  showClassDetails(courseCode, scheduleId) {
    const course = this.courses.find((c) => c.code === courseCode);
    if (!course) return;
    const schedule = scheduleId
      ? (course.schedules || []).find((s) => Number(s.id) === Number(scheduleId))
      : (course.schedules || [])[0];
    const statusDots = { active: statusDot("active"), paused: statusDot("paused"), completed: statusDot("completed"), dropped: statusDot("dropped") };

    document.getElementById("modal-body").innerHTML = `
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:24px;padding-bottom:20px;border-bottom:1px solid var(--border);">
        <div style="width:6px;height:64px;border-radius:4px;background:var(--accent);flex-shrink:0;"></div>
        <div>
          <div style="font-size:24px;font-weight:800;letter-spacing:-0.5px;">${course.name}</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:13px;color:var(--text-secondary);margin-top:4px;">${course.code}</div>
        </div>
      </div>
      ${schedule ? `<div style="background:var(--bg-tertiary);padding:16px;border-radius:var(--radius-sm);margin-bottom:16px;"><div style="font-size:11px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px;" class="meta-with-icon">${icon("calendar", "icon-sm")} Horario de esta clase</div><div style="display:flex;gap:20px;flex-wrap:wrap;font-size:15px;"><span class="meta-with-icon">${icon("calendar", "icon-sm")} ${schedule.day}</span><span class="meta-with-icon">${icon("clock", "icon-sm")} ${schedule.start_time} – ${schedule.end_time}</span>${schedule.room ? `<span class="meta-with-icon">${icon("building", "icon-sm")} ${schedule.room}</span>` : ""}</div></div>` : ""}
      ${(course.schedules || []).length > 1 ? `<div style="margin-bottom:16px;"><div style="font-size:11px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Todos los horarios</div>${course.schedules.map((s) => `<span class="schedule-tag meta-with-icon" style="display:inline-block;margin:2px;">${icon("calendar", "icon-sm")} ${s.day} ${s.start_time}–${s.end_time}${s.room ? " · " + s.room : ""}</span>`).join("")}</div>` : ""}
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px;">
        <div style="background:var(--bg-tertiary);padding:12px;border-radius:var(--radius-sm);text-align:center;"><div style="font-size:11px;color:var(--text-tertiary);margin-bottom:4px;">CRÉDITOS</div><div style="font-size:24px;font-weight:800;">${course.credits}</div></div>
        <div style="background:var(--bg-tertiary);padding:12px;border-radius:var(--radius-sm);text-align:center;"><div style="font-size:11px;color:var(--text-tertiary);margin-bottom:4px;">ESTADO</div><div style="font-size:18px;" class="status-with-dot">${statusDots[course.status] || statusDot("active")}</div><div style="font-size:12px;color:var(--text-secondary);">${statusLabel(course.status)}</div></div>
        <div style="background:var(--bg-tertiary);padding:12px;border-radius:var(--radius-sm);text-align:center;"><div style="font-size:11px;color:var(--text-tertiary);margin-bottom:4px;">SEMESTRE</div><div style="font-size:13px;font-weight:600;">${course.semester || "—"}</div></div>
      </div>
      ${(function () {
        var partials = course.partials || [];
        if (partials.length > 0) {
          var finalGrade = app.calculateFinalGrade(partials);
          if (finalGrade !== null) {
            var passed = finalGrade >= app.getPassingGrade();
            var bgColor = passed ? 'rgba(52,199,89,0.1)' : 'rgba(255,59,48,0.1)';
            var borderColor = passed ? 'var(--success)' : 'var(--error)';
            var textColor = passed ? 'var(--success)' : 'var(--error)';
            return '<div style="background:' + bgColor + ';padding:12px;border-radius:var(--radius-sm);text-align:center;margin-bottom:12px;border:2px solid ' + borderColor + ';"><div style="font-size:11px;color:var(--text-secondary);margin-bottom:4px;">NOTA FINAL</div><div style="font-size:28px;font-weight:800;color:' + textColor + ';">' + finalGrade.toFixed(2) + '</div><div style="font-size:12px;color:' + textColor + ';">' + (passed ? '✓ Aprobado' : '✗ Reprobado') + '</div></div>';
          }
        }
        return '';
      })()}
      ${course.professor ? `<div style="padding:12px;background:var(--bg-tertiary);border-radius:var(--radius-sm);margin-bottom:12px;"><div style="font-size:11px;color:var(--text-tertiary);margin-bottom:4px;">PROFESOR</div><div style="font-weight:600;" class="meta-with-icon">${icon("user", "icon-sm")} ${course.professor}</div>${course.email ? `<div style="margin-top:4px;" class="meta-with-icon"><a href="mailto:${course.email}" style="color:var(--accent);font-size:13px;">${icon("mail", "icon-sm")} ${course.email}</a></div>` : ""}</div>` : ""}
      ${course.faculty ? `<div class="meta-with-icon" style="font-size:14px;color:var(--text-secondary);margin-bottom:8px;">${icon("landmark", "icon-sm")} ${course.faculty}</div>` : ""}
      ${course.notes ? `<div style="background:var(--bg-tertiary);padding:12px;border-radius:var(--radius-sm);font-size:14px;color:var(--text-secondary);font-style:italic;line-height:1.6;margin-bottom:16px;" class="meta-with-icon">${icon("file-text", "icon-sm")} ${course.notes}</div>` : ""}
      <div style="display:flex;gap:8px;margin-top:20px;">
        <button class="btn btn-primary" onclick="app.openEditCourseModal('${course.code}')">${icon("edit")} Editar Materia</button>
        <button class="btn btn-secondary" onclick="document.getElementById('class-modal').classList.remove('active')">Cerrar</button>
      </div>`;
    document.getElementById("class-modal").classList.add("active");
  }

  toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme") || "light";
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("amellify-theme", next);
    this.updateThemeIcon(next);
  }

  updateThemeIcon(theme) {
    const icon = document.getElementById("theme-icon");
    if (icon) {
      icon.innerHTML = theme === "dark"
        ? '<circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>'
        : '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>';
    }
  }

  setFontSize(size) {
    this.settings.fontSize = size;
    localStorage.setItem("amellify-settings", JSON.stringify(this.settings));
    if (typeof this.saveSettingsToServer === "function") this.saveSettingsToServer();
    this.applyFontSize();
    const menu = document.getElementById("settings-modal");
    if (menu) menu.remove();
    const sizeNames = { small: 'Pequeño', normal: 'Normal', large: 'Grande' };
    this.showSilentNotification(`Tamaño: ${sizeNames[size]}`);
    if (this.currentView === 'grid') this.renderGridView();
  }

  applyFontSize() {
    const root = document.documentElement;
    const fontSizes = {
      small: { code: '13px', name: '15px', room: '11px', professor: '11px', time: '11px', padding: '9px 10px 8px', gap: '3px' },
      normal: { code: '15px', name: '17px', room: '12px', professor: '12px', time: '12px', padding: '10px 11px 9px', gap: '3px' },
      large: { code: '17px', name: '20px', room: '14px', professor: '14px', time: '14px', padding: '11px 12px 10px', gap: '4px' },
    };
    const config = fontSizes[this.settings.fontSize];
    root.style.setProperty('--grid-cell-code-size', config.code);
    root.style.setProperty('--grid-cell-name-size', config.name);
    root.style.setProperty('--grid-cell-room-size', config.room);
    root.style.setProperty('--grid-cell-professor-size', config.professor);
    root.style.setProperty('--grid-cell-time-size', config.time);
    root.style.setProperty('--grid-cell-padding', config.padding);
    root.style.setProperty('--grid-cell-gap', config.gap);
  }

  showShortcutsModal() {
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
    const modKey = isMac ? 'Cmd' : 'Ctrl';
    const shortcuts = [
      { categoryIcon: "calendar", category: "Navegación", items: [{ keys: [`${modKey}`, 'H'], desc: 'Ir a Grid y Enfocar Horario' }] },
      {
        categoryIcon: "search", category: "Zoom", items: [
          { keys: [`${modKey}`, '+'], desc: 'Acercar (Zoom In)' },
          { keys: [`${modKey}`, '-'], desc: 'Alejar (Zoom Out)' },
          { keys: [`${modKey}`, '0'], desc: 'Zoom Normal (100%)' }
        ]
      },
      { categoryIcon: "file-text", category: "Materias", items: [{ keys: [`${modKey}`, 'N'], desc: 'Nueva Materia' }] },
      {
        categoryIcon: "eye", category: "Vistas", items: [
          { keys: [`${modKey}`, '1'], desc: 'Vista Grid' },
          { keys: [`${modKey}`, '2'], desc: 'Vista Semanal' },
          { keys: [`${modKey}`, '3'], desc: 'Lista de Materias' },
          { keys: [`${modKey}`, '6'], desc: 'Calendario mensual' },
          { keys: [`${modKey}`, '7'], desc: 'Vista Hoy' },
          { keys: [`${modKey}`, '8'], desc: 'Calculadora' },
          { keys: [`${modKey}`, '9'], desc: 'Estadísticas' },
        ]
      },
      { categoryIcon: "search", category: "Búsqueda", items: [{ keys: [`${modKey}`, 'K'], desc: 'Buscar materias, horarios' }] },
      { categoryIcon: "palette", category: "Apariencia", items: [{ keys: [`${modKey}`, 'Shift', 'T'], desc: 'Ciclar tema (Claro / Oscuro / AMOLED / Contraste)' }] },
      {
        categoryIcon: "keyboard", category: "General", items: [
          { keys: ['Esc'], desc: 'Cerrar Modal o Overlay' },
          { keys: [`${modKey}`, 'R'], desc: 'Recargar Aplicación' }
        ]
      }
    ];

    let html = '<div style="display: grid; gap: 24px;">';
    for (const section of shortcuts) {
      html += `<div><div style="font-size:14px;font-weight:700;color:var(--text-primary);margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid var(--border);">${icon(section.categoryIcon, "icon-sm")} ${section.category}</div><div style="display: grid; gap: 8px;">`;
      for (const item of section.items) {
        const keysHtml = item.keys.map(key => `<kbd style="display:inline-block;padding:4px 8px;font-size:12px;font-weight:600;font-family:'IBM Plex Mono',monospace;background:var(--bg-tertiary);border:1px solid var(--border);border-radius:4px;box-shadow:0 2px 0 var(--border);margin:0 2px;">${key}</kbd>`).join(' + ');
        html += `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;background:var(--bg-tertiary);border-radius:8px;transition:var(--transition);" onmouseover="this.style.background='var(--bg-primary)'" onmouseout="this.style.background='var(--bg-tertiary)'"><span style="font-size:14px;color:var(--text-secondary);">${item.desc}</span><span>${keysHtml}</span></div>`;
      }
      html += `</div></div>`;
    }
    html += `</div><div style="margin-top:24px;padding:16px;background:var(--bg-tertiary);border-radius:12px;border-left:4px solid var(--accent);"><div style="font-size:13px;font-weight:600;color:var(--text-primary);margin-bottom:8px;" class="meta-with-icon">${icon("lightbulb", "icon-sm")} Consejo</div><div style="font-size:13px;color:var(--text-secondary);line-height:1.6;">Usa <kbd style="padding:2px 6px;background:var(--bg-primary);border-radius:4px;font-family:monospace;">${modKey}</kbd> + <kbd style="padding:2px 6px;background:var(--bg-primary);border-radius:4px;font-family:monospace;">H</kbd> para volver rápidamente a tu próxima clase o la hora actual.</div></div>`;

    document.getElementById('shortcuts-body').innerHTML = html;
    document.getElementById('shortcuts-modal').classList.add('active');
  }

  showDataMenu(tab = 'apariencia') {
    const existing = document.getElementById('settings-modal');
    if (existing) { existing.remove(); return; }

    const tabs = [
      { id: 'apariencia', label: 'Apariencia', icon: 'palette' },
      { id: 'horario', label: 'Horario', icon: 'calendar' },
      { id: 'notificaciones', label: 'Notificaciones', icon: 'bell' },
      { id: 'calculadora', label: 'Calculadora', icon: 'calculator' },
      { id: 'ia', label: 'IA', icon: 'photo' },
      { id: 'datos', label: 'Datos', icon: 'folder' },
    ];

    const modal = document.createElement('div');
    modal.id = 'settings-modal';
    modal.className = 'settings-modal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-label', 'Configuración');

    modal.innerHTML = `
      <div class="settings-modal-backdrop" data-close-settings></div>
      <div id="data-menu" class="settings-panel glass-strong">
        <header class="settings-header">
          <h2 class="settings-title meta-with-icon">${icon('settings', 'icon-sm')} Configuración</h2>
          <button type="button" class="btn btn-icon btn-secondary settings-close" data-close-settings aria-label="Cerrar">${icon('x')}</button>
        </header>
        <div class="settings-layout">
          <nav class="settings-tabs" role="tablist" aria-label="Secciones de configuración">
            ${tabs.map((t) => `<button type="button" role="tab" class="settings-tab ${t.id === tab ? 'active' : ''}" data-settings-tab="${t.id}" aria-selected="${t.id === tab}">${icon(t.icon, 'icon-sm')} ${t.label}</button>`).join('')}
          </nav>
          <div class="settings-content" id="settings-content" role="tabpanel">
            ${this._renderSettingsTab(tab)}
          </div>
        </div>
        <footer class="settings-footer">${this.courses.length} materias · ${this.courses.reduce((s, c) => s + (c.credits || 0), 0)} créditos</footer>
      </div>`;

    document.body.appendChild(modal);
    requestAnimationFrame(() => modal.classList.add('settings-modal--open'));

    const close = () => modal.remove();
    modal.querySelectorAll('[data-close-settings]').forEach((el) => { el.addEventListener('click', close); });

    modal.querySelectorAll('[data-settings-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        modal.querySelectorAll('.settings-tab').forEach((t) => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
        btn.classList.add('active'); btn.setAttribute('aria-selected', 'true');
        const panel = modal.querySelector('#settings-content');
        if (panel) {
          panel.classList.add('settings-content--exit');
          setTimeout(() => {
            panel.innerHTML = this._renderSettingsTab(btn.dataset.settingsTab);
            panel.classList.remove('settings-content--exit');
            panel.classList.add('settings-content--enter');
            this._bindSettingsTabEvents(modal, btn.dataset.settingsTab);
          }, 120);
        }
      });
    });

    this._bindSettingsTabEvents(modal, tab);
    const escHandler = (e) => { if (e.key === 'Escape') { close(); document.removeEventListener('keydown', escHandler); } };
    document.addEventListener('keydown', escHandler);
  }

  _renderSettingsTab(tab) {
    if (typeof this._buildSettingsTabContent === 'function') {
      return this._buildSettingsTabContent(tab);
    }
    return `<p class="muted">Sección en construcción.</p>`;
  }

  _bindSettingsTabEvents(modal, tab) {
    const inp = modal.querySelector('#import-file');
    if (inp) inp.onchange = function () { app.showImportPreview(this); };
  }

  exportData() {
    const blob = new Blob([JSON.stringify(this.courses, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `amellify-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.showAlert("Datos exportados", "success");
    document.getElementById("settings-modal")?.remove();
  }

  triggerImport() { document.getElementById("import-file")?.click(); }

  async importData(input) {
    if (typeof this.showImportPreview === 'function') {
      await this.showImportPreview(input);
      return;
    }
    const file = input.files[0];
    if (!file) return;
    try {
      const courses = JSON.parse(await file.text());
      if (!Array.isArray(courses)) { this.showAlert("Formato inválido", "error"); return; }
      const data = await api.importCourses(courses);
      await this.fetchCourses();
      this.renderAll();
      this.showAlert(`${data.imported} importadas${data.skipped > 0 ? ` · ${data.skipped} ya existían` : ""}`, "success");
    } catch (e) {
      this.showAlert("Error al importar", "error");
    }
    input.value = "";
    document.getElementById("settings-modal")?.remove();
  }

  async deleteAllCourses() {
    if (!confirm(`¿Estás seguro de que quieres borrar TODAS las materias?\n\nSe eliminarán ${this.courses.length} materias del horario.\n\nEsta acción NO se puede deshacer.`)) return;
    if (!confirm(`ÚLTIMA CONFIRMACIÓN\n\nEsto borrará permanentemente todas tus materias.\n\n¿Continuar?`)) return;
    document.getElementById("settings-modal")?.remove();
    try {
      let deleted = 0;
      for (const course of [...this.courses]) {
        try { await api.deleteCourse(course.code); deleted++; } catch { }
      }
      await this.fetchCourses();
      this.renderAll();
      this.showAlert(`${deleted} materias eliminadas`, "success");
    } catch (e) {
      this.showAlert("Error al borrar materias", "error");
    }
  }

  showAlert(message, type = "success") {
    const container = document.getElementById("alert-container");
    const alert = document.createElement("div");
    alert.className = `alert alert-${type}`;
    const alertIcons = { success: "check", error: "x", warning: "warning", info: "help" };
    const ic = alertIcons[type] || "check";
    alert.innerHTML = `<span class="alert-with-icon">${icon(ic)} ${escapeHtml(message)}</span>`;
    container.appendChild(alert);
    setTimeout(() => {
      alert.style.opacity = "0"; alert.style.transform = "translateX(100px)"; alert.style.transition = "all 0.3s";
      setTimeout(() => alert.remove(), 300);
    }, 2700);
  }

  setupEventListeners() {
    document.querySelectorAll(".view-tab").forEach((tab) => {
      tab.addEventListener("click", () => this.switchView(tab.dataset.view));
    });
    document.getElementById("course-form").addEventListener("submit", (e) => this.saveCourse(e));
    const courseCodeInput = document.getElementById("course-code");
    if (courseCodeInput) {
      courseCodeInput.addEventListener("blur", () => this.checkCourseCodeDuplicate());
      courseCodeInput.addEventListener("input", () => { courseCodeInput.value = courseCodeInput.value.toUpperCase(); });
    }
    document.querySelectorAll(".color-option").forEach((opt) => { opt.addEventListener("click", () => this.setColor(opt.dataset.color)); });
    document.querySelectorAll(".modal").forEach((modal) => { modal.addEventListener("click", (e) => { if (e.target === modal) modal.classList.remove("active"); }); });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        document.querySelectorAll(".modal.active").forEach((m) => m.classList.remove("active"));
        document.getElementById("settings-modal")?.remove();
        this.closeSearch?.();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'h') { e.preventDefault(); this.showSilentNotification('Ctrl+H: Ir a Horario'); this.goToSchedule(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') { e.preventDefault(); this.showSilentNotification('Ctrl+N: Nueva Materia'); this.openAddCourseModal(); }
      if ((e.ctrlKey || e.metaKey) && ['1', '2', '3'].includes(e.key)) {
        e.preventDefault();
        const views = { '1': 'grid', '2': 'week', '3': 'list' };
        const viewNames = { '1': 'Vista Grid', '2': 'Vista Semanal', '3': 'Lista' };
        this.showSilentNotification(`Ctrl+${e.key}: ${viewNames[e.key]}`);
        this.switchView(views[e.key]);
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'T') { e.preventDefault(); this.showSilentNotification('Ctrl+Shift+T: Cambiar Tema'); this.toggleTheme(); }
      if ((e.ctrlKey || e.metaKey) && e.key === 'r') { this.showSilentNotification('Ctrl+R: Recargando...'); }
    });
  }

  showSilentNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = 'position:fixed;bottom:24px;right:24px;background:var(--bg-secondary);color:var(--text-primary);padding:12px 20px;border-radius:8px;font-size:13px;font-weight:500;box-shadow:0 4px 12px rgba(0,0,0,0.15);border:1px solid var(--border);z-index:1000;opacity:0;transform:translateY(10px);transition:all 0.3s ease;pointer-events:none;font-family:\'IBM Plex Mono\',monospace;';
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => { notification.style.opacity = '0.9'; notification.style.transform = 'translateY(0)'; }, 10);
    setTimeout(() => { notification.style.opacity = '0'; notification.style.transform = 'translateY(10px)'; setTimeout(() => notification.remove(), 300); }, 1500);
  }

  goToSchedule() {
    if (this.currentView !== 'grid') { this.switchView('grid'); setTimeout(() => { this.focusOnSchedule(); }, 150); }
    else { this.focusOnSchedule(); }
  }

  focusOnSchedule() {
    const scheduleContainer = document.getElementById('grid-schedule-container');
    if (!scheduleContainer) return;
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const todayMap = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const todayName = todayMap[now.getDay()];
    const SLOT_MIN = 10;
    const SLOT_H = this.settings.gridCompact ? 10 : 16;
    const originMin = 0;
    const headerHeight = 40;
    const timeToMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
    const allSchedules = [];
    for (const course of this.courses) { for (const s of course.schedules || []) { allSchedules.push({ ...s, course }); } }
    let targetScrollPosition = 0;
    let targetMessage = '';
    if (allSchedules.length > 0) {
      const todaySchedules = allSchedules.filter(s => s.day === todayName);
      if (todaySchedules.length > 0) {
        let targetSchedule = null;
        for (const s of todaySchedules) {
          const startMin = timeToMin(s.start_time), endMin = timeToMin(s.end_time);
          if (nowMin >= startMin && nowMin <= endMin) { targetSchedule = s; break; }
        }
        if (!targetSchedule) {
          const futureClasses = todaySchedules.filter(s => timeToMin(s.start_time) > nowMin).sort((a, b) => timeToMin(a.start_time) - timeToMin(b.start_time));
          if (futureClasses.length > 0) targetSchedule = futureClasses[0];
        }
        if (!targetSchedule) { targetSchedule = todaySchedules.sort((a, b) => timeToMin(a.start_time) - timeToMin(b.start_time))[0]; }
        if (targetSchedule) {
          const classMidMin = (timeToMin(targetSchedule.start_time) + timeToMin(targetSchedule.end_time)) / 2;
          targetScrollPosition = (classMidMin - originMin) * (SLOT_H / SLOT_MIN) - (scheduleContainer.clientHeight / 2) + headerHeight;
          targetMessage = targetSchedule.course.name;
        }
      }
      if (!targetMessage) {
        const earliestClass = allSchedules.sort((a, b) => timeToMin(a.start_time) - timeToMin(b.start_time))[0];
        if (earliestClass) {
          targetScrollPosition = (timeToMin(earliestClass.start_time) - originMin) * (SLOT_H / SLOT_MIN) - (scheduleContainer.clientHeight / 2) + headerHeight;
          targetMessage = earliestClass.course.name + ' (' + earliestClass.day + ')';
        }
      }
    }
    if (!targetMessage && nowMin >= 0 && nowMin < 1440) {
      targetScrollPosition = (nowMin - originMin) * (SLOT_H / SLOT_MIN) - (scheduleContainer.clientHeight / 2) + headerHeight;
      targetMessage = 'Hora actual';
    }
    if (targetMessage) {
      const viewContent = document.getElementById('view-content');
      if (viewContent) { window.scrollTo({ top: viewContent.offsetTop - 80, behavior: 'smooth' }); }
      setTimeout(() => { scheduleContainer.scrollTo({ top: Math.max(0, targetScrollPosition), behavior: 'smooth' }); }, 100);
      setTimeout(() => { this.showSilentNotification(targetMessage); }, 300);
    }
  }
}

installFeatures(AmellifyApp);
installAdvancedFeatures(AmellifyApp);

window.app = new AmellifyApp();
