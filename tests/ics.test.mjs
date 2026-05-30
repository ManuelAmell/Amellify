import { test } from "node:test";
import assert from "node:assert/strict";
import { generateIcs } from "../src/js/ics.js";

test("generateIcs produce calendario válido con eventos recurrentes", () => {
  const courses = [
    {
      code: "MAT101",
      name: "Matemáticas",
      status: "active",
      schedules: [
        {
          id: 1,
          day: "Lunes",
          start_time: "08:00",
          end_time: "10:00",
          room: "A-1",
        },
      ],
    },
  ];

  const ics = generateIcs(courses, { weeks: 2 });
  assert.match(ics, /BEGIN:VCALENDAR/);
  assert.match(ics, /BEGIN:VEVENT/);
  assert.match(ics, /RRULE:FREQ=WEEKLY/);
  assert.match(ics, /SUMMARY:.*Matemáticas/);
  assert.match(ics, /END:VCALENDAR/);
});

test("generateIcs omite materias sin horarios", () => {
  const ics = generateIcs([{ code: "VACIO", name: "Sin clase", schedules: [] }]);
  assert.doesNotMatch(ics, /BEGIN:VEVENT/);
});
