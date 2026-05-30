/** ICS export para el servidor Node */

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
  const now = new Date();
  const d = new Date(now);
  let diff = (target ?? 1) - d.getDay();
  if (diff < 0) diff += 7;
  d.setDate(d.getDate() + diff);
  d.setHours(hour, minute, 0, 0);
  return d;
}

function generateIcsFromCourses(courses, weeks = 16) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Amellify//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];
  const stamp = formatIcalUtc(new Date());

  for (const course of courses) {
    if (course.status === 'dropped') continue;
    for (const s of course.schedules || []) {
      const [sh, sm] = (s.start_time || '08:00').split(':').map(Number);
      const [eh, em] = (s.end_time || '10:00').split(':').map(Number);
      const start = nextDateForDay(s.day, sh, sm);
      const end = new Date(start);
      end.setHours(eh, em, 0, 0);
      const until = new Date(start);
      until.setDate(until.getDate() + weeks * 7);
      const uid = `${course.code}-${s.id || s.day}@amellify`;

      lines.push(
        'BEGIN:VEVENT',
        `UID:${uid}`,
        `DTSTAMP:${stamp}`,
        `DTSTART:${formatIcalUtc(start)}`,
        `DTEND:${formatIcalUtc(end)}`,
        `RRULE:FREQ=WEEKLY;BYDAY=${DAY_TO_ICAL[s.day] || 'MO'};UNTIL=${formatIcalUtc(until)}`,
        `SUMMARY:${escapeIcal(`${course.code} — ${course.name}`)}`,
        s.room ? `LOCATION:${escapeIcal(s.room)}` : '',
        'END:VEVENT'
      );
    }
  }
  lines.push('END:VCALENDAR');
  return lines.filter(Boolean).join('\r\n');
}

module.exports = { generateIcsFromCourses };
