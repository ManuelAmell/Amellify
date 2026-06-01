/** Importación de calendarios ICS (URL o texto) */

const DAY_FROM_ICAL = {
  SU: 'Domingo',
  MO: 'Lunes',
  TU: 'Martes',
  WE: 'Miércoles',
  TH: 'Jueves',
  FR: 'Viernes',
  SA: 'Sábado',
};

function unfoldIcs(text) {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .reduce((acc, line) => {
      if (/^[ \t]/.test(line) && acc.length) {
        acc[acc.length - 1] += line.slice(1);
      } else {
        acc.push(line);
      }
      return acc;
    }, []);
}

function parseIcsDate(value) {
  if (!value) return null;
  const v = value.replace(/[^0-9TZ]/g, '');
  if (v.length >= 8) {
    const y = v.slice(0, 4);
    const mo = v.slice(4, 6);
    const d = v.slice(6, 8);
    const h = v.length >= 10 ? v.slice(9, 11) || '09' : '09';
    const mi = v.length >= 12 ? v.slice(11, 13) || '00' : '00';
    return { date: `${y}-${mo}-${d}`, time: `${h}:${mi}` };
  }
  return null;
}

function parseIcsEvents(icsText) {
  const lines = unfoldIcs(icsText);
  const events = [];
  let current = null;

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      current = {};
      continue;
    }
    if (line === 'END:VEVENT' && current) {
      events.push(current);
      current = null;
      continue;
    }
    if (!current) continue;

    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const key = line.slice(0, idx).split(';')[0];
    const val = line.slice(idx + 1);

    if (key === 'SUMMARY') current.summary = val;
    if (key === 'LOCATION') current.location = val;
    if (key === 'DESCRIPTION') current.description = val;
    if (key === 'DTSTART') current.dtstart = val;
    if (key === 'DTEND') current.dtend = val;
    if (key === 'RRULE') current.rrule = val;
    if (key === 'UID') current.uid = val;
  }

  return events.map((ev) => {
    const start = parseIcsDate(ev.dtstart);
    let day = null;
    if (ev.rrule) {
      const byday = ev.rrule.match(/BYDAY=([A-Z]{2})/i);
      if (byday) day = DAY_FROM_ICAL[byday[1].toUpperCase()] || null;
    }
    if (!day && start?.date) {
      const d = new Date(`${start.date}T12:00:00`);
      day = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'][
        d.getDay()
      ];
    }
    return {
      title: (ev.summary || 'Evento').replace(/\\n/g, ' ').replace(/\\,/g, ','),
      room: ev.location || '',
      day,
      start_time: start?.time || '09:00',
      end_time: start?.time ? addHour(start.time) : '10:00',
      exam_date: start?.date,
      isRecurring: !!ev.rrule,
      uid: ev.uid,
    };
  });
}

function addHour(time) {
  const [h, m] = time.split(':').map(Number);
  return `${String(Math.min(23, h + 1)).padStart(2, '0')}:${String(m || 0).padStart(2, '0')}`;
}

function eventsToImportPreview(events) {
  const courses = [];
  const exams = [];
  const seen = new Set();

  for (const ev of events) {
    if (!ev.title) continue;
    const code = slugCode(ev.title);
    if (ev.isRecurring && ev.day) {
      if (!seen.has(code)) {
        seen.add(code);
        courses.push({
          code,
          name: ev.title.slice(0, 80),
          color: 'blue',
          status: 'active',
          schedules: [{ day: ev.day, start_time: ev.start_time, end_time: ev.end_time, room: ev.room }],
        });
      } else {
        const c = courses.find((x) => x.code === code);
        if (c) c.schedules.push({ day: ev.day, start_time: ev.start_time, end_time: ev.end_time, room: ev.room });
      }
    } else if (ev.exam_date) {
      exams.push({
        title: ev.title,
        course_code: code,
        exam_date: ev.exam_date,
        exam_time: ev.start_time,
        room: ev.room,
      });
    }
  }

  return { courses, exams, totalEvents: events.length };
}

function slugCode(title) {
  const base = title
    .replace(/[^a-zA-Z0-9áéíóúñÁÉÍÓÚÑ ]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.slice(0, 4).toUpperCase())
    .join('');
  return (base || 'EVT').slice(0, 12);
}

async function fetchIcsFromUrl(url) {
  const parsed = new URL(url);
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Solo se permiten URLs http o https');
  }
  const res = await fetch(url, {
    headers: { Accept: 'text/calendar' },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`No se pudo descargar el calendario (${res.status})`);
  const text = await res.text();
  if (!text.includes('BEGIN:VCALENDAR')) throw new Error('El archivo no parece un calendario ICS válido');
  return text;
}

module.exports = {
  parseIcsEvents,
  eventsToImportPreview,
  fetchIcsFromUrl,
};
