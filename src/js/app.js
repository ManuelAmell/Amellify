// ─── Amellify App ─────────────────────────────────────────────────────────────
const API = "/api";

class AmellifyApp {
  constructor() {
    this.courses = [];
    this.currentView = "grid";
    this.scheduleSlots = [];
    this.editingCode = null;
    this.countdownInterval = null;
    this._menuClickHandler = null;

    this.init();
  }

  // ─── Initialization ──────────────────────────────────────────────────────────
  async init() {
    // Restore theme
    const savedTheme = localStorage.getItem("amellify-theme") || "light";
    document.documentElement.setAttribute("data-theme", savedTheme);
    document.getElementById("theme-icon").textContent =
      savedTheme === "dark" ? "☀️" : "🌙";

    // Load data
    await this.fetchCourses();

    // Setup UI
    this.setupEventListeners();
    this.renderAll();
    this.startCountdown();
  }

  // ─── Data Fetching ───────────────────────────────────────────────────────────
  async fetchCourses() {
    try {
      const res = await fetch(`${API}/courses`);
      if (!res.ok) throw new Error("Server error");
      this.courses = await res.json();
    } catch (e) {
      this.courses = [];
      this.showAlert(
        "⚠️ No se pudo conectar con el servidor. ¿Está corriendo server.js?",
        "error",
      );
    }
  }

  // ─── Render All ──────────────────────────────────────────────────────────────
  renderAll() {
    this.updateStats();
    this.renderNextClassHero();
    this.renderView();
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

  // ─── Next Class Hero ─────────────────────────────────────────────────────────
  renderNextClassHero() {
    const hero = document.getElementById("next-class-hero");
    const next = this.getNextClass();

    if (!next) {
      hero.innerHTML = "";
      return;
    }

    hero.innerHTML = `
      <div class="next-class-hero">
        <div class="next-class-content">
          <div class="next-class-label">⚡ Próxima Clase</div>
          <div class="next-class-name">${next.course.name}</div>
          <div class="next-class-details">
            <span>🕐 ${next.schedule.start_time} – ${next.schedule.end_time}</span>
            <span>📅 ${next.schedule.day}</span>
            ${next.schedule.room ? `<span>🏫 ${next.schedule.room}</span>` : ""}
            ${next.course.professor ? `<span>👨‍🏫 ${next.course.professor}</span>` : ""}
            <span style="font-family:'IBM Plex Mono',monospace; opacity:0.8;">${next.course.code}</span>
          </div>
          <div class="countdown" id="countdown-display">--:--:--</div>
        </div>
      </div>`;
  }

  getNextClass() {
    const dayMap = {
      Lunes: 1,
      Martes: 2,
      Miércoles: 3,
      Jueves: 4,
      Viernes: 5,
      Sábado: 6,
      Domingo: 0,
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

        for (let ahead = 0; ahead <= 7; ahead++) {
          const candidate = new Date(now);
          candidate.setDate(candidate.getDate() + ahead);
          candidate.setHours(sh, sm, 0, 0);

          if (candidate.getDay() === targetDay && candidate > now) {
            const diff = candidate - now;
            if (diff < nearestMs) {
              nearestMs = diff;
              nearest = { course, schedule: s, msUntil: diff };
            }
            break;
          }
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
      if (!next) {
        el.textContent = "--:--:--";
        return;
      }

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

  // ─── View Management ─────────────────────────────────────────────────────────
  switchView(view) {
    this.currentView = view;
    document.querySelectorAll(".view-tab").forEach((t) => {
      t.classList.toggle("active", t.dataset.view === view);
    });
    this.renderView();
  }

  renderView() {
    const views = {
      grid: () => this.renderGridView(),
      week: () => this.renderWeekView(),
      list: () => this.renderListView(),
    };
    (views[this.currentView] || views.grid)();
  }

  // ─── Grid View ───────────────────────────────────────────────────────────────
  renderGridView() {
    const container = document.getElementById("view-content");
    const days = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

    // Collect all schedules
    const allSchedules = [];
    for (const course of this.courses) {
      for (const s of course.schedules || []) {
        allSchedules.push({ ...s, course });
      }
    }

    if (allSchedules.length === 0) {
      container.innerHTML = `
        <div class="grid-schedule">
          <div class="empty-state">
            <div class="empty-state-icon">📅</div>
            <div class="empty-state-text">No hay materias con horarios asignados</div>
            <button class="btn btn-primary" style="margin-top: 16px" onclick="app.openAddCourseModal()">➕ Agregar Materia</button>
          </div>
        </div>`;
      return;
    }

    // ── CSS Grid approach: each row = 10 minutes ──
    const SLOT_MIN = 10;   // minutes per grid row
    const SLOT_H   = 14;   // pixels per grid row

    // Helper: "HH:MM" → total minutes from midnight
    const timeToMin = (t) => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    };

    // Find range
    let minMin = 1440, maxMin = 0;
    for (const s of allSchedules) {
      minMin = Math.min(minMin, timeToMin(s.start_time));
      maxMin = Math.max(maxMin, timeToMin(s.end_time));
    }
    const startHour = Math.floor(minMin / 60);
    const endHour   = Math.ceil(maxMin / 60);
    const originMin = startHour * 60;
    const totalSlots = (endHour * 60 - originMin) / SLOT_MIN;

    // Convert time string to grid row number (1-indexed, row 1 = header)
    const timeToRow = (t) => {
      const min = timeToMin(t);
      return Math.round((min - originMin) / SLOT_MIN) + 2; // +2: 1 for CSS grid 1-index, 1 for header
    };

    // Build hour labels (placed in column 1)
    let hourLabels = '';
    const slotsPerHour = 60 / SLOT_MIN; // 6 slots per hour
    for (let h = startHour; h < endHour; h++) {
      const rowStart = Math.round((h * 60 - originMin) / SLOT_MIN) + 2;
      const rowEnd = rowStart + slotsPerHour;
      const label = `${String(h).padStart(2, '0')}:00`;
      hourLabels += `<div class="grid-hour-label" style="grid-column:1; grid-row:${rowStart} / ${rowEnd};">${label}</div>`;
    }
    // Add last hour label
    const lastRowStart = Math.round((endHour * 60 - originMin) / SLOT_MIN) + 2;
    const lastLabel = `${String(endHour).padStart(2, '0')}:00`;
    hourLabels += `<div class="grid-hour-label" style="grid-column:1; grid-row:${lastRowStart};">${lastLabel}</div>`;

    // Build hour gridlines (span all columns)
    let hourLines = '';
    for (let h = startHour; h <= endHour; h++) {
      const row = Math.round((h * 60 - originMin) / SLOT_MIN) + 2;
      hourLines += `<div class="grid-hour-line" style="grid-column:1 / -1; grid-row:${row};"></div>`;
    }

    // Today info — must be declared before daySeparators loop
    const now = new Date();
    const todayMap = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
    const todayName = todayMap[now.getDay()];
    const nowMin = now.getHours() * 60 + now.getMinutes();

    // Build vertical day separators + today column background
    let daySeparators = '';
    for (let di = 0; di < days.length; di++) {
      const isToday = days[di] === todayName;
      if (isToday) {
        daySeparators += `<div class="grid-today-bg" style="grid-column:${di + 2}; grid-row:1 / ${totalSlots + 2};"></div>`;
      }
      daySeparators += `<div class="grid-day-separator" style="grid-column:${di + 2}; grid-row:2 / ${totalSlots + 2};"></div>`;
    }

    // Build class blocks
    let classBlocks = '';
    for (const s of allSchedules) {
      const dayIdx = days.indexOf(s.day);
      if (dayIdx === -1) continue;

      const rowStart = timeToRow(s.start_time);
      const rowEnd   = timeToRow(s.end_time);
      const col = dayIdx + 2;
      const isToday = s.day === todayName;

      classBlocks += `
        <div class="class-cell color-${s.course.color}"
             onclick="app.showClassDetails('${s.course.code}', ${s.id})"
             title="${s.course.name}"
             style="grid-column:${col}; grid-row:${rowStart} / ${rowEnd}; margin:1px 4px;${isToday ? ' box-shadow: var(--shadow-sm);' : ''}">
          <div class="class-cell-code">${s.course.code}</div>
          <div class="class-cell-name">${s.course.name}</div>
          ${s.room ? `<div class="class-cell-room">🏫 ${s.room}</div>` : ''}
          <div style="font-size:9px;margin-top:auto;opacity:0.55;font-family:'IBM Plex Mono',monospace;">${s.start_time}–${s.end_time}</div>
        </div>`;
    }

    // Build day headers — highlight today
    const dayHeaders = days.map((d, i) => {
      const isToday = d === todayName;
      const style = isToday
        ? `grid-column:${i + 2}; grid-row:1; color:var(--accent); font-weight:700;`
        : `grid-column:${i + 2}; grid-row:1;`;
      return `<div class="grid-header-cell" style="${style}">${d}</div>`;
    }).join('');

    container.innerHTML = `
      <div class="grid-schedule">
        <div class="grid-timeline" style="
          display: grid;
          grid-template-columns: 60px repeat(${days.length}, 1fr);
          grid-template-rows: auto repeat(${totalSlots}, ${SLOT_H}px);
          min-width: 800px;
          position: relative;
        ">
          <div class="grid-header-cell" style="grid-column:1; grid-row:1;">Hora</div>
          ${dayHeaders}
          ${daySeparators}
          ${hourLines}
          ${hourLabels}
          ${classBlocks}
        </div>
      </div>`;
  }

  // ─── Week View ───────────────────────────────────────────────────────────────
  renderWeekView() {
    const container = document.getElementById("view-content");
    const days = [
      "Lunes",
      "Martes",
      "Miércoles",
      "Jueves",
      "Viernes",
      "Sábado",
    ];

    const byDay = {};
    for (const d of days) byDay[d] = [];
    for (const course of this.courses) {
      for (const s of course.schedules || []) {
        if (byDay[s.day]) byDay[s.day].push({ ...s, course });
      }
    }
    for (const d of days)
      byDay[d].sort((a, b) => a.start_time.localeCompare(b.start_time));

    // Highlight today
    const todayMap = [
      "Domingo",
      "Lunes",
      "Martes",
      "Miércoles",
      "Jueves",
      "Viernes",
      "Sábado",
    ];
    const today = todayMap[new Date().getDay()];

    let html = `<div class="week-grid">`;
    for (const day of days) {
      const classes = byDay[day];
      const isToday = day === today;
      html += `
        <div class="day-card" style="${isToday ? "box-shadow: 0 0 0 2px var(--accent);" : ""}">
          <div class="day-header" style="${isToday ? "background: var(--accent); color: white;" : ""}">
            <div class="day-name">${isToday ? "📍 " : ""}${day}</div>
            <div class="day-count" style="${isToday ? "color:rgba(255,255,255,0.8)" : ""}">${classes.length} clase${classes.length !== 1 ? "s" : ""}</div>
          </div>
          <div class="day-classes">`;

      if (classes.length === 0) {
        html += `<div style="text-align:center;padding:24px 12px;color:var(--text-tertiary);font-size:13px;">Sin clases</div>`;
      } else {
        for (const c of classes) {
          html += `
            <div class="class-item color-${c.course.color}" onclick="app.showClassDetails('${c.course.code}', ${c.id})">
              <div class="class-time">${c.start_time} – ${c.end_time}</div>
              <div class="class-title">${c.course.name}</div>
              <div class="class-details">
                ${c.course.code}${c.room ? " · 🏫 " + c.room : ""}${c.course.professor ? " · " + c.course.professor : ""}
              </div>
            </div>`;
        }
      }

      html += `</div></div>`;
    }
    html += `</div>`;
    container.innerHTML = html;
  }

  // ─── List View ───────────────────────────────────────────────────────────────
  renderListView() {
    const container = document.getElementById("view-content");

    if (this.courses.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">📚</div>
          <div class="empty-state-text">No tienes materias registradas aún</div>
          <button class="btn btn-primary" style="margin-top:16px" onclick="app.openAddCourseModal()">➕ Agregar Primera Materia</button>
        </div>`;
      return;
    }

    const statusEmoji = {
      active: "🟢",
      paused: "🟡",
      completed: "🔵",
      dropped: "🔴",
    };
    const statusLabel = {
      active: "Activa",
      paused: "En pausa",
      completed: "Completada",
      dropped: "Retirada",
    };

    // Group by status
    const groups = [
      {
        key: "active",
        label: "🟢 Activas",
        courses: this.courses.filter((c) => c.status === "active"),
      },
      {
        key: "paused",
        label: "🟡 En Pausa",
        courses: this.courses.filter((c) => c.status === "paused"),
      },
      {
        key: "completed",
        label: "🔵 Completadas",
        courses: this.courses.filter((c) => c.status === "completed"),
      },
      {
        key: "dropped",
        label: "🔴 Retiradas",
        courses: this.courses.filter((c) => c.status === "dropped"),
      },
    ].filter((g) => g.courses.length > 0);

    let html = "";
    for (const group of groups) {
      html += `<div style="margin-bottom:8px;font-size:13px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;">${group.label}</div>`;
      html += `<div class="course-list" style="margin-bottom:24px;">`;

      for (const course of group.courses) {
        html += `
          <div class="course-card color-${course.color}">
            <div class="course-header">
              <div style="flex:1;">
                <div class="course-name">${course.name}</div>
                <div class="course-code">${course.code}${course.semester ? " · " + course.semester : ""}</div>
              </div>
              <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;">
                <div class="course-credits">${course.credits} cr.</div>
              </div>
            </div>

            ${
              (course.schedules || []).length > 0
                ? `
              <div class="course-schedule">
                ${course.schedules
                  .map(
                    (s) => `
                  <span class="schedule-tag">📅 ${s.day} ${s.start_time}–${s.end_time}${s.room ? " · " + s.room : ""}</span>
                `,
                  )
                  .join("")}
              </div>`
                : ""
            }

            ${course.professor ? `<div class="course-professor">👨‍🏫 ${course.professor}${course.email ? ` · <a href="mailto:${course.email}" style="color:inherit;text-decoration:underline;">${course.email}</a>` : ""}</div>` : ""}
            ${course.faculty ? `<div style="font-size:13px;color:var(--text-secondary);margin-top:4px;">🏛️ ${course.faculty}</div>` : ""}
            ${course.notes ? `<div style="font-size:13px;color:var(--text-secondary);margin-top:8px;font-style:italic;padding:8px;background:var(--bg-primary);border-radius:6px;">${course.notes}</div>` : ""}

            <div class="course-actions">
              <button class="btn btn-secondary btn-small" onclick="app.openEditCourseModal('${course.code}')">✏️ Editar</button>
              <button class="btn btn-danger btn-small" onclick="app.confirmDeleteCourse('${course.code}')">🗑️ Eliminar</button>
            </div>
          </div>`;
      }

      html += `</div>`;
    }

    container.innerHTML = html;
  }

  // ─── Modals ──────────────────────────────────────────────────────────────────
  openAddCourseModal() {
    this.editingCode = null;
    this.scheduleSlots = [];

    document.getElementById("course-modal-title").textContent =
      "➕ Nueva Materia";
    document.getElementById("course-form").reset();
    document.getElementById("edit-course-code").value = "";
    document.getElementById("btn-delete-course").style.display = "none";
    this.renderScheduleSlots();
    this.setColor("blue");
    document.getElementById("course-modal").classList.add("active");
  }

  openEditCourseModal(code) {
    const course = this.courses.find((c) => c.code === code);
    if (!course) return;

    this.editingCode = code;
    this.scheduleSlots = (course.schedules || []).map((s) => ({ ...s }));

    document.getElementById("course-modal-title").textContent =
      "✏️ Editar Materia";
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

    this.setColor(course.color || "blue");
    this.renderScheduleSlots();

    // Close class modal if open
    document.getElementById("class-modal").classList.remove("active");
    document.getElementById("course-modal").classList.add("active");
  }

  // ─── Schedule Slots ──────────────────────────────────────────────────────────
  addScheduleSlot() {
    this.scheduleSlots.push({
      day: "Lunes",
      start_time: "08:00",
      end_time: "10:00",
      room: "",
    });
    this.renderScheduleSlots();
  }

  removeScheduleSlot(index) {
    this.scheduleSlots.splice(index, 1);
    this.renderScheduleSlots();
  }

  updateSlot(index, field, value) {
    if (this.scheduleSlots[index]) {
      this.scheduleSlots[index][field] = value;
      this.renderScheduleSlots();
    }
  }

  renderScheduleSlots() {
    const container = document.getElementById("schedule-list");
    const days = ["Lunes","Martes","Miércoles","Jueves","Viernes","Sábado","Domingo"];

    if (this.scheduleSlots.length === 0) {
      container.innerHTML = `<div style="text-align:center;padding:16px;color:var(--text-tertiary);font-size:13px;border:2px dashed var(--border);border-radius:var(--radius-sm);">Sin horarios asignados</div>`;
      return;
    }

    // Pre-compute conflicts for all slots
    const slotConflicts = this.scheduleSlots.map((slot) => {
      if (!slot.day || !slot.start_time || !slot.end_time) return [];
      return this.getConflicts([slot], this.editingCode);
    });

    container.innerHTML = this.scheduleSlots.map((slot, i) => {
      const conflicts = slotConflicts[i];
      const hasConflict = conflicts.length > 0;
      const borderColor = hasConflict ? 'var(--danger)' : 'var(--border)';
      const bgColor = hasConflict ? 'rgba(255,59,48,0.04)' : 'var(--bg-secondary)';

      const conflictWarning = hasConflict ? `
        <div style="
          grid-column: 1 / -1;
          background: rgba(255,59,48,0.08);
          border: 1px solid rgba(255,59,48,0.3);
          border-radius: 8px;
          padding: 10px 12px;
          font-size: 12px;
          color: var(--danger);
          display: flex;
          align-items: flex-start;
          gap: 8px;
          line-height: 1.5;
        ">
          <span style="font-size:15px; flex-shrink:0;">⚠️</span>
          <div>
            <strong>Conflicto:</strong>
            ${conflicts.map(c => `<strong>${c.course.name}</strong> (${c.existing.start_time}–${c.existing.end_time})`).join(', ')}
            ya ocupa este horario.
          </div>
        </div>` : '';

      return `
        <div style="
          display:grid;
          grid-template-columns:1.5fr 1fr 1fr 1fr auto;
          gap:8px;
          margin-bottom:12px;
          align-items:end;
          padding:12px;
          background:${bgColor};
          border-radius:var(--radius-sm);
          border:1px solid ${borderColor};
          transition: border-color 0.2s, background 0.2s;
        ">
          <div>
            <div class="form-label" style="margin-bottom:4px;">Día</div>
            <select class="form-select" onchange="app.updateSlot(${i},'day',this.value)">
              ${days.map(d => `<option value="${d}" ${slot.day===d?'selected':''}>${d}</option>`).join('')}
            </select>
          </div>
          <div>
            <div class="form-label" style="margin-bottom:4px;">Inicio</div>
            <input type="time" class="form-input" value="${slot.start_time}" onchange="app.updateSlot(${i},'start_time',this.value)">
          </div>
          <div>
            <div class="form-label" style="margin-bottom:4px;">Fin</div>
            <input type="time" class="form-input" value="${slot.end_time}" onchange="app.updateSlot(${i},'end_time',this.value)">
          </div>
          <div>
            <div class="form-label" style="margin-bottom:4px;">Aula</div>
            <input type="text" class="form-input" value="${slot.room||''}" placeholder="A-201" oninput="app.updateSlot(${i},'room',this.value)">
          </div>
          <div style="padding-bottom:1px;">
            <button type="button" class="btn btn-danger btn-small" onclick="app.removeScheduleSlot(${i})">✕</button>
          </div>
          ${conflictWarning}
        </div>`;
    }).join('');
  }

  // ─── Color Picker ─────────────────────────────────────────────────────────────
  setColor(color) {
    document.querySelectorAll(".color-option").forEach((el) => {
      el.classList.toggle("selected", el.dataset.color === color);
    });
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
    if (preview) {
      preview.style.background = c.bg;
      preview.style.borderColor = c.border;
      preview.style.color = c.text;
      preview.style.borderWidth = "1px";
      preview.style.borderStyle = "solid";
    }
  }

  // ─── Conflict Detection ──────────────────────────────────────────────────────
  timeToMin(t) {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
  }

  slotsOverlap(a, b) {
    if (a.day !== b.day) return false;
    const aStart = this.timeToMin(a.start_time);
    const aEnd   = this.timeToMin(a.end_time);
    const bStart = this.timeToMin(b.start_time);
    const bEnd   = this.timeToMin(b.end_time);
    return aStart < bEnd && bStart < aEnd;
  }

  getConflicts(newSlots, excludeCode = null) {
    const conflicts = [];
    for (const newSlot of newSlots) {
      for (const course of this.courses) {
        if (excludeCode && course.code === excludeCode) continue;
        if (course.status === 'dropped') continue;
        for (const existing of (course.schedules || [])) {
          if (this.slotsOverlap(newSlot, existing)) {
            conflicts.push({ newSlot, existing, course });
          }
        }
      }
    }
    return conflicts;
  }

  showConflictModal(conflicts, onForceCancel) {
    // Remove any existing conflict modal
    document.getElementById('conflict-modal')?.remove();

    const dayEmoji = { Lunes:'📅', Martes:'📅', Miércoles:'📅', Jueves:'📅', Viernes:'📅', Sábado:'🗓️', Domingo:'🗓️' };

    const rows = conflicts.map(({ newSlot, existing, course }) => `
      <div style="
        background: var(--bg-tertiary);
        border-radius: 12px;
        padding: 16px;
        border-left: 4px solid var(--danger);
        display: flex;
        flex-direction: column;
        gap: 10px;
      ">
        <div style="display:flex; align-items:center; gap:8px; font-size:13px; font-weight:700; color:var(--danger);">
          ⚡ Conflicto detectado — ${dayEmoji[newSlot.day] || '📅'} ${newSlot.day}
        </div>
        <div style="display:grid; grid-template-columns:1fr auto 1fr; gap:8px; align-items:center;">
          <!-- Bloque nuevo -->
          <div style="background:var(--bg-secondary); border-radius:10px; padding:12px; border:1px dashed var(--danger);">
            <div style="font-size:10px; font-weight:700; color:var(--danger); letter-spacing:0.06em; text-transform:uppercase; margin-bottom:6px;">⏳ Quieres agregar</div>
            <div style="font-size:13px; font-weight:600;">${newSlot.start_time} – ${newSlot.end_time}</div>
            ${newSlot.room ? `<div style="font-size:11px; color:var(--text-tertiary); margin-top:4px;">🏫 ${newSlot.room}</div>` : ''}
          </div>
          <!-- Vs -->
          <div style="font-size:20px; text-align:center;">💥</div>
          <!-- Bloque existente -->
          <div style="background:var(--bg-secondary); border-radius:10px; padding:12px; border:1px solid var(--border);">
            <div style="font-size:10px; font-weight:700; color:var(--text-tertiary); letter-spacing:0.06em; text-transform:uppercase; margin-bottom:6px;">📚 Ya existe</div>
            <div style="font-size:13px; font-weight:600;">${existing.start_time} – ${existing.end_time}</div>
            <div style="font-size:12px; color:var(--text-secondary); margin-top:4px;">${course.name}</div>
            <div style="font-size:11px; font-family:'IBM Plex Mono',monospace; color:var(--text-tertiary); margin-top:2px;">${course.code}${existing.room ? ' · 🏫 ' + existing.room : ''}</div>
          </div>
        </div>
      </div>
    `).join('');

    const modal = document.createElement('div');
    modal.id = 'conflict-modal';
    modal.style.cssText = `
      position:fixed; inset:0;
      background:rgba(0,0,0,0.65);
      backdrop-filter:blur(12px);
      z-index:2000;
      display:flex; align-items:center; justify-content:center;
      padding:24px;
      animation: fadeInConflict 0.2s ease-out;
    `;

    // Inject keyframe once
    if (!document.getElementById('conflict-keyframe')) {
      const style = document.createElement('style');
      style.id = 'conflict-keyframe';
      style.textContent = `
        @keyframes fadeInConflict {
          from { opacity:0; } to { opacity:1; }
        }
        @keyframes shakeModal {
          0%,100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-5px); }
          80% { transform: translateX(5px); }
        }
      `;
      document.head.appendChild(style);
    }

    modal.innerHTML = `
      <div style="
        background: var(--bg-secondary);
        border-radius: 20px;
        max-width: 560px;
        width: 100%;
        max-height: 85vh;
        overflow-y: auto;
        box-shadow: 0 24px 80px rgba(0,0,0,0.35);
        animation: shakeModal 0.4s ease-out;
      ">
        <!-- Header -->
        <div style="
          padding: 24px 24px 20px;
          border-bottom: 1px solid var(--border);
          background: linear-gradient(135deg, #ff3b3015 0%, #ff9f0a10 100%);
          border-radius: 20px 20px 0 0;
          text-align: center;
        ">
          <div style="font-size: 48px; margin-bottom: 8px;">🚫</div>
          <div style="font-size: 20px; font-weight: 800; color: var(--text-primary);">¡Choque de horarios!</div>
          <div style="font-size: 14px; color: var(--text-secondary); margin-top: 6px; line-height:1.5;">
            ${conflicts.length === 1
              ? 'Este horario se traslapa con una materia existente.'
              : `Se encontraron <strong>${conflicts.length}</strong> conflictos de horario.`}
          </div>
        </div>
        <!-- Conflicts list -->
        <div style="padding: 20px; display:flex; flex-direction:column; gap:12px;">
          ${rows}
        </div>
        <!-- Actions -->
        <div style="
          padding: 16px 20px 20px;
          display: flex;
          gap: 10px;
          border-top: 1px solid var(--border);
          flex-wrap: wrap;
        ">
          <button onclick="document.getElementById('conflict-modal').remove()"
            class="btn btn-primary" style="flex:1; min-width:140px;">
            ✏️ Corregir horarios
          </button>
          <button onclick="document.getElementById('conflict-modal').remove(); ${onForceCancel ? onForceCancel : ''}"
            class="btn btn-secondary" style="flex:1; min-width:140px;">
            Cancelar
          </button>
        </div>
      </div>
    `;

    // Close on backdrop click
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });

    document.body.appendChild(modal);
  }

  // ─── Save Course ─────────────────────────────────────────────────────────────
  async saveCourse(e) {
    e.preventDefault();
    const isEdit = !!this.editingCode;
    const data = {
      code: document.getElementById("course-code").value.trim().toUpperCase(),
      name: document.getElementById("course-name").value.trim().toUpperCase(),
      professor: document.getElementById("course-professor").value.trim(),
      email: document.getElementById("course-email").value.trim(),
      faculty: document.getElementById("course-faculty").value.trim(),
      semester: document.getElementById("course-semester").value,
      credits: parseInt(document.getElementById("course-credits").value) || 3,
      status: document.getElementById("course-status").value,
      notes: document.getElementById("course-notes").value.trim(),
      color: document.getElementById("course-color").value || "blue",
      schedules: this.scheduleSlots.filter(
        (s) => s.day && s.start_time && s.end_time,
      ),
    };

    // ── Conflict check ────────────────────────────────────────────────────────
    const status = data.status;
    if (status !== 'dropped' && status !== 'completed') {
      const conflicts = this.getConflicts(data.schedules, isEdit ? this.editingCode : null);
      if (conflicts.length > 0) {
        this.showConflictModal(conflicts);
        return;
      }
    }

    const url = isEdit
      ? `${API}/courses/${this.editingCode}`
      : `${API}/courses`;
    const method = isEdit ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        this.showAlert(err.error || "Error al guardar", "error");
        return;
      }

      document.getElementById("course-modal").classList.remove("active");
      await this.fetchCourses();
      this.renderAll();
      this.showAlert(
        isEdit ? "✅ Materia actualizada" : "✅ Materia creada",
        "success",
      );
    } catch (err) {
      this.showAlert("❌ Error de conexión con el servidor", "error");
    }
  }

  // ─── Delete ──────────────────────────────────────────────────────────────────
  async deleteCurrentCourse() {
    if (!this.editingCode) return;
    const course = this.courses.find((c) => c.code === this.editingCode);
    if (
      !confirm(
        `¿Eliminar "${course?.name || this.editingCode}"?\n\nEsta acción no se puede deshacer.`,
      )
    )
      return;
    document.getElementById("course-modal").classList.remove("active");
    await this._deleteCourse(this.editingCode);
  }

  async confirmDeleteCourse(code) {
    const course = this.courses.find((c) => c.code === code);
    if (
      !confirm(
        `¿Eliminar "${course?.name || code}"?\n\nEsta acción no se puede deshacer.`,
      )
    )
      return;
    await this._deleteCourse(code);
  }

  async _deleteCourse(code) {
    try {
      const res = await fetch(`${API}/courses/${code}`, { method: "DELETE" });
      if (!res.ok) {
        this.showAlert("Error al eliminar", "error");
        return;
      }
      await this.fetchCourses();
      this.renderAll();
      this.showAlert("🗑️ Materia eliminada", "success");
    } catch (e) {
      this.showAlert("Error de conexión", "error");
    }
  }

  // ─── Class Detail Modal ──────────────────────────────────────────────────────
  showClassDetails(courseCode, scheduleId) {
    const course = this.courses.find((c) => c.code === courseCode);
    if (!course) return;

    const schedule = (course.schedules || []).find((s) => s.id === scheduleId);
    const statusEmoji = {
      active: "🟢",
      paused: "🟡",
      completed: "🔵",
      dropped: "🔴",
    };
    const statusLabel = {
      active: "Activa",
      paused: "En pausa",
      completed: "Completada",
      dropped: "Retirada",
    };

    document.getElementById("modal-body").innerHTML = `
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:24px;padding-bottom:20px;border-bottom:1px solid var(--border);">
        <div style="width:6px;height:64px;border-radius:4px;background:var(--accent);flex-shrink:0;"></div>
        <div>
          <div style="font-size:24px;font-weight:800;letter-spacing:-0.5px;">${course.name}</div>
          <div style="font-family:'IBM Plex Mono',monospace;font-size:13px;color:var(--text-secondary);margin-top:4px;">${course.code}</div>
        </div>
      </div>

      ${
        schedule
          ? `
        <div style="background:var(--bg-tertiary);padding:16px;border-radius:var(--radius-sm);margin-bottom:16px;">
          <div style="font-size:11px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:12px;">📅 Horario de esta clase</div>
          <div style="display:flex;gap:20px;flex-wrap:wrap;font-size:15px;">
            <span>📅 ${schedule.day}</span>
            <span>🕐 ${schedule.start_time} – ${schedule.end_time}</span>
            ${schedule.room ? `<span>🏫 ${schedule.room}</span>` : ""}
          </div>
        </div>`
          : ""
      }

      ${
        (course.schedules || []).length > 1
          ? `
        <div style="margin-bottom:16px;">
          <div style="font-size:11px;font-weight:600;color:var(--text-secondary);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">Todos los horarios</div>
          ${course.schedules.map((s) => `<span class="schedule-tag" style="display:inline-block;margin:2px;">📅 ${s.day} ${s.start_time}–${s.end_time}${s.room ? " · " + s.room : ""}</span>`).join("")}
        </div>`
          : ""
      }

      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:16px;">
        <div style="background:var(--bg-tertiary);padding:12px;border-radius:var(--radius-sm);text-align:center;">
          <div style="font-size:11px;color:var(--text-tertiary);margin-bottom:4px;">CRÉDITOS</div>
          <div style="font-size:24px;font-weight:800;">${course.credits}</div>
        </div>
        <div style="background:var(--bg-tertiary);padding:12px;border-radius:var(--radius-sm);text-align:center;">
          <div style="font-size:11px;color:var(--text-tertiary);margin-bottom:4px;">ESTADO</div>
          <div style="font-size:18px;">${statusEmoji[course.status] || "🟢"}</div>
          <div style="font-size:12px;color:var(--text-secondary);">${statusLabel[course.status]}</div>
        </div>
        <div style="background:var(--bg-tertiary);padding:12px;border-radius:var(--radius-sm);text-align:center;">
          <div style="font-size:11px;color:var(--text-tertiary);margin-bottom:4px;">SEMESTRE</div>
          <div style="font-size:13px;font-weight:600;">${course.semester || "—"}</div>
        </div>
      </div>

      ${
        course.professor
          ? `
        <div style="padding:12px;background:var(--bg-tertiary);border-radius:var(--radius-sm);margin-bottom:12px;">
          <div style="font-size:11px;color:var(--text-tertiary);margin-bottom:4px;">PROFESOR</div>
          <div style="font-weight:600;">👨‍🏫 ${course.professor}</div>
          ${course.email ? `<div style="margin-top:4px;"><a href="mailto:${course.email}" style="color:var(--accent);font-size:13px;">📧 ${course.email}</a></div>` : ""}
        </div>`
          : ""
      }

      ${course.faculty ? `<div style="font-size:14px;color:var(--text-secondary);margin-bottom:8px;">🏛️ ${course.faculty}</div>` : ""}

      ${
        course.notes
          ? `
        <div style="background:var(--bg-tertiary);padding:12px;border-radius:var(--radius-sm);font-size:14px;color:var(--text-secondary);font-style:italic;line-height:1.6;margin-bottom:16px;">
          📝 ${course.notes}
        </div>`
          : ""
      }

      <div style="display:flex;gap:8px;margin-top:20px;">
        <button class="btn btn-primary" onclick="app.openEditCourseModal('${course.code}')">✏️ Editar Materia</button>
        <button class="btn btn-secondary" onclick="document.getElementById('class-modal').classList.remove('active')">Cerrar</button>
      </div>
    `;

    document.getElementById("class-modal").classList.add("active");
  }

  // ─── Theme ───────────────────────────────────────────────────────────────────
  toggleTheme() {
    const current =
      document.documentElement.getAttribute("data-theme") || "light";
    const next = current === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("amellify-theme", next);
    document.getElementById("theme-icon").textContent =
      next === "dark" ? "☀️" : "🌙";
  }

  // ─── Data Menu ───────────────────────────────────────────────────────────────
  showDataMenu() {
    const existing = document.getElementById("data-menu");
    if (existing) {
      existing.remove();
      return;
    }

    const menu = document.createElement("div");
    menu.id = "data-menu";
    menu.style.cssText = `
      position:fixed;top:70px;right:24px;
      background:var(--bg-secondary);
      border:1px solid var(--border);
      border-radius:var(--radius-md);
      box-shadow:var(--shadow-lg);
      z-index:500;padding:8px;min-width:220px;
    `;
    menu.innerHTML = `
      <div style="padding:8px 12px;font-size:11px;font-weight:700;color:var(--text-tertiary);text-transform:uppercase;letter-spacing:0.5px;">⚙️ Gestión de Datos</div>
      <hr style="border:none;border-top:1px solid var(--border);margin:4px 0;">
      <button class="btn btn-secondary" style="width:100%;justify-content:flex-start;margin-bottom:4px;border-radius:8px;" onclick="app.exportData()">📤 Exportar JSON</button>
      <button class="btn btn-secondary" style="width:100%;justify-content:flex-start;margin-bottom:4px;border-radius:8px;" onclick="app.triggerImport()">📥 Importar JSON</button>
      <button class="btn btn-danger" style="width:100%;justify-content:flex-start;border-radius:8px;" onclick="app.deleteAllCourses()">🗑️ Borrar Horario</button>
      <input type="file" id="import-file" accept=".json" style="display:none" onchange="app.importData(this)">
      <hr style="border:none;border-top:1px solid var(--border);margin:8px 0 4px;">
      <div style="padding:4px 12px;font-size:12px;color:var(--text-tertiary);">${this.courses.length} materias · ${this.courses.reduce((s, c) => s + (c.credits || 0), 0)} créditos</div>
    `;

    document.body.appendChild(menu);
    setTimeout(() => {
      const handler = (e) => {
        if (!menu.contains(e.target)) {
          menu.remove();
          document.removeEventListener("click", handler);
        }
      };
      document.addEventListener("click", handler);
    }, 100);
  }

  exportData() {
    const blob = new Blob([JSON.stringify(this.courses, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `amellify-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.showAlert("📤 Datos exportados", "success");
    document.getElementById("data-menu")?.remove();
  }

  triggerImport() {
    document.getElementById("import-file")?.click();
  }

  async importData(input) {
    const file = input.files[0];
    if (!file) return;
    try {
      const courses = JSON.parse(await file.text());
      if (!Array.isArray(courses)) {
        this.showAlert("Formato inválido", "error");
        return;
      }

      let imported = 0,
        skipped = 0;
      for (const course of courses) {
        const res = await fetch(`${API}/courses`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(course),
        });
        if (res.ok) imported++;
        else skipped++;
      }

      await this.fetchCourses();
      this.renderAll();
      this.showAlert(
        `✅ ${imported} importadas${skipped > 0 ? ` · ${skipped} ya existían` : ""}`,
        "success",
      );
    } catch (e) {
      this.showAlert("❌ Error al importar", "error");
    }
    input.value = "";
    document.getElementById("data-menu")?.remove();
  }

  async deleteAllCourses() {
    if (!confirm(
      `⚠️ ¿Estás seguro de que quieres borrar TODAS las materias?\n\n` +
      `Se eliminarán ${this.courses.length} materias del horario.\n\n` +
      `Esta acción NO se puede deshacer.`
    )) return;

    if (!confirm(
      `🚨 ÚLTIMA CONFIRMACIÓN\n\n` +
      `Esto borrará permanentemente todas tus materias.\n\n` +
      `¿Continuar?`
    )) return;

    document.getElementById("data-menu")?.remove();

    try {
      let deleted = 0;
      for (const course of this.courses) {
        const res = await fetch(`${API}/courses/${course.code}`, { 
          method: "DELETE" 
        });
        if (res.ok) deleted++;
      }

      await this.fetchCourses();
      this.renderAll();
      this.showAlert(`🗑️ ${deleted} materias eliminadas`, "success");
    } catch (e) {
      this.showAlert("❌ Error al borrar materias", "error");
    }
  }

  // ─── Alert ───────────────────────────────────────────────────────────────────
  showAlert(message, type = "success") {
    const container = document.getElementById("alert-container");
    const alert = document.createElement("div");
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
    container.appendChild(alert);
    setTimeout(() => {
      alert.style.opacity = "0";
      alert.style.transform = "translateX(100px)";
      alert.style.transition = "all 0.3s";
      setTimeout(() => alert.remove(), 300);
    }, 2700);
  }

  // ─── Event Listeners ─────────────────────────────────────────────────────────
  setupEventListeners() {
    // View tabs
    document.querySelectorAll(".view-tab").forEach((tab) => {
      tab.addEventListener("click", () => this.switchView(tab.dataset.view));
    });

    // Form submit
    document
      .getElementById("course-form")
      .addEventListener("submit", (e) => this.saveCourse(e));

    // Color picker
    document.querySelectorAll(".color-option").forEach((opt) => {
      opt.addEventListener("click", () => this.setColor(opt.dataset.color));
    });

    // Close modal on backdrop
    document.querySelectorAll(".modal").forEach((modal) => {
      modal.addEventListener("click", (e) => {
        if (e.target === modal) modal.classList.remove("active");
      });
    });

    // Escape key
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        document
          .querySelectorAll(".modal.active")
          .forEach((m) => m.classList.remove("active"));
        document.getElementById("data-menu")?.remove();
      }
    });
  }
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────
window.app = new AmellifyApp();
