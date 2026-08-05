/**
 * Arrastrar bloques de clase en el grid para cambiar día/hora
 */
function getScheduleDays(app) {
  if (typeof app.getScheduleDays === 'function') return app.getScheduleDays();
  return ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
}

const SLOT_MIN = 10;

export function setupGridDragDrop(app) {
  const grid = document.getElementById('grid-timeline');
  if (!grid) return;

  const slotH = app.settings?.gridCompact ? 10 : 16;
  let dragged = null;
  let didDrag = false;

  grid.querySelectorAll('.draggable-cell').forEach((cell) => {
    cell.addEventListener('dragstart', (e) => {
      didDrag = false;
      dragged = {
        code: cell.dataset.code,
        schedId: Number(cell.dataset.schedId),
        day: cell.dataset.day,
        start: cell.dataset.start,
        end: cell.dataset.end,
        duration:
          timeToMin(cell.dataset.end) - timeToMin(cell.dataset.start),
      };
      cell.classList.add('is-dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', cell.dataset.code);
    });

    cell.addEventListener('dragend', () => {
      didDrag = true;
      setTimeout(() => { didDrag = false; }, 200);
      cell.classList.remove('is-dragging');
      grid.querySelectorAll('.drop-target').forEach((el) =>
        el.classList.remove('drop-target')
      );
    });

    cell.addEventListener('click', (e) => {
      if (didDrag) {
        e.stopPropagation();
        e.preventDefault();
      }
    }, true);
  });

  grid.addEventListener('dragover', (e) => {
    if (!dragged) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const col = getColumnFromX(grid, e.clientX);
    if (col >= 0) {
      getDayHeaders(grid).forEach((h, i) => {
        h.classList.toggle('drop-target', i + 1 === col);
      });
    }
  });

  grid.addEventListener('drop', async (e) => {
    e.preventDefault();
    if (!dragged) return;

    const col = getColumnFromX(grid, e.clientX);
    const row = getRowFromY(grid, e.clientY, slotH);
    if (col < 1 || col > days.length || row < 2) return;

    const newDay = days[col - 1];
    const newStartMin = (row - 2) * SLOT_MIN;
    const newEndMin = newStartMin + dragged.duration;
    const newStart = minToTime(newStartMin);
    const newEnd = minToTime(Math.min(newEndMin, 24 * 60 - 1));

    if (newDay === dragged.day && newStart === dragged.start) return;

    await app.moveSchedule(dragged.code, dragged.schedId, {
      _oldDay: dragged.day,
      _oldStart: dragged.start,
      _oldEnd: dragged.end,
      day: newDay,
      start_time: newStart,
      end_time: newEnd,
    });
    dragged = null;
  });
}

function timeToMin(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function minToTime(m) {
  const h = Math.floor(m / 60);
  const min = m % 60;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function getDayHeaders(grid) {
  const all = [...grid.querySelectorAll('.grid-header-cell')];
  return all.slice(1, all.length - 1);
}

function getColumnFromX(grid, clientX) {
  const headers = getDayHeaders(grid);
  for (let i = 0; i < headers.length; i++) {
    const r = headers[i].getBoundingClientRect();
    if (clientX >= r.left && clientX <= r.right) return i + 1;
  }
  return -1;
}

function getRowFromY(grid, clientY, slotH) {
  const container = document.getElementById('grid-schedule-container');
  const rect = grid.getBoundingClientRect();
  const scrollTop = container?.scrollTop || 0;
  const relY = clientY - rect.top + scrollTop;
  const firstHeader = grid.querySelector('.grid-header-cell');
  const headerHeight = firstHeader ? firstHeader.getBoundingClientRect().height : 36;
  const row = Math.floor((relY - headerHeight) / slotH) + 2;
  return Math.max(2, Math.min(row, 2 + (24 * 60) / SLOT_MIN));
}
