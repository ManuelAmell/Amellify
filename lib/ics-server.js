/** ICS export para el servidor Node (reexporta ics-calendar) */

const { generateCalendarIcs } = require('./ics-calendar');

function generateIcsFromCourses(courses, weeks) {
  return generateCalendarIcs(courses, { weeks });
}

module.exports = { generateIcsFromCourses, generateCalendarIcs };
