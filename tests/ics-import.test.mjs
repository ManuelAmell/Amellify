import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseIcsEvents, eventsToImportPreview } from '../lib/ics-import.js';

const SAMPLE = `BEGIN:VCALENDAR
VERSION:2.0
BEGIN:VEVENT
SUMMARY:Matemáticas I
DTSTART:20260115T080000
DTEND:20260115T100000
RRULE:FREQ=WEEKLY;BYDAY=MO
LOCATION:Aula 101
END:VEVENT
BEGIN:VEVENT
SUMMARY:Examen Final
DTSTART:20260601T090000
DTEND:20260601T110000
END:VEVENT
END:VCALENDAR`;

describe('ics-import', () => {
  it('parsea eventos VEVENT', () => {
    const events = parseIcsEvents(SAMPLE);
    assert.equal(events.length, 2);
    assert.equal(events[0].isRecurring, true);
    assert.equal(events[0].day, 'Lunes');
    assert.equal(events[1].exam_date, '2026-06-01');
  });

  it('genera preview de importación', () => {
    const events = parseIcsEvents(SAMPLE);
    const preview = eventsToImportPreview(events);
    assert.ok(preview.courses.length >= 1);
    assert.ok(preview.exams.length >= 1);
  });
});
