// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/CSVeditor.mjs
// This module integrates the CSV model, coordinate selection, range gestures, shared table toolbar adapter, and document history for the graphical spreadsheet editor.
import { setEditorContext, setSelectionContext, clearEditorContext } from "/EditorAttentionState.mjs";
import { updateToolbarState } from "/panels/createToolbar.mjs";
import { setActiveTableCell } from "/ToolbarCallbacks/insert/tableTools.mjs";
import { cloneCsvRows, declaredColumnCount, deleteCsvColumn, deleteCsvRow, insertCsvColumn, insertCsvRow,
  parseDelimitedText, serializeDelimitedRows, setCsvCellValue, spreadsheetDelimiterForPath } from "./CSVGridModel.mjs";
import { csvRange, copyCsvRange, clearCsvRange, moveCsvRange, parseCsvClipboard, writeCsvBlock } from "./CSVRangeModel.mjs";
import { createCsvGridView } from "./CSVGridView.mjs";
import { bindCsvRangeInteraction } from "./CSVRangeInteraction.mjs";
import { createWysiwygProgrammaticHistory } from "./HTMLeditorComponents/WysiwygProgrammaticHistory.mjs";

export async function renderEditor(filePath, container) {
  if (!container) throw new Error("Container required");
  container.__cleanupCSVTableToolbar?.();
  container.innerHTML = "";
  updateToolbarState({ currentMode: "CSVediting", htmlTableSelected: false });
  const wrapper = document.createElement("div");
  wrapper.id = "editor-root";
  wrapper.style.cssText = "display:flex;flex-direction:column;height:100%;width:100%;overflow:hidden";
  const tableWrapper = document.createElement("div"), table = document.createElement("table");
  tableWrapper.setAttribute("data-nv-table-editor-root", "true");
  tableWrapper.title = "Drag to select; Shift-click to extend; drag selected cells (or a single cell edge) to move; double-click or F2 to edit.";
  tableWrapper.appendChild(table); wrapper.appendChild(tableWrapper); container.appendChild(wrapper);
  const view = createCsvGridView(tableWrapper, table);
  const activeDelimiter = spreadsheetDelimiterForPath(filePath);
  let csvRows = [[""]], anchor = { row: 0, col: 0 }, activePosition = { ...anchor }, disposed = false;
  let lastPublishedTableSelected = false, lastAttentionSelection = null;
  let interaction = null;
  setEditorContext({ filePath, fileFamily: "csv", fileFamilyLabel: "Spreadsheet", editorMode: "CSVediting", editorModeLabel: "CSV Editing" });
  const getSelection = () => ({ anchor: { ...anchor }, active: { ...activePosition }, range: csvRange(anchor, activePosition) });
  const snapshot = () => JSON.stringify({ rows: csvRows, anchor, active: activePosition });
  const markCsvDirty = () => {
    if (window.NodevisionState) window.NodevisionState.fileIsDirty = true;
    updateToolbarState({ currentMode: "CSVediting", fileIsDirty: true });
  };
  function publish({ focus = true } = {}) {
    const cell = view.cellAt(activePosition.row, activePosition.col);
    setActiveTableCell(cell);
    const range = csvRange(anchor, activePosition), selectionKey = JSON.stringify(getSelection());
    if (selectionKey !== lastAttentionSelection) {
      lastAttentionSelection = selectionKey;
      setSelectionContext({ selectedObjectType: "csv-range", selectedObjectId: `R${range.top + 1}C${range.left + 1}:R${range.bottom + 1}C${range.right + 1}`,
        selectedObjectLabel: "CSV Cell Range", hasSelection: true, hasEditableSelection: true });
    }
    if (!lastPublishedTableSelected) { lastPublishedTableSelected = true; updateToolbarState({ htmlTableSelected: true }); }
    if (focus) cell?.focus({ preventScroll: true });
    view.paint(csvRange(anchor, activePosition));
    interaction?.selectionChanged();
  }
  function render() {
    view.render(csvRows, { row: Math.max(anchor.row, activePosition.row), col: Math.max(anchor.col, activePosition.col) });
    view.paint(csvRange(anchor, activePosition));
    interaction?.invalidate();
    interaction?.selectionChanged();
  }
  function select(point, extend = false, notify = true) {
    activePosition = { row: Math.max(0, point.row), col: Math.max(0, point.col) };
    if (!extend) anchor = { ...activePosition };
    if (notify && !view.cellAt(activePosition.row + 1, activePosition.col + 1)) render();
    view.paint(csvRange(anchor, activePosition));
    interaction?.selectionChanged();
    if (notify) publish();
  }
  const history = createWysiwygProgrammaticHistory(tableWrapper, {
    readSnapshot: snapshot,
    writeSnapshot(value) {
      const state = JSON.parse(value); csvRows = state.rows; anchor = state.anchor; activePosition = state.active;
      render(); publish(); markCsvDirty();
    },
  });
  tableWrapper.__nvProgrammaticHistory = history;
  function commit(rows, origin = activePosition, end = origin) {
    if (JSON.stringify(rows) === JSON.stringify(csvRows)) { anchor = { ...origin }; select(end, true); return false; }
    const before = snapshot(); csvRows = cloneCsvRows(rows); anchor = { ...origin }; activePosition = { ...end };
    render(); publish(); history.record(before); markCsvDirty(); return true;
  }
  const editor = {
    getSelection, publish, history, select,
    navigate(delta, extend = false) { select({ row: activePosition.row + delta[0], col: activePosition.col + delta[1] }, extend); view.cellAt(activePosition.row, activePosition.col)?.scrollIntoView?.({ block: "nearest", inline: "nearest" }); },
    input({ row, col }, value) {
      const before = snapshot(); csvRows = setCsvCellValue(csvRows, row, col, value);
      for (let c = 0; c <= col; c++) {
        const cell = view.cellAt(row, c); cell.classList.remove("nv-csv-virtual-cell"); cell.dataset.declared = "true";
      }
      view.paint(getSelection().range);
      history.record(before); markCsvDirty();
    },
    copy() { return copyCsvRange(csvRows, getSelection().range); },
    clear() { return commit(clearCsvRange(csvRows, getSelection().range), anchor, activePosition); },
    paste(text) {
      const block = parseCsvClipboard(text), origin = { ...activePosition };
      return commit(writeCsvBlock(csvRows, origin, block), origin, { row: origin.row + block.length - 1, col: origin.col + block[0].length - 1 });
    },
    move(range, origin) { return commit(moveCsvRange(csvRows, range, origin), origin,
      { row: origin.row + range.bottom - range.top, col: origin.col + range.right - range.left }); },
  };
  const csvTableContext = {
    isActive() { return Boolean(tableWrapper.isConnected && window.__nvCsvTableContext === csvTableContext); },
    getEditorRoot() {
      return tableWrapper;
    },
    getSelection, undo: () => history.undo(), redo: () => history.redo(),
    moveActiveCell(direction) {
      const delta = { left: [0,-1], right: [0,1], up: [-1,0], down: [1,0] }[direction];
      if (!delta) return false; editor.navigate(delta); return true;
    },
    insertRow(direction = "below") {
      const row = Math.min(csvRows.length, activePosition.row + (direction === "below" ? 1 : 0));
      return commit(insertCsvRow(csvRows, row, Math.max(declaredColumnCount(csvRows), activePosition.col + 1)), { row, col: activePosition.col });
    },
    deleteRow() { const rows = deleteCsvRow(csvRows, activePosition.row); return commit(rows, { row: Math.min(activePosition.row, rows.length - 1), col: activePosition.col }); },
    insertColumn(direction = "right") {
      const col = activePosition.col + (direction === "right" ? 1 : 0);
      return commit(insertCsvColumn(csvRows, col), { row: activePosition.row, col });
    },
    deleteColumn() { const rows = deleteCsvColumn(csvRows, activePosition.col); return commit(rows, { row: activePosition.row, col: Math.min(activePosition.col, declaredColumnCount(rows) - 1) }); },
    getRows: () => cloneCsvRows(csvRows), getActivePosition: () => ({ ...activePosition }),
  };
  window.__nvTableEditorRoot = tableWrapper;
  window.__nvCsvTableContext = window.__nvActiveGridTableContext = csvTableContext;
  interaction = bindCsvRangeInteraction(tableWrapper, table, editor, view);
  const resize = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => {
    view.paint(getSelection().range); interaction.layoutChanged();
  }) : null;
  resize?.observe(table);
  container.__cleanupCSVTableToolbar = () => {
    disposed = true; interaction.dispose(); resize?.disconnect(); clearEditorContext(filePath);
    if (window.__nvTableEditorRoot === tableWrapper) window.__nvTableEditorRoot = null;
    if (window.__nvCsvEditor?.table === table) window.__nvCsvEditor = null;
    if (window.__nvCsvTableContext === csvTableContext) window.__nvCsvTableContext = null;
    if (window.__nvActiveGridTableContext === csvTableContext) window.__nvActiveGridTableContext = null;
    if (tableWrapper.contains(window.__nvHtmlTableActiveCell)) { window.__nvHtmlTableActiveCell = null; window.__nvHtmlTableActiveTable = null; }
    updateToolbarState({ htmlTableSelected: false });
  };
  function setRows(rows, options = {}) {
    if (options.markDirty !== false) return commit(rows, { row: 0, col: 0 });
    csvRows = cloneCsvRows(rows); anchor = activePosition = { row: 0, col: 0 }; history.clear(); render();
  }
  function setSpreadsheetText(text, options = {}) { return setRows(parseDelimitedText(text, options.delimiter || activeDelimiter), options); }
  try {
    const response = await fetch(`/Notebook/${filePath}`);
    if (!response.ok) throw new Error(response.statusText);
    const text = await response.text(); if (disposed) return;
    csvRows = parseDelimitedText(text, activeDelimiter); render();
    window.getEditorHTML = () => serializeDelimitedRows(csvRows, activeDelimiter);
    window.setEditorHTML = setSpreadsheetText;
    window.__nvCsvEditor = { filePath, delimiter: activeDelimiter, table, ...editor, getRows: csvTableContext.getRows,
      setRows, importText: setSpreadsheetText, parseDelimitedText, serializeDelimitedRows,
      copySelection(event = null) {
        const text = editor.copy();
        if (event?.clipboardData) { event.preventDefault(); event.clipboardData.setData("text/plain", text); return true; }
        return navigator.clipboard?.writeText(text);
      },
    };
    window.saveWYSIWYGFile = async path => {
      const response = await fetch("/api/save", { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: path || filePath, sourcePath: filePath, content: window.getEditorHTML() }) });
      if (!response.ok) throw new Error(response.statusText);
      if (window.NodevisionState) window.NodevisionState.fileIsDirty = false;
      updateToolbarState({ fileIsDirty: false });
    };
  } catch (error) { wrapper.textContent = `Failed to load file: ${error.message}`; console.error(error); }
  return container.__cleanupCSVTableToolbar;
}
