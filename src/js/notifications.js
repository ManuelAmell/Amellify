/** Recordatorios de clase, tareas y exámenes vía Notification API */

const DAY_MAP = {
  Domingo: 0,
  Lunes: 1,
  Martes: 2,
  Miércoles: 3,
  Jueves: 4,
  Viernes: 5,
  Sábado: 6,
};

function parseTimeToMinutes(t) {
  const [h, m] = String(t || '00:00').split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

export class AcademicNotificationManager {
  constructor(app) {
    this.app = app;
    this._timers = [];
    this._notifiedKeys = new Set();
  }

  getSettings() {
    const s = this.app.settings || {};
    return {
      enabled: s.notifications !== false,
      minutesBefore: s.notifyMinutesBefore ?? 15,
      tasksEnabled: s.taskNotifications !== false,
      examsEnabled: s.examNotifications !== false,
      taskDaysBefore: s.notifyTaskDaysBefore ?? 1,
      examDaysBefore: s.notifyExamDaysBefore ?? 3,
      dndEnabled: s.dndEnabled !== false,
      dndStart: s.dndStart || '22:00',
      dndEnd: s.dndEnd || '08:00',
    };
  }

  isInDndWindow(at = new Date()) {
    const { dndEnabled, dndStart, dndEnd } = this.getSettings();
    if (!dndEnabled) return false;
    const nowMin = at.getHours() * 60 + at.getMinutes();
    const start = parseTimeToMinutes(dndStart);
    const end = parseTimeToMinutes(dndEnd);
    if (start < end) return nowMin >= start && nowMin < end;
    return nowMin >= start || nowMin < end;
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

  _queueNotification(key, notifyAt, title, body) {
    const now = Date.now();
    const delay = notifyAt - now;
    const horizon = 14 * 24 * 60 * 60 * 1000;
    if (delay <= 0 || delay > horizon) return;
    if (this._notifiedKeys.has(key)) return;

    const timer = setTimeout(() => {
      if (this.isInDndWindow(new Date(notifyAt))) return;
      this._notifiedKeys.add(key);
      new Notification(title, { body, tag: key, silent: false });
    }, delay);
    this._timers.push(timer);
  }

  schedule(courses) {
    this.clearTimers();
    const { enabled, minutesBefore } = this.getSettings();
    if (!enabled || Notification.permission !== 'granted') return;

    const now = Date.now();

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
        const key = `class-${course.code}-${s.day}-${s.start_time}-${candidate.toDateString()}`;
        const title =
          minutesBefore > 0 ? `Clase en ${minutesBefore} min` : 'Clase ahora';
        const body = `${course.name} · ${s.start_time}${s.room ? ` · ${s.room}` : ''}`;
        this._queueNotification(key, notifyAt, title, body);
      }
    }
  }

  scheduleTasks(tasks) {
    const { enabled, tasksEnabled, taskDaysBefore } = this.getSettings();
    if (!enabled || !tasksEnabled || Notification.permission !== 'granted' || !Array.isArray(tasks)) {
      return;
    }

    for (const task of tasks) {
      if (task.completed || !task.due_date) continue;
      const due = new Date(`${task.due_date}T09:00:00`);
      const notifyAt = due.getTime() - taskDaysBefore * 24 * 60 * 60 * 1000;
      const key = `task-${task.id}-${task.due_date}-${taskDaysBefore}`;
      const title =
        taskDaysBefore === 1
          ? 'Entrega mañana'
          : `Entrega en ${taskDaysBefore} días`;
      const body = `${task.title}${task.course_code ? ` · ${task.course_code}` : ''}`;
      this._queueNotification(key, notifyAt, title, body);
    }
  }

  scheduleExams(exams) {
    const { enabled, examsEnabled, examDaysBefore } = this.getSettings();
    if (!enabled || examsEnabled === false || Notification.permission !== 'granted' || !Array.isArray(exams)) {
      return;
    }

    for (const exam of exams) {
      if (!exam.exam_date) continue;
      const due = new Date(`${exam.exam_date}T${exam.exam_time || '09:00'}`);
      const notifyAt = due.getTime() - examDaysBefore * 24 * 60 * 60 * 1000;
      const key = `exam-${exam.id}-${exam.exam_date}-${examDaysBefore}`;
      const title =
        examDaysBefore === 1
          ? 'Examen mañana'
          : `Examen en ${examDaysBefore} días`;
      const body = `${exam.title} · ${exam.course_code}${exam.room ? ` · ${exam.room}` : ''}`;
      this._queueNotification(key, notifyAt, title, body);
    }
  }

  rescheduleAll(courses, tasks, exams) {
    this.clearTimers();
    this.schedule(courses);
    this.scheduleTasks(tasks);
    this.scheduleExams(exams);
  }
}

/** @deprecated alias */
export const ClassNotificationManager = AcademicNotificationManager;
