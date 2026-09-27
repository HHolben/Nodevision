// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/CSVGridView.mjs
// This module renders declared and virtual CSV cells and constant-size range overlays without scanning the grid during pointer movement.
import { csvRenderDimensions, isDeclaredCsvCell } from "./CSVGridModel.mjs";
export function createCsvGridView(wrapper, table) {
  wrapper.classList.add("nv-csv-table-wrap");
  wrapper.style.cssText = "flex:1;overflow:auto;position:relative;isolation:isolate";
  table.style.cssText = "border-collapse:collapse;width:100%;table-layout:fixed";
  if (!document.getElementById("nv-csv-table-selection-style")) {
    const style = document.createElement("style");
    style.id = "nv-csv-table-selection-style";
    style.textContent = `
      .nv-csv-table-wrap td,.nv-csv-table-wrap th {border:1px solid #aeb7c2;padding:4px;min-width:80px;white-space:pre-wrap;overflow-wrap:anywhere;user-select:none;font-weight:normal}
      .nv-csv-table-wrap [contenteditable=true] {user-select:text}
      .nv-csv-virtual-cell {outline:1px dashed #c7ced8;outline-offset:-3px;background:rgba(148,163,184,.05)}
      .nv-csv-range {position:absolute;pointer-events:none;box-sizing:border-box;border:2px solid #287bdd;background:rgba(47,128,255,.12);z-index:1}
      .nv-csv-destination {border:3px dashed #16834b;background:rgba(22,131,75,.12);z-index:2}
      .nv-csv-moving {cursor:grabbing}
      .nv-csv-table-wrap :focus {outline:2px solid #1456b3;outline-offset:-2px}
    `;
    document.head.appendChild(style);
  }
  const selection = document.createElement("div"), destination = document.createElement("div");
  selection.className = "nv-csv-range";
  destination.className = "nv-csv-range nv-csv-destination";
  for (const overlay of [selection, destination]) { overlay.hidden = true; wrapper.appendChild(overlay); }
  const cellAt = (r, c) => table.rows[r]?.cells[c];
  function render(rows, active) {
    const dims = csvRenderDimensions(rows, active);
    table.innerHTML = "";
    for (let r = 0; r < dims.rows; r++) {
      const tr = document.createElement("tr");
      for (let c = 0; c < dims.cols; c++) {
        const cell = document.createElement(r === 0 ? "th" : "td");
        cell.tabIndex = -1;
        cell.dataset.row = String(r); cell.dataset.col = String(c);
        cell.textContent = rows[r]?.[c] ?? "";
        cell.classList.toggle("nv-csv-virtual-cell", !isDeclaredCsvCell(rows, r, c));
        cell.dataset.declared = String(isDeclaredCsvCell(rows, r, c));
        tr.appendChild(cell);
      }
      table.appendChild(tr);
    }
  }
  function paint(range, preview = false) {
    const overlay = preview ? destination : selection;
    const maxRow = table.rows.length - 1, maxCol = table.rows[0]?.cells.length - 1;
    const first = range && cellAt(Math.min(range.top, maxRow), Math.min(range.left, maxCol));
    const last = range && cellAt(Math.min(range.bottom, maxRow), Math.min(range.right, maxCol));
    overlay.hidden = !first || !last;
    if (overlay.hidden) return;
    const a = first.getBoundingClientRect(), b = last.getBoundingClientRect(), root = wrapper.getBoundingClientRect();
    const left = a.left + Math.max(0, range.left - maxCol) * a.width;
    const top = a.top + Math.max(0, range.top - maxRow) * a.height;
    const right = b.right + Math.max(0, range.right - maxCol) * b.width;
    const bottom = b.bottom + Math.max(0, range.bottom - maxRow) * b.height;
    Object.assign(overlay.style, { left: `${left - root.left + wrapper.scrollLeft - wrapper.clientLeft}px`,
      top: `${top - root.top + wrapper.scrollTop - wrapper.clientTop}px`, width: `${right - left}px`, height: `${bottom - top}px` });
  }
  return { render, cellAt, paint };
}
