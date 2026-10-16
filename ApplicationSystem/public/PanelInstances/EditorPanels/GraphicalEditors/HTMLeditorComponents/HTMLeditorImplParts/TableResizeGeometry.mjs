// Logical table coordinates and a drag-start sizing snapshot. Keep the browser's
// table layout and intrinsic/CSS minimum constraints; only resize one track.
import { getClientToLayoutScale } from './MeasureTableRowHeight.mjs';

export function getTableGrid(table) {
  const rows = Array.from(table.rows), occupied = [], cells = [];
  let columnCount = 0;
  rows.forEach((row, r) => {
    occupied[r] ||= [];
    let c = 0;
    for (const cell of row.cells) {
      while (occupied[r][c]) c++;
      const columns = cell.colSpan || 1;
      const groupRows = rows.slice(r).filter(item => item.parentElement === row.parentElement).length;
      const rowSpan = Math.min(cell.rowSpan || groupRows, groupRows);
      cells.push({ cell, row: r, column: c, rows: rowSpan, columns });
      for (let y = r; y < r + rowSpan; y++) {
        occupied[y] ||= [];
        for (let x = c; x < c + columns; x++) occupied[y][x] = cell;
      }
      c += columns;
      columnCount = Math.max(columnCount, c);
    }
  });
  return { rows, cells, columnCount };
}

function dimension(element, axis, scale) {
  return element.getBoundingClientRect()[axis === 'x' ? 'width' : 'height'] * scale;
}
function sizing(element, axis, scale) {
  const style = getComputedStyle(element);
  const sides = axis === 'x' ? ['Left', 'Right'] : ['Top', 'Bottom'];
  const inset = style.boxSizing === 'border-box' ? 0 : sides.reduce((n, side) =>
    n + (parseFloat(style['padding' + side]) || 0) + (parseFloat(style['border' + side + 'Width']) || 0), 0);
  const minimum = style[axis === 'x' ? 'minWidth' : 'minHeight'];
  return { element, size: dimension(element, axis, scale), inset,
    minimum: minimum.endsWith('px') ? parseFloat(minimum) : 0 };
}
function setSize(item, property, size) {
  item.element.style[property] = Math.max(item.minimum, size - item.inset) + 'px';
}

export function createTableResizeState(table, hit) {
  const grid = getTableGrid(table), column = hit.kind === 'column';
  const axis = column ? 'x' : 'y', property = column ? 'width' : 'height';
  const scale = getClientToLayoutScale(table, axis);
  const tableSize = sizing(table, axis, scale);
  const items = grid.cells.map(entry => ({ ...sizing(entry.cell, axis, scale),
    affected: column ? entry.column <= hit.index && hit.index < entry.column + entry.columns
      : entry.row <= hit.index && hit.index < entry.row + entry.rows }));
  if (!column) grid.rows.forEach((row, index) => items.push({
    ...sizing(row, axis, scale), affected: index === hit.index
  }));
  // Existing col/colgroup sizing participates in layout too. Preserve spans.
  if (column) {
    let index = 0;
    for (const group of Array.from(table.children).filter(el => el.tagName === 'COLGROUP')) {
      const cols = Array.from(group.children).filter(el => el.tagName === 'COL');
      for (const col of cols.length ? cols : [group]) {
        const span = col.span || 1;
        items.push({ ...sizing(col, axis, scale), affected: index <= hit.index && hit.index < index + span });
        index += span;
      }
    }
  }
  const write = delta => {
    for (const item of items) setSize(item, property, item.size + (item.affected ? delta : 0));
    setSize(tableSize, property, tableSize.size + delta);
  };
  // Ask layout for the real minimum with the other tracks held at their original
  // sizes. This respects images, padding, min-width/height and spanning cells.
  const entry = grid.cells.find(entry => entry.cell === hit.cell);
  const edge = column && entry.column > hit.index ? 'left' : 'right';
  const start = column ? hit.cell.getBoundingClientRect()[edge] : grid.rows[hit.index].getBoundingClientRect().bottom;
  const origin = table.getBoundingClientRect()[column ? 'left' : 'top'];
  write(-tableSize.size);
  const minEdge = column ? hit.cell.getBoundingClientRect()[edge] : grid.rows[hit.index].getBoundingClientRect().bottom;
  const minOrigin = table.getBoundingClientRect()[column ? 'left' : 'top'];
  const minimumDelta = (minEdge - minOrigin - (start - origin)) * scale;
  write(0);
  return { kind: hit.kind, scale, apply(delta) { write(Math.max(minimumDelta, delta)); } };
}
