/** Generación de calendario .ics (RFC 5545) */

const DAY_TO_ICAL = {
  Domingo: 'SU',
  Lunes: 'MO',
  Martes: 'TU',
  Miércoles: 'WE',
  Jueves: 'TH',
  Viernes: 'FR',
  Sábado: 'SA',
};

function pad(n) {
  return String(n).padStart(2, '0');
}

function formatIcalUtc(date) {
  return (
    date.getUTCFullYear() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    'T' +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    'Z'
  );
}

function escapeIcal(text) {
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n');
}

function nextDateForDay(dayName, hour, minute) {
  const target = {
    Domingo: 0,
    Lunes: 1,
    Martes: 2,
    Miércoles: 3,
    Jueves: 4,
    Viernes: 5,
    Sábado: 6,
  }[dayName];
  if (target === undefined) return new Date();

  const now = new Date();
  const d = new Date(now);
  let diff = target - d.getDay();
  if (diff < 0) diff += 7;
  if (diff === 0) {
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const slotMin = hour * 60 + minute;
    if (nowMin >= slotMin) diff = 7;
  }
  d.setDate(d.getDate() + diff);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function parseTime(t) {
  const [h, m] = String(t || '08:00').split(':').map(Number);
  return { h: h || 0, m: m || 0 };
}

/**
 * @param {Array} courses
 * @param {{ weeks?: number }} options
 */
export function generateIcs(courses, options = {}) {
  const weeks = options.weeks || 16;
  const uidHost = 'amellify.local';
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Amellify//University Schedule//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Amellify Horario',
  ];

  const stamp = formatIcalUtc(new Date());

  for (const course of courses) {
    if (course.status === 'dropped') continue;
    for (const s of course.schedules || []) {
      const { h: sh, m: sm } = parseTime(s.start_time);
      const { h: eh, m: em } = parseTime(s.end_time);
      const start = nextDateForDay(s.day, sh, sm);
      const end = new Date(start);
      end.setHours(eh, em, 0, 0);
      if (end <= start) end.setMinutes(end.getMinutes() + 90);

      const until = new Date(start);
      until.setDate(until.getDate() + weeks * 7);
      const byday = DAY_TO_ICAL[s.day] || 'MO';
      const uid = `${course.code}-${s.id || s.day}-${s.start_time}@${uidHost}`;

      const summary = escapeIcal(`${course.code} — ${course.name}`);
      const location = escapeIcal(s.room || '');
      const description = escapeIcal(
        [course.professor && `Prof: ${course.professor}`, course.email]
          .filter(Boolean)
          .join('\\n')
      );

      lines.push(
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${stamp}`,
        `DTSTART:${formatIcalUtc(start)}`,
        `DTEND:${formatIcalUtc(end)}`,
        `RRULE:FREQ=WEEKLY;BYDAY=${byday};UNTIL=${formatIcalUtc(until)}`,
        `SUMMARY:${summary}`,
        location ? `LOCATION:${location}` : '',
        description ? `DESCRIPTION:${description}` : '',
        'END:VEVENT'
      );
    }
  }

  lines.push('END:VCALENDAR');
  return lines.filter(Boolean).join('\r\n');
}

export function downloadIcs(courses, filename) {
  const ics = generateIcs(courses);
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename || `amellify-${new Date().toISOString().slice(0, 10)}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}
