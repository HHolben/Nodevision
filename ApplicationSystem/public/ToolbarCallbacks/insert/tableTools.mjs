// Shared HTML table editing helpers for toolbar callbacks.
import { updateToolbarState } from "/panels/createToolbar.mjs";

function getTableEditorRoot() {
  const registeredRoot = window.__nvTableEditorRoot;
  if (registeredRoot && registeredRoot.isConnected) return registeredRoot;
  return document.querySelector("#wysiwyg[contenteditable='true']");
}

function closestCell(node) {
  const el = node?.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  return el?.closest?.("td, th") || null;
}

function isCellInEditor(cell, wysiwyg = getTableEditorRoot()) {
  return Boolean(cell && cell.isConnected && wysiwyg && wysiwyg.contains(cell));
}

function currentSelectionCell() {
  const wysiwyg = getTableEditorRoot();
  const sel = window.getSelection?.();
  if (!wysiwyg || !sel || !sel.rangeCount) return null;
  const range = sel.getRangeAt(0);
  const cell = closestCell(range.startContainer);
  return isCellInEditor(cell, wysiwyg) ? cell : null;
}

export function setActiveTableCell(cell) {
  const wysiwyg = getTableEditorRoot();
  const activeCell = isCellInEditor(cell, wysiwyg) ? cell : null;
  window.__nvHtmlTableActiveCell = activeCell;
  window.__nvHtmlTableActiveTable = activeCell?.closest("table") || null;
  return activeCell;
}

export function getActiveTableCell() {
  const wysiwyg = getTableEditorRoot();
  const saved = window.__nvHtmlTableActiveCell;
  if (isCellInEditor(saved, wysiwyg)) return saved;
  const selected = currentSelectionCell();
  if (selected) return setActiveTableCell(selected);
  return null;
}

export function focusTableCell(cell, { atEnd = false } = {}) {
  if (!cell) return false;
  const sel = window.getSelection?.();
  if (!sel) return false;
  const range = document.createRange();
  range.selectNodeContents(cell);
  range.collapse(!atEnd);
  sel.removeAllRanges();
  sel.addRange(range);
  try {
    cell.focus?.({ preventScroll: true });
  } catch {
    cell.focus?.();
  }
  cell.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  setActiveTableCell(cell);
  updateToolbarState({ htmlTableSelected: true });
  return true;
}

function focusCell(cell) {
  return focusTableCell(cell);
}

function readCellSpan(cell, attrName, rowIndex = 0, rowCount = 0) {
  const raw = Number.parseInt(cell?.getAttribute?.(attrName) || "", 10);
  if (attrName === "rowspan" && raw === 0) return Math.max(1, rowCount - rowIndex);
  if (Number.isFinite(raw) && raw > 1) return raw;
  const propertyName = attrName === "rowspan" ? "rowSpan" : "colSpan";
  const propertyValue = Number.parseInt(cell?.[propertyName] || 1, 10);
  return Number.isFinite(propertyValue) && propertyValue > 1 ? propertyValue : 1;
}

function setCellSpan(cell, attrName, value) {
  const span = Math.max(1, Number.parseInt(value, 10) || 1);
  if (span > 1) cell.setAttribute(attrName, String(span));
  else cell.removeAttribute(attrName);
}

function buildTableGrid(table) {
  const rows = Array.from(table?.rows || []);
  const grid = [];
  const origins = new Map();

  rows.forEach((row, rowIndex) => {
    grid[rowIndex] = grid[rowIndex] || [];
    let colIndex = 0;
    Array.from(row.cells || []).forEach((cell) => {
      while (grid[rowIndex][colIndex]) colIndex += 1;
      const rowSpan = readCellSpan(cell, "rowspan", rowIndex, rows.length);
      const colSpan = readCellSpan(cell, "colspan", rowIndex, rows.length);
      const origin = { cell, row, rowIndex, colIndex, rowSpan, colSpan };
      origins.set(cell, origin);
      for (let r = rowIndex; r < rowIndex + rowSpan; r += 1) {
        grid[r] = grid[r] || [];
        for (let c = colIndex; c < colIndex + colSpan; c += 1) {
          grid[r][c] = origin;
        }
      }
      colIndex += colSpan;
    });
  });

  return { table, rows, grid, origins };
}


function originIsInsideRect(origin, top, left, bottom, right) {
  return origin.rowIndex >= top &&
    origin.colIndex >= left &&
    origin.rowIndex + origin.rowSpan <= bottom &&
    origin.colIndex + origin.colSpan <= right;
}

function collectOriginsInRect(model, top, left, bottom, right) {
  const seen = new Set();
  const origins = [];
  for (let rowIndex = top; rowIndex < bottom; rowIndex += 1) {
    for (let colIndex = left; colIndex < right; colIndex += 1) {
      const origin = model.grid[rowIndex]?.[colIndex] || null;
      if (!origin) return null;
      if (!seen.has(origin.cell)) {
        seen.add(origin.cell);
        origins.push(origin);
      }
    }
  }
  return origins;
}

function sortOriginsByVisualPosition(origins = []) {
  return [...origins].sort((a, b) =>
    (a.rowIndex - b.rowIndex) ||
    (a.colIndex - b.colIndex) ||
    Array.from(a.row?.cells || []).indexOf(a.cell) - Array.from(b.row?.cells || []).indexOf(b.cell)
  );
}

function tableCellHasContent(cell) {
  for (const node of Array.from(cell?.childNodes || [])) {
    if (node.nodeType === Node.TEXT_NODE && String(node.nodeValue || "").trim()) return true;
    if (node.nodeType === Node.ELEMENT_NODE && node.tagName !== "BR") return true;
  }
  return false;
}

function appendMergedCellContent(anchor, source) {
  const anchorHasContent = tableCellHasContent(anchor);
  const sourceHasContent = tableCellHasContent(source);
  if (anchorHasContent && sourceHasContent) anchor.appendChild(document.createElement("br"));
  while (source.firstChild) anchor.appendChild(source.firstChild);
}

function makeEmptyCellLike(source) {
  const cell = document.createElement(source?.tagName || "TD");
  copyCellStyle(cell, source);
  return cell;
}

function rangeIntersectsNode(range, node) {
  try {
    return range.intersectsNode(node);
  } catch {
    return false;
  }
}

function selectedOriginsInTable(table, model) {
  const selection = window.getSelection?.();
  if (!selection || selection.isCollapsed || selection.rangeCount < 1) return [];

  const seen = new Set();
  const origins = [];
  const cells = Array.from(table.querySelectorAll("td, th"));
  for (let rangeIndex = 0; rangeIndex < selection.rangeCount; rangeIndex += 1) {
    const range = selection.getRangeAt(rangeIndex);
    cells.forEach((cell) => {
      if (seen.has(cell) || !rangeIntersectsNode(range, cell)) return;
      const origin = model.origins.get(cell);
      if (!origin) return;
      seen.add(cell);
      origins.push(origin);
    });
  }
  return origins;
}

function mergeCellOrigins(model, origins, { requireExactSet = true } = {}) {
  const unique = [];
  const selected = new Set();
  origins.forEach((origin) => {
    if (!origin?.cell || selected.has(origin.cell)) return;
    selected.add(origin.cell);
    unique.push(origin);
  });
  if (unique.length < 2) return false;

  const top = Math.min(...unique.map((origin) => origin.rowIndex));
  const left = Math.min(...unique.map((origin) => origin.colIndex));
  const bottom = Math.max(...unique.map((origin) => origin.rowIndex + origin.rowSpan));
  const right = Math.max(...unique.map((origin) => origin.colIndex + origin.colSpan));
  const rectOrigins = collectOriginsInRect(model, top, left, bottom, right);
  if (!rectOrigins) return false;
  if (!rectOrigins.every((origin) => originIsInsideRect(origin, top, left, bottom, right))) return false;
  if (new Set(rectOrigins.map((origin) => origin.row?.parentElement || null)).size > 1) return false;
  if (requireExactSet && (rectOrigins.length !== unique.length || rectOrigins.some((origin) => !selected.has(origin.cell)))) return false;

  const sorted = sortOriginsByVisualPosition(rectOrigins);
  const anchor = sorted.find((origin) => origin.rowIndex === top && origin.colIndex === left) || sorted[0];
  const anchorCell = anchor.cell;
  sorted.forEach((origin) => {
    if (origin.cell !== anchorCell) appendMergedCellContent(anchorCell, origin.cell);
  });
  sorted.forEach((origin) => {
    if (origin.cell !== anchorCell) origin.cell.remove();
  });

  setCellSpan(anchorCell, "rowspan", bottom - top);
  setCellSpan(anchorCell, "colspan", right - left);
  focusCell(anchorCell);
  window.HTMLWysiwygTools?.markDirty?.();
  return true;
}

function adjacentOriginForMerge(origin, direction, model) {
  if (direction === "down") {
    const candidate = model.grid[origin.rowIndex + origin.rowSpan]?.[origin.colIndex] || null;
    return candidate && candidate.cell !== origin.cell ? candidate : null;
  }
  const candidate = model.grid[origin.rowIndex]?.[origin.colIndex + origin.colSpan] || null;
  return candidate && candidate.cell !== origin.cell ? candidate : null;
}

function firstActualCellAtOrAfter(model, row, minCol) {
  return Array.from(row?.cells || []).find((cell) => {
    const origin = model.origins.get(cell);
    return origin && origin.row === row && origin.colIndex >= minCol;
  }) || null;
}

export function mergeActiveTableCell(direction = "right") {
  const cell = getActiveTableCell();
  const table = cell?.closest("table");
  if (!cell || !table) return false;
  const model = buildTableGrid(table);
  const origin = model.origins.get(cell);
  if (!origin) return false;
  const target = adjacentOriginForMerge(origin, direction, model);
  if (!target) return false;
  return mergeCellOrigins(model, [origin, target], { requireExactSet: true });
}

export function mergeSelectedTableCells() {
  const cell = getActiveTableCell();
  const table = cell?.closest("table");
  if (!cell || !table) return false;
  const model = buildTableGrid(table);
  const selectedOrigins = selectedOriginsInTable(table, model);
  if (selectedOrigins.length > 1) return mergeCellOrigins(model, selectedOrigins, { requireExactSet: true });
  return mergeActiveTableCell("right") || mergeActiveTableCell("down");
}

export function splitCurrentTableCell() {
  const cell = getActiveTableCell();
  const table = cell?.closest("table");
  if (!cell || !table) return false;
  const model = buildTableGrid(table);
  const origin = model.origins.get(cell);
  if (!origin || (origin.rowSpan === 1 && origin.colSpan === 1)) return false;

  setCellSpan(cell, "rowspan", 1);
  setCellSpan(cell, "colspan", 1);

  let insertAfter = cell;
  for (let colOffset = 1; colOffset < origin.colSpan; colOffset += 1) {
    const newCell = makeEmptyCellLike(cell);
    origin.row.insertBefore(newCell, insertAfter.nextSibling);
    insertAfter = newCell;
  }

  for (let rowOffset = 1; rowOffset < origin.rowSpan; rowOffset += 1) {
    const row = model.rows[origin.rowIndex + rowOffset];
    if (!row) continue;
    const refCell = firstActualCellAtOrAfter(model, row, origin.colIndex + origin.colSpan);
    for (let colOffset = 0; colOffset < origin.colSpan; colOffset += 1) {
      row.insertBefore(makeEmptyCellLike(cell), refCell);
    }
  }

  focusCell(cell);
  window.HTMLWysiwygTools?.markDirty?.();
  return true;
}

function cellFromKeyboardEvent(event) {
  const target = event?.target;
  if (target?.closest?.("input, textarea, select, button, a")) return null;
  const eventCell = closestCell(target);
  if (eventCell && isCellInEditor(eventCell)) return setActiveTableCell(eventCell);
  return getActiveTableCell();
}

function adjacentCell(cell, direction) {
  const table = cell?.closest?.("table");
  if (!cell || !table) return null;

  const model = buildTableGrid(table);
  const origin = model.origins.get(cell);
  if (!origin) return null;

  if (direction === "left") {
    for (let colIndex = origin.colIndex - 1; colIndex >= 0; colIndex -= 1) {
      const candidate = model.grid[origin.rowIndex]?.[colIndex] || null;
      if (candidate && candidate.cell !== cell) return candidate.cell;
    }
    return null;
  }
  if (direction === "right") {
    const candidate = model.grid[origin.rowIndex]?.[origin.colIndex + origin.colSpan] || null;
    return candidate?.cell && candidate.cell !== cell ? candidate.cell : null;
  }
  if (direction === "up") {
    const candidate = model.grid[origin.rowIndex - 1]?.[origin.colIndex] || null;
    return candidate?.cell && candidate.cell !== cell ? candidate.cell : null;
  }
  if (direction === "down") {
    const candidate = model.grid[origin.rowIndex + origin.rowSpan]?.[origin.colIndex] || null;
    return candidate?.cell && candidate.cell !== cell ? candidate.cell : null;
  }
  return null;
}

export function moveActiveTableCell(direction, options = {}) {
  const cell = options.cell || getActiveTableCell();
  const target = adjacentCell(cell, direction);
  if (!target) return false;
  return focusTableCell(target, { atEnd: direction === "left" });
}

export function handleTableArrowKeyNavigation(event) {
  const keyToDirection = {
    ArrowLeft: "left",
    ArrowRight: "right",
    ArrowUp: "up",
    ArrowDown: "down",
  };
  const direction = keyToDirection[event?.key];
  if (!direction) return false;
  if (event.defaultPrevented || event.isComposing) return false;
  if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return false;

  const cell = cellFromKeyboardEvent(event);
  if (!cell) return false;
  if (!moveActiveTableCell(direction, { cell })) return false;
  event.preventDefault();
  return true;
}

function copyCellStyle(target, source) {
  if (source?.getAttribute?.("style")) {
    target.setAttribute("style", source.getAttribute("style"));
  } else {
    target.style.border = "1px solid #444";
    target.style.padding = "6px 8px";
  }
  if (source?.isContentEditable || source?.getAttribute?.("contenteditable") === "true") {
    target.contentEditable = "true";
  }
  target.textContent = "";
}

export function insertTableAtCaret(rows = 3, cols = 3) {
  const wysiwyg = getTableEditorRoot();
  if (!wysiwyg) {
    alert("Open an HTML document to insert a table.");
    return false;
  }

  const rowCount = Math.max(1, Number.parseInt(rows, 10) || 3);
  const colCount = Math.max(1, Number.parseInt(cols, 10) || 3);
  const table = document.createElement("table");
  table.style.borderCollapse = "collapse";
  table.style.margin = "8px 0";
  table.style.width = "auto";

  for (let r = 0; r < rowCount; r += 1) {
    const tr = document.createElement("tr");
    for (let c = 0; c < colCount; c += 1) {
      const cell = document.createElement("td");
      copyCellStyle(cell, null);
      tr.appendChild(cell);
    }
    table.appendChild(tr);
  }

  const sel = window.getSelection?.();
  const range = sel?.rangeCount ? sel.getRangeAt(0) : null;
  if (range && wysiwyg.contains(range.commonAncestorContainer)) {
    range.deleteContents();
    range.insertNode(table);
  } else {
    wysiwyg.appendChild(table);
  }

  focusCell(table.querySelector("td, th"));
  window.HTMLWysiwygTools?.markDirty?.();
  return true;
}

export function insertTableRow(direction) {
  const cell = getActiveTableCell();
  const row = cell?.parentElement;
  if (!cell || !row) return false;

  const refIndex = cell.cellIndex;
  const newRow = document.createElement("tr");
  const sourceCells = Array.from(row.cells);
  const columnCount = Math.max(1, sourceCells.length);

  for (let i = 0; i < columnCount; i += 1) {
    const source = sourceCells[i];
    const newCell = document.createElement(source?.tagName || "TD");
    copyCellStyle(newCell, source);
    newRow.appendChild(newCell);
  }

  if (direction === "above") row.before(newRow);
  else row.after(newRow);

  focusCell(newRow.cells[Math.max(0, refIndex)] || newRow.cells[0]);
  window.HTMLWysiwygTools?.markDirty?.();
  return true;
}

export function deleteCurrentTableRow() {
  const cell = getActiveTableCell();
  const row = cell?.parentElement;
  const table = cell?.closest("table");
  if (!cell || !row || !table) return false;

  const rowIndex = row.rowIndex;
  row.remove();
  const nextRow = table.rows[Math.min(rowIndex, table.rows.length - 1)] || null;
  const nextCell = nextRow?.cells[Math.min(cell.cellIndex, Math.max(0, nextRow.cells.length - 1))] || null;
  if (nextCell) focusCell(nextCell);
  else {
    setActiveTableCell(null);
    updateToolbarState({ htmlTableSelected: false });
  }
  window.HTMLWysiwygTools?.markDirty?.();
  return true;
}

export function deleteCurrentTableColumn() {
  const cell = getActiveTableCell();
  const table = cell?.closest("table");
  if (!cell || !table) return false;

  const colIndex = cell.cellIndex;
  let nextCell = null;
  for (const row of Array.from(table.rows)) {
    const removed = row.cells[colIndex];
    if (!removed) continue;
    const candidate = row === cell.parentElement
      ? row.cells[colIndex + 1] || row.cells[colIndex - 1] || null
      : null;
    removed.remove();
    if (candidate && candidate.isConnected) nextCell = candidate;
    if (!nextCell && row === cell.parentElement) {
      nextCell = row.cells[Math.min(colIndex, Math.max(0, row.cells.length - 1))] || null;
    }
  }
  if (nextCell) focusCell(nextCell);
  else {
    setActiveTableCell(null);
    updateToolbarState({ htmlTableSelected: false });
  }
  window.HTMLWysiwygTools?.markDirty?.();
  return true;
}

export function insertTableColumn(direction) {
  const cell = getActiveTableCell();
  const table = cell?.closest("table");
  if (!cell || !table) return false;

  const colIndex = cell.cellIndex;
  for (const row of table.rows) {
    const refCell = row.cells[colIndex] || row.cells[row.cells.length - 1] || null;
    const newCell = document.createElement(refCell?.tagName || "TD");
    copyCellStyle(newCell, refCell);
    if (direction === "left") row.insertBefore(newCell, refCell);
    else row.insertBefore(newCell, refCell?.nextSibling || null);
    if (row === cell.parentElement) setActiveTableCell(newCell);
  }

  focusCell(getActiveTableCell());
  window.HTMLWysiwygTools?.markDirty?.();
  return true;
}
