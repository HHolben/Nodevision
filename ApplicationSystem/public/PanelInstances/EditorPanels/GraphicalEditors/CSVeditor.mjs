// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/CSVeditor.mjs
// This file defines browser-side CSVeditor logic for the Nodevision UI. It renders interface components and handles user interactions.
// CSVeditor.mjs
import { updateToolbarState } from "/panels/createToolbar.mjs";
import {
  clearTableCellSelection,
  getSelectedTableCells,
  selectTableCellRange,
  setActiveTableCell,
  setSelectedTableCells,
} from "/ToolbarCallbacks/insert/tableTools.mjs";
import {
  cloneCsvRows,
  csvRenderDimensions,
  declaredColumnCount,
  deleteCsvColumn,
  deleteCsvRow,
  insertCsvColumn,
  insertCsvRow,
  isDeclaredCsvCell,
  normalizeSpreadsheetDelimiter,
  parseDelimitedText,
  serializeDelimitedRows,
  setCsvCellValue,
  spreadsheetDelimiterForPath,
} from "./CSVGridModel.mjs";

const CSV_TABLE_SELECTION_EDGE_PX = 14;
const CSV_TABLE_SELECTION_DRAG_THRESHOLD_PX = 4;

function ensureCsvTableSelectionStyles() {
  if (document.getElementById("nv-csv-table-selection-style")) return;
  const style = document.createElement("style");
  style.id = "nv-csv-table-selection-style";
  style.textContent = `
    .nv-csv-table-wrap.nv-table-cell-selecting,
    .nv-csv-table-wrap.nv-table-column-selecting,
    .nv-csv-table-wrap.nv-table-row-selecting {
      user-select: none;
    }
    .nv-csv-table-wrap.nv-table-cell-selecting { cursor: crosshair; }
    .nv-csv-table-wrap.nv-table-column-selecting { cursor: col-resize; }
    .nv-csv-table-wrap.nv-table-row-selecting { cursor: row-resize; }
    .nv-csv-table-wrap td.nv-html-table-selected-cell,
    .nv-csv-table-wrap th.nv-html-table-selected-cell {
      background-color: rgba(47, 128, 255, 0.16);
      box-shadow: inset 0 0 0 2px rgba(47, 128, 255, 0.42);
      position: relative;
    }
    .nv-csv-table-wrap td.nv-html-table-selection-anchor,
    .nv-csv-table-wrap th.nv-html-table-selection-anchor {
      box-shadow: inset 0 0 0 2px rgba(20, 86, 179, 0.72);
    }
    .nv-csv-table-wrap td.nv-html-table-selection-focus,
    .nv-csv-table-wrap th.nv-html-table-selection-focus {
      outline: 2px solid rgba(18, 101, 220, 0.82);
      outline-offset: -2px;
    }
    .nv-csv-table-wrap td.nv-csv-virtual-cell,
    .nv-csv-table-wrap th.nv-csv-virtual-cell {
      border-color: #d7dce3 !important;
      outline: 1px dashed #c7ced8;
      outline-offset: -3px;
      background-image: linear-gradient(135deg, rgba(148, 163, 184, 0.07), rgba(255, 255, 255, 0));
    }
  `;
  document.head.appendChild(style);
}

function findCsvTableCellFromNode(tableWrapper, node) {
  const el = node?.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  const cell = el?.closest?.("td, th") || null;
  return cell && tableWrapper?.contains?.(cell) ? cell : null;
}

function tableDragSelectionClassForMode(mode) {
  if (mode === "columns") return "nv-table-column-selecting";
  if (mode === "rows") return "nv-table-row-selecting";
  return "nv-table-cell-selecting";
}

function clearCsvTableDragSelectionClass(tableWrapper) {
  tableWrapper?.classList?.remove?.(
    "nv-table-cell-selecting",
    "nv-table-column-selecting",
    "nv-table-row-selecting"
  );
}

function resolveCsvTableDragSelectionMode(table, cell, event) {
  const row = cell?.parentElement || null;
  if (!table || !cell || !row || !event) return "cells";

  const firstRow = table.rows?.[0] || null;
  const firstCellInRow = row.cells?.[0] || null;
  const cellRect = cell.getBoundingClientRect?.();
  const firstCellRect = firstCellInRow?.getBoundingClientRect?.();

  const inFirstColumnEdge = cell === firstCellInRow &&
    firstCellRect &&
    event.clientX >= firstCellRect.left &&
    event.clientX - firstCellRect.left <= CSV_TABLE_SELECTION_EDGE_PX;
  if (inFirstColumnEdge) return "rows";

  const inFirstRowEdge = row === firstRow &&
    cellRect &&
    event.clientY >= cellRect.top &&
    event.clientY - cellRect.top <= CSV_TABLE_SELECTION_EDGE_PX;
  if (inFirstRowEdge) return "columns";

  return "cells";
}

function getCsvTableCellAtPoint(tableWrapper, table, clientX, clientY) {
  if (!tableWrapper || !table) return null;
  const elementAtPoint = document.elementFromPoint?.(clientX, clientY) || null;
  const pointedCell = findCsvTableCellFromNode(tableWrapper, elementAtPoint);
  if (pointedCell?.closest?.("table") === table) return pointedCell;

  const tableRect = table.getBoundingClientRect?.();
  if (!tableRect || clientX < tableRect.left || clientX > tableRect.right || clientY < tableRect.top || clientY > tableRect.bottom) {
    return null;
  }

  let nearest = null;
  let nearestDistance = Number.POSITIVE_INFINITY;
  for (const cell of Array.from(table.querySelectorAll("td, th"))) {
    const rect = cell.getBoundingClientRect?.();
    if (!rect) continue;
    const x = Math.max(rect.left, Math.min(clientX, rect.right));
    const y = Math.max(rect.top, Math.min(clientY, rect.bottom));
    const distance = Math.hypot(clientX - x, clientY - y);
    if (distance < nearestDistance) {
      nearest = cell;
      nearestDistance = distance;
    }
  }
  return nearest;
}

function selectedCellsToDelimitedText(table, selectedCells, delimiter = "\t") {
  const positions = Array.from(selectedCells || [])
    .filter((cell) => cell?.closest?.("table") === table)
    .map((cell) => ({
      cell,
      rowIndex: cell.parentElement?.rowIndex ?? -1,
      colIndex: cell.cellIndex ?? -1,
    }))
    .filter(({ rowIndex, colIndex }) => rowIndex >= 0 && colIndex >= 0);
  if (!positions.length) return null;

  const selectedSet = new Set(positions.map(({ cell }) => cell));
  const minRow = Math.min(...positions.map(({ rowIndex }) => rowIndex));
  const maxRow = Math.max(...positions.map(({ rowIndex }) => rowIndex));
  const minCol = Math.min(...positions.map(({ colIndex }) => colIndex));
  const maxCol = Math.max(...positions.map(({ colIndex }) => colIndex));
  const rows = [];

  for (let rowIndex = minRow; rowIndex <= maxRow; rowIndex += 1) {
    const tableRow = table.rows?.[rowIndex] || null;
    const row = [];
    for (let colIndex = minCol; colIndex <= maxCol; colIndex += 1) {
      const cell = tableRow?.cells?.[colIndex] || null;
      row.push(cell && selectedSet.has(cell) ? cell.textContent || "" : "");
    }
    rows.push(row);
  }

  return serializeDelimitedRows(rows, delimiter);
}

function writeCsvClipboardData(event, plainText, delimitedText, delimiter) {
  if (event?.clipboardData) {
    event.preventDefault();
    event.clipboardData.setData("text/plain", plainText);
    event.clipboardData.setData("text/tab-separated-values", plainText);
    if (delimiter !== "\t") event.clipboardData.setData("text/csv", delimitedText);
    return true;
  }

  const clipboard = typeof navigator !== "undefined" ? navigator.clipboard : null;
  if (clipboard?.writeText) {
    event?.preventDefault?.();
    clipboard.writeText(plainText).catch((err) => console.warn("Failed to copy CSV selection:", err));
    return true;
  }

  return false;
}

function copyCsvTableSelection(event, table, delimiter = ",", cells = null) {
  const selectedCells = Array.isArray(cells) ? cells : getSelectedTableCells(table);
  if (!selectedCells.length) return false;

  const plainText = selectedCellsToDelimitedText(table, selectedCells, "\t");
  if (plainText === null) return false;

  const delimitedText = selectedCellsToDelimitedText(table, selectedCells, delimiter) ?? plainText;
  return writeCsvClipboardData(event, plainText, delimitedText, normalizeSpreadsheetDelimiter(delimiter));
}

function registerCsvTableDragSelection(tableWrapper, table) {
  if (!tableWrapper || !table) return () => {};

  let dragState = null;

  const removeWindowListeners = () => {
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerEnd);
    window.removeEventListener("pointercancel", onPointerEnd);
  };

  const beginSelection = (event) => {
    if (!dragState || dragState.selecting) return;
    dragState.selecting = true;
    dragState.previousBodyUserSelect = document.body.style.userSelect;
    document.body.style.userSelect = "none";
    window.__nvCsvTableDragSelecting = true;
    clearCsvTableDragSelectionClass(tableWrapper);
    tableWrapper.classList.add(tableDragSelectionClassForMode(dragState.mode));
    window.getSelection?.()?.removeAllRanges?.();
    selectTableCellRange(dragState.anchorCell, dragState.lastCell, {
      activeCell: dragState.lastCell,
      mode: dragState.mode,
    });
    event.preventDefault();
    event.stopPropagation();
  };

  const updateSelection = (event) => {
    if (!dragState) return;
    const nextCell = getCsvTableCellAtPoint(tableWrapper, dragState.table, event.clientX, event.clientY);
    if (nextCell) dragState.lastCell = nextCell;
    selectTableCellRange(dragState.anchorCell, dragState.lastCell, {
      activeCell: dragState.lastCell,
      mode: dragState.mode,
    });
  };

  function onPointerMove(event) {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    const nextCell = getCsvTableCellAtPoint(tableWrapper, dragState.table, event.clientX, event.clientY);
    if (nextCell) dragState.lastCell = nextCell;

    const dx = event.clientX - dragState.startX;
    const dy = event.clientY - dragState.startY;
    if (!dragState.selecting) {
      if (Math.hypot(dx, dy) < CSV_TABLE_SELECTION_DRAG_THRESHOLD_PX) return;
      if (dragState.mode === "cells" && dragState.lastCell === dragState.anchorCell) return;
      beginSelection(event);
    }
    updateSelection(event);
    event.preventDefault();
    event.stopPropagation();
  }

  function onPointerEnd(event) {
    if (!dragState || event.pointerId !== dragState.pointerId) return;
    const wasSelecting = dragState.selecting;
    const previousBodyUserSelect = dragState.previousBodyUserSelect;
    dragState = null;
    removeWindowListeners();
    clearCsvTableDragSelectionClass(tableWrapper);
    window.__nvCsvTableDragSelecting = false;
    if (previousBodyUserSelect !== undefined) document.body.style.userSelect = previousBodyUserSelect;
    if (wasSelecting) {
      tableWrapper.__nvSuppressNextTableClickSelection = true;
      window.setTimeout(() => {
        if (tableWrapper.__nvSuppressNextTableClickSelection) tableWrapper.__nvSuppressNextTableClickSelection = false;
      }, 0);
      event.preventDefault();
      event.stopPropagation();
    }
  }

  const onPointerDown = (event) => {
    if (event.button !== 0 || event.defaultPrevented) return;
    if (event.target?.closest?.("button, input, textarea, select, a")) return;

    const anchorCell = findCsvTableCellFromNode(tableWrapper, event.target);
    if (!anchorCell || anchorCell.closest?.("table") !== table) {
      clearTableCellSelection({ keepActive: false });
      return;
    }

    dragState = {
      anchorCell,
      lastCell: anchorCell,
      mode: resolveCsvTableDragSelectionMode(table, anchorCell, event),
      pointerId: event.pointerId,
      previousBodyUserSelect: undefined,
      selecting: false,
      startX: event.clientX,
      startY: event.clientY,
      table,
    };
    try {
      anchorCell.focus?.({ preventScroll: true });
    } catch {
      anchorCell.focus?.();
    }
    setActiveTableCell(anchorCell);
    updateToolbarState({ htmlTableSelected: true });
    removeWindowListeners();
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerEnd);
    window.addEventListener("pointercancel", onPointerEnd);
  };

  tableWrapper.addEventListener("pointerdown", onPointerDown);

  return () => {
    removeWindowListeners();
    clearCsvTableDragSelectionClass(tableWrapper);
    clearTableCellSelection({ keepActive: false });
    window.__nvCsvTableDragSelecting = false;
    dragState = null;
    tableWrapper.removeEventListener("pointerdown", onPointerDown);
  };
}

export async function renderEditor(filePath, container) {
  if (!container) throw new Error("Container required");
  if (typeof container.__cleanupCSVTableToolbar === "function") {
    container.__cleanupCSVTableToolbar();
    container.__cleanupCSVTableToolbar = null;
  }
  if (typeof container.__cleanupCSVTableDragSelection === "function") {
    container.__cleanupCSVTableDragSelection();
    container.__cleanupCSVTableDragSelection = null;
  }
  container.innerHTML = "";
  updateToolbarState({ currentMode: "CSVediting", htmlTableSelected: false });
  ensureCsvTableSelectionStyles();

  const wrapper = document.createElement("div");
  wrapper.id = "editor-root";
  wrapper.style.display = "flex";
  wrapper.style.flexDirection = "column";
  wrapper.style.height = "100%";
  wrapper.style.width = "100%";
  wrapper.style.overflow = "auto";
  container.appendChild(wrapper);

  const tableWrapper = document.createElement("div");
  tableWrapper.className = "nv-csv-table-wrap";
  tableWrapper.style.flex = "1";
  tableWrapper.style.overflow = "auto";
  wrapper.appendChild(tableWrapper);

  const table = document.createElement("table");
  table.style.borderCollapse = "collapse";
  table.style.width = "100%";
  table.style.tableLayout = "fixed";
  tableWrapper.appendChild(table);
  window.__nvTableEditorRoot = tableWrapper;

  const activeDelimiter = spreadsheetDelimiterForPath(filePath);
  let csvRows = [[""]];
  let activePosition = { row: 0, col: 0 };
  let renderedRowCount = 0;
  let renderedColCount = 0;
  let lastPublishedTableSelected = null;

  tableWrapper.setAttribute("data-nv-table-editor-root", "true");

  function publishToolbarSelection(selected) {
    const next = Boolean(selected);
    if (lastPublishedTableSelected === next) return;
    lastPublishedTableSelected = next;
    updateToolbarState({ htmlTableSelected: next });
  }

  function cellPosition(cell) {
    return {
      row: Number.parseInt(cell?.dataset?.row || "0", 10) || 0,
      col: Number.parseInt(cell?.dataset?.col || "0", 10) || 0,
    };
  }

  const findTableCellFromNode = (node) => findCsvTableCellFromNode(tableWrapper, node);
  const publishTableSelection = (cell) => {
    const activeCell = cell && tableWrapper.contains(cell) ? cell : null;
    if (activeCell) {
      activePosition = cellPosition(activeCell);
      setSelectedTableCells([activeCell], { activeCell, anchorCell: activeCell, mode: "cells" });
      activeCell.dataset.nvCsvSelectedOnly = "true";
    } else {
      clearTableCellSelection({ keepActive: false });
    }
    setActiveTableCell(activeCell);
    publishToolbarSelection(Boolean(activeCell));
  };
  const clearCsvTableSelection = (options = {}) => {
    clearTableCellSelection(options);
    if (options.keepActive === false) publishToolbarSelection(false);
  };
  const updateTableSelectionFromSelection = () => {
    if (window.__nvCsvTableDragSelecting) return;
    const selection = window.getSelection?.();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    if (!range || !tableWrapper.contains(range.commonAncestorContainer)) return;
    const cell = findTableCellFromNode(range.startContainer);
    if (cell) publishTableSelection(cell);
  };
  const updateTableSelectionFromEvent = (event) => {
    if (tableWrapper.__nvSuppressNextTableClickSelection) {
      tableWrapper.__nvSuppressNextTableClickSelection = false;
      return;
    }
    const cell = findTableCellFromNode(event.target);
    if (!cell) {
      clearCsvTableSelection({ keepActive: false });
      publishTableSelection(null);
      return;
    }
    publishTableSelection(cell);
  };

  function declaredCellClass(cell, declared) {
    cell.dataset.declared = declared ? "true" : "false";
    cell.classList.toggle("nv-csv-virtual-cell", !declared);
  }

  function refreshCellDeclarationState() {
    for (const cell of Array.from(table.querySelectorAll("td, th"))) {
      const position = cellPosition(cell);
      declaredCellClass(cell, isDeclaredCsvCell(csvRows, position.row, position.col));
    }
  }

  function createCell(rowIndex, colIndex) {
    const declared = isDeclaredCsvCell(csvRows, rowIndex, colIndex);
    const td = document.createElement(rowIndex === 0 ? "th" : "td");
    td.contentEditable = "true";
    td.dataset.row = String(rowIndex);
    td.dataset.col = String(colIndex);
    td.style.border = "1px solid #aeb7c2";
    td.style.padding = "4px";
    td.style.minWidth = "80px";
    td.style.outlineOffset = "-2px";
    td.textContent = declared ? csvRows[rowIndex][colIndex] : "";
    declaredCellClass(td, declared);
    return td;
  }

  function renderRows(rows = csvRows, options = {}) {
    if (options.preserveSelection !== true) clearCsvTableSelection({ keepActive: false });
    csvRows = cloneCsvRows(rows);
    const dims = csvRenderDimensions(csvRows, activePosition, 1);
    renderedRowCount = dims.rows;
    renderedColCount = dims.cols;
    table.innerHTML = "";
    for (let rowIndex = 0; rowIndex < renderedRowCount; rowIndex += 1) {
      const tr = document.createElement("tr");
      for (let colIndex = 0; colIndex < renderedColCount; colIndex += 1) {
        tr.appendChild(createCell(rowIndex, colIndex));
      }
      table.appendChild(tr);
    }
  }

  function ensureRenderedForPosition(rowIndex, colIndex) {
    const dims = csvRenderDimensions(csvRows, { row: rowIndex, col: colIndex }, 1);
    if (dims.rows === renderedRowCount && dims.cols === renderedColCount) return false;
    renderRows(csvRows, { preserveSelection: true });
    return true;
  }

  function getCellAt(rowIndex, colIndex) {
    return table.querySelector(`[data-row="${rowIndex}"][data-col="${colIndex}"]`);
  }

  function focusCsvCell(rowIndex, colIndex, options = {}) {
    const row = Math.max(0, Number.parseInt(rowIndex, 10) || 0);
    const col = Math.max(0, Number.parseInt(colIndex, 10) || 0);
    activePosition = { row, col };
    ensureRenderedForPosition(row, col);
    const cell = getCellAt(row, col);
    if (!cell) return false;
    try {
      cell.focus?.({ preventScroll: true });
    } catch {
      cell.focus?.();
    }
    if (options.selectText) {
      const selection = window.getSelection?.();
      const range = document.createRange?.();
      if (selection && range) {
        range.selectNodeContents(cell);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
    cell.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    publishTableSelection(cell);
    return true;
  }

  function caretOffsetInCell(cell) {
    const selection = window.getSelection?.();
    if (!selection || !selection.rangeCount) return null;
    const range = selection.getRangeAt(0);
    if (!selection.isCollapsed || !cell.contains(range.startContainer)) return null;
    const before = range.cloneRange();
    before.selectNodeContents(cell);
    before.setEnd(range.startContainer, range.startOffset);
    return before.toString().length;
  }

  function shouldNavigateFromCell(event, cell) {
    if (cell?.dataset?.nvCsvSelectedOnly === "true") return true;
    if (event.key === "ArrowUp" || event.key === "ArrowDown" || event.key === "Enter" || event.key === "Tab") return true;
    const offset = caretOffsetInCell(cell);
    if (offset === null) return true;
    const textLength = (cell.textContent || "").length;
    if (event.key === "ArrowLeft") return offset <= 0;
    if (event.key === "ArrowRight") return offset >= textLength;
    return false;
  }

  function moveCsvCell(direction, options = {}) {
    const sourceCell = options.cell || findTableCellFromNode(document.activeElement) || getCellAt(activePosition.row, activePosition.col);
    const source = sourceCell ? cellPosition(sourceCell) : activePosition;
    const delta = {
      left: [0, -1],
      right: [0, 1],
      up: [-1, 0],
      down: [1, 0],
    }[direction];
    if (!delta) return false;
    return focusCsvCell(Math.max(0, source.row + delta[0]), Math.max(0, source.col + delta[1]));
  }

  const handleCsvTableKeyNavigation = (event) => {
    const keyToDirection = {
      ArrowLeft: "left",
      ArrowRight: "right",
      ArrowUp: "up",
      ArrowDown: "down",
      Enter: "down",
      Tab: "right",
    };
    const direction = keyToDirection[event?.key];
    if (!direction) return false;
    if (event.defaultPrevented || event.isComposing) return false;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return false;
    const cell = findTableCellFromNode(event.target) || getCellAt(activePosition.row, activePosition.col);
    if (!cell || !shouldNavigateFromCell(event, cell)) return false;
    if (!moveCsvCell(direction, { cell })) return false;
    event.preventDefault();
    return true;
  };
  const markCsvDirty = () => {
    if (window.NodevisionState) window.NodevisionState.fileIsDirty = true;
    updateToolbarState({ currentMode: "CSVediting", fileIsDirty: true });
  };
  const handleCsvCellInput = (event) => {
    const cell = findTableCellFromNode(event.target);
    if (!cell) return;
    delete cell.dataset.nvCsvSelectedOnly;
    const { row, col } = cellPosition(cell);
    activePosition = { row, col };
    csvRows = setCsvCellValue(csvRows, row, col, cell.textContent || "");
    refreshCellDeclarationState();
    markCsvDirty();
  };
  const handleCsvTableCopy = (event) => {
    const rawTarget = event?.target?.nodeType === Node.TEXT_NODE ? event.target.parentElement : event?.target;
    const eventNode = rawTarget instanceof Node ? rawTarget : null;
    const activeElement = document.activeElement;
    const activeCell = window.__nvHtmlTableActiveCell;
    const selection = window.getSelection?.();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    const eventInEditor = eventNode ? tableWrapper.contains(eventNode) : false;
    const focusInEditor = activeElement ? tableWrapper.contains(activeElement) : false;
    const activeInEditor = activeCell ? tableWrapper.contains(activeCell) : false;
    const selectionInEditor = range ? tableWrapper.contains(range.commonAncestorContainer) : false;
    const hasTextSelectionInEditor = selectionInEditor && selection && !selection.isCollapsed;
    if (hasTextSelectionInEditor) return false;
    if (!eventInEditor && !focusInEditor && !activeInEditor && !selectionInEditor) return false;

    let selectedCells = getSelectedTableCells(table);
    if (!selectedCells.length && !hasTextSelectionInEditor && activeInEditor) selectedCells = [activeCell];
    if (!selectedCells.length) return false;

    return copyCsvTableSelection(event, table, activeDelimiter, selectedCells);
  };

  function syncActivePositionFromDom() {
    const activeCell = window.__nvHtmlTableActiveCell;
    if (activeCell && tableWrapper.contains(activeCell)) {
      activePosition = cellPosition(activeCell);
    }
    return activePosition;
  }

  function logicalGridWidth() {
    syncActivePositionFromDom();
    return Math.max(declaredColumnCount(csvRows), activePosition.col + 1, 1);
  }

  function structuralEdit(nextRows, nextPosition) {
    csvRows = cloneCsvRows(nextRows);
    activePosition = {
      row: Math.max(0, nextPosition?.row ?? activePosition.row),
      col: Math.max(0, nextPosition?.col ?? activePosition.col),
    };
    renderRows(csvRows, { preserveSelection: true });
    focusCsvCell(activePosition.row, activePosition.col);
    markCsvDirty();
    return true;
  }

  const csvTableContext = {
    isActive() {
      return Boolean(tableWrapper.isConnected && window.__nvCsvTableContext === csvTableContext);
    },
    getEditorRoot() {
      return tableWrapper;
    },
    moveActiveCell(direction, options = {}) {
      return moveCsvCell(direction, options);
    },
    insertRow(direction = "below") {
      syncActivePositionFromDom();
      const insertAt = activePosition.row + (direction === "below" ? 1 : 0);
      return structuralEdit(insertCsvRow(csvRows, insertAt, logicalGridWidth()), { row: insertAt, col: activePosition.col });
    },
    deleteRow() {
      syncActivePositionFromDom();
      const nextRows = deleteCsvRow(csvRows, activePosition.row);
      return structuralEdit(nextRows, { row: Math.min(activePosition.row, nextRows.length - 1), col: activePosition.col });
    },
    insertColumn(direction = "right") {
      syncActivePositionFromDom();
      const insertAt = activePosition.col + (direction === "right" ? 1 : 0);
      return structuralEdit(insertCsvColumn(csvRows, insertAt), { row: activePosition.row, col: insertAt });
    },
    deleteColumn() {
      syncActivePositionFromDom();
      const nextRows = deleteCsvColumn(csvRows, activePosition.col);
      return structuralEdit(nextRows, { row: activePosition.row, col: Math.min(activePosition.col, declaredColumnCount(nextRows) - 1) });
    },
    getRows() {
      return cloneCsvRows(csvRows);
    },
    getActivePosition() {
      return { ...activePosition };
    },
  };

  table.addEventListener("pointerdown", updateTableSelectionFromEvent);
  table.addEventListener("click", updateTableSelectionFromEvent);
  table.addEventListener("keyup", updateTableSelectionFromSelection);
  table.addEventListener("focusin", updateTableSelectionFromSelection);
  table.addEventListener("keydown", handleCsvTableKeyNavigation);
  table.addEventListener("input", handleCsvCellInput);
  document.addEventListener("selectionchange", updateTableSelectionFromSelection);
  document.addEventListener("copy", handleCsvTableCopy);
  window.__nvCsvTableContext = csvTableContext;
  window.__nvActiveGridTableContext = csvTableContext;
  container.__cleanupCSVTableDragSelection = registerCsvTableDragSelection(tableWrapper, table);
  container.__cleanupCSVTableToolbar = () => {
    table.removeEventListener("pointerdown", updateTableSelectionFromEvent);
    table.removeEventListener("click", updateTableSelectionFromEvent);
    table.removeEventListener("keyup", updateTableSelectionFromSelection);
    table.removeEventListener("focusin", updateTableSelectionFromSelection);
    table.removeEventListener("keydown", handleCsvTableKeyNavigation);
    table.removeEventListener("input", handleCsvCellInput);
    document.removeEventListener("selectionchange", updateTableSelectionFromSelection);
    document.removeEventListener("copy", handleCsvTableCopy);
    if (typeof container.__cleanupCSVTableDragSelection === "function") {
      container.__cleanupCSVTableDragSelection();
      container.__cleanupCSVTableDragSelection = null;
    }
    if (window.__nvTableEditorRoot === tableWrapper) window.__nvTableEditorRoot = null;
    if (window.__nvCsvEditor?.table === table) window.__nvCsvEditor = null;
    if (window.__nvCsvTableContext === csvTableContext) window.__nvCsvTableContext = null;
    if (window.__nvActiveGridTableContext === csvTableContext) window.__nvActiveGridTableContext = null;
    if (window.__nvHtmlTableActiveCell && tableWrapper.contains(window.__nvHtmlTableActiveCell)) {
      window.__nvHtmlTableActiveCell = null;
      window.__nvHtmlTableActiveTable = null;
    }
    lastPublishedTableSelected = false;
    updateToolbarState({ htmlTableSelected: false });
  };

  function getRows() {
    return cloneCsvRows(csvRows);
  }

  function setSpreadsheetText(text, options = {}) {
    const delimiter = normalizeSpreadsheetDelimiter(options.delimiter || activeDelimiter);
    const rows = parseDelimitedText(text, delimiter);
    activePosition = { row: 0, col: 0 };
    renderRows(rows);
    focusCsvCell(0, 0);
    if (options.markDirty !== false) markCsvDirty();
    return rows;
  }

  // Load CSV data
  try {
    const res = await fetch(`/Notebook/${filePath}`);
    if (!res.ok) throw new Error(res.statusText);
    const csvText = await res.text();
    renderRows(parseDelimitedText(csvText, activeDelimiter));

    // Expose API for saving CSV
    window.getEditorHTML = () => {
      return serializeDelimitedRows(getRows(), activeDelimiter);
    };

    window.setEditorHTML = (csv, options = {}) => {
      return setSpreadsheetText(csv, options);
    };

    window.__nvCsvEditor = {
      filePath,
      delimiter: activeDelimiter,
      table,
      getRows,
      setRows: (rows, options = {}) => {
        renderRows(rows);
        if (options.markDirty !== false) markCsvDirty();
      },
      importText: (text, options = {}) => setSpreadsheetText(text, options),
      copySelection: (event = null) => copyCsvTableSelection(event, table, activeDelimiter),
      parseDelimitedText,
      serializeDelimitedRows,
    };

    window.saveWYSIWYGFile = async (path) => {
      const content = window.getEditorHTML();
      await fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: path || filePath, sourcePath: filePath, content }),
      });
      if (window.NodevisionState) window.NodevisionState.fileIsDirty = false;
      updateToolbarState({ fileIsDirty: false });
      console.log("Saved CSV file:", path || filePath);
    };

  } catch (err) {
    wrapper.innerHTML = `<div style="color:red;padding:12px">Failed to load file: ${err.message}</div>`;
    console.error(err);
  }
}
