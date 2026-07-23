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

function cellFromKeyboardEvent(event) {
  const target = event?.target;
  if (target?.closest?.("input, textarea, select, button, a")) return null;
  const eventCell = closestCell(target);
  if (eventCell && isCellInEditor(eventCell)) return setActiveTableCell(eventCell);
  return getActiveTableCell();
}

function adjacentCell(cell, direction) {
  const table = cell?.closest?.("table");
  const row = cell?.parentElement;
  if (!table || !row) return null;

  const rows = Array.from(table.rows || []);
  const rowIndex = rows.indexOf(row);
  const colIndex = cell.cellIndex;
  if (rowIndex < 0 || colIndex < 0) return null;

  if (direction === "left") return row.cells[colIndex - 1] || null;
  if (direction === "right") return row.cells[colIndex + 1] || null;

  const targetRow = rows[rowIndex + (direction === "up" ? -1 : 1)] || null;
  if (!targetRow) return null;
  return targetRow.cells[Math.min(colIndex, Math.max(0, targetRow.cells.length - 1))] || null;
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
