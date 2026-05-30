/** Recordatorios de clase y tareas vía Notification API */

const DAY_MAP = {
  Domingo: 0,
  Lunes: 1,
  Martes: 2,
  Miércoles: 3,
  Jueves: 4,
  Viernes: 5,
  Sábado: 6,
};

export class ClassNotificationManager {
  constructor(app) {
    this.app = app;
    this._timers = [];
    this._notifiedKeys = new Set();
  }

  getSettings() {
    return {
      enabled: this.app.settings.notifications !== false,
      minutesBefore: this.app.settings.notifyMinutesBefore ?? 15,
      tasksEnabled: this.app.settings.taskNotifications !== false,
    };
  }

  async requestPermission() {
    if (!('Notification' in window)) return 'unsupported';
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied') return 'denied';
    return Notification.requestPermission();
  }

  clearTimers() {
    for (const t of this._timers) clearTimeout(t);
    this._timers = [];
  }

  schedule(courses) {
    this.clearTimers();
    const { enabled, minutesBefore } = this.getSettings();
    if (!enabled || Notification.permission !== 'granted') return;

    const now = Date.now();
    const horizon = 7 * 24 * 60 * 60 * 1000;

    for (const course of courses) {
      if (course.status !== 'active') continue;
      for (const s of course.schedules || []) {
        const targetDay = DAY_MAP[s.day];
        if (targetDay === undefined) continue;

        const [sh, sm] = s.start_time.split(':').map(Number);
        const candidate = new Date();
        let daysUntil = targetDay - candidate.getDay();
        const nowMin = candidate.getHours() * 60 + candidate.getMinutes();
        const classMin = sh * 60 + sm;

        if (daysUntil === 0 && nowMin >= classMin) daysUntil = 7;
        else if (daysUntil < 0) daysUntil += 7;

        candidate.setDate(candidate.getDate() + daysUntil);
        candidate.setHours(sh, sm, 0, 0);

        const notifyAt = candidate.getTime() - minutesBefore * 60 * 1000;
        const delay = notifyAt - now;

        if (delay <= 0 || delay > horizon) continue;

        const key = `class-${course.code}-${s.day}-${s.start_time}-${candidate.toDateString()}`;
        if (this._notifiedKeys.has(key)) continue;

        const timer = setTimeout(() => {
          this._notifiedKeys.add(key);
          const title = minutesBefore > 0
            ? `Clase en ${minutesBefore} min`
            : 'Clase ahora';
          const body = `${course.name} · ${s.start_time}${s.room ? ` · ${s.room}` : ''}`;
          new Notification(title, { body, tag: key, silent: false });
        }, delay);

        this._timers.push(timer);
      }
    }
  }

  scheduleTasks(tasks) {
    const { enabled, tasksEnabled } = this.getSettings();
    if (!enabled || !tasksEnabled || Notification.permission !== 'granted' || !Array.isArray(tasks)) return;

    const now = Date.now();
    const horizon = 7 * 24 * 60 * 60 * 1000;

    for (const task of tasks) {
      if (task.completed || !task.due_date) continue;

      const due = new Date(`${task.due_date}T09:00:00`);
      const notifyAt = due.getTime() - 24 * 60 * 60 * 1000;
      const delay = notifyAt - now;
      if (delay <= 0 || delay > horizon) continue;

      const key = `task-${task.id}-${task.due_date}`;
      if (this._notifiedKeys.has(key)) continue;

      const timer = setTimeout(() => {
        this._notifiedKeys.add(key);
        new Notification('Entrega mañana', {
          body: `${task.title}${task.course_code ? ` · ${task.course_code}` : ''}`,
          tag: key,
        });
      }, delay);

      this._timers.push(timer);
    }
  }
}
