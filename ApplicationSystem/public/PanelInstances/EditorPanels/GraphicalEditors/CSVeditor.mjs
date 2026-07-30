// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/CSVeditor.mjs
// This file defines browser-side CSVeditor logic for the Nodevision UI. It renders interface components and handles user interactions.
// CSVeditor.mjs
import { updateToolbarState } from "/panels/createToolbar.mjs";
import { handleTableArrowKeyNavigation, moveActiveTableCell, setActiveTableCell } from "/ToolbarCallbacks/insert/tableTools.mjs";

function normalizeSpreadsheetDelimiter(delimiter) {
  return delimiter === "\t" ? "\t" : ",";
}

function spreadsheetDelimiterForPath(path = "") {
  const cleanPath = String(path || "").split(/[?#]/)[0].toLowerCase();
  return cleanPath.endsWith(".tsv") ? "\t" : ",";
}

function parseDelimitedText(text = "", delimiter = ",") {
  const source = String(text ?? "").replace(/\u0000/g, "");
  const separator = normalizeSpreadsheetDelimiter(delimiter);
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];

    if (inQuotes) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === separator) {
      row.push(cell);
      cell = "";
      continue;
    }

    if (char === "\r" || char === "\n") {
      if (char === "\r" && source[index + 1] === "\n") {
        index += 1;
      }
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  if (cell || row.length || source.endsWith(separator)) {
    row.push(cell);
    rows.push(row);
  }

  return rows.length ? rows : [[""]];
}

function serializeDelimitedRows(rows = [], delimiter = ",") {
  const separator = normalizeSpreadsheetDelimiter(delimiter);
  const serializeCell = (value) => {
    const text = String(value ?? "");
    if (text.includes(separator) || /["\r\n]/.test(text)) {
      return `"${text.replace(/"/g, '""')}"`;
    }
    return text;
  };

  return rows.map((row) => row.map(serializeCell).join(separator)).join("\n");
}

export async function renderEditor(filePath, container) {
  if (!container) throw new Error("Container required");
  if (typeof container.__cleanupCSVTableToolbar === "function") {
    container.__cleanupCSVTableToolbar();
    container.__cleanupCSVTableToolbar = null;
  }
  container.innerHTML = "";
  updateToolbarState({ currentMode: "CSVediting", htmlTableSelected: false });

  const wrapper = document.createElement("div");
  wrapper.id = "editor-root";
  wrapper.style.display = "flex";
  wrapper.style.flexDirection = "column";
  wrapper.style.height = "100%";
  wrapper.style.width = "100%";
  wrapper.style.overflow = "auto";
  container.appendChild(wrapper);

  const tableWrapper = document.createElement("div");
  tableWrapper.style.flex = "1";
  tableWrapper.style.overflow = "auto";
  wrapper.appendChild(tableWrapper);

  const table = document.createElement("table");
  table.style.borderCollapse = "collapse";
  table.style.width = "100%";
  table.style.tableLayout = "fixed";
  tableWrapper.appendChild(table);
  window.__nvTableEditorRoot = tableWrapper;

  let lastCsvTableSelected = false;
  const activeDelimiter = spreadsheetDelimiterForPath(filePath);
  const findTableCellFromNode = (node) => {
    const el = node?.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    const cell = el?.closest?.("td, th") || null;
    return cell && tableWrapper.contains(cell) ? cell : null;
  };
  const publishTableSelection = (cell) => {
    const activeCell = setActiveTableCell(cell);
    const selected = Boolean(activeCell);
    if (selected !== lastCsvTableSelected) {
      lastCsvTableSelected = selected;
      updateToolbarState({ htmlTableSelected: selected });
    }
  };
  const updateTableSelectionFromSelection = () => {
    const selection = window.getSelection?.();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    if (!range || !tableWrapper.contains(range.commonAncestorContainer)) return;
    publishTableSelection(findTableCellFromNode(range.startContainer));
  };
  const updateTableSelectionFromEvent = (event) => {
    publishTableSelection(findTableCellFromNode(event.target));
  };
  const handleCsvTableKeyNavigation = (event) => {
    if (handleTableArrowKeyNavigation(event)) return true;
    const direction = event?.key === "Enter" ? "down" : event?.key === "Tab" ? "right" : "";
    if (!direction) return false;
    if (event.defaultPrevented || event.isComposing) return false;
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return false;
    const eventCell = findTableCellFromNode(event.target);
    const activeCell = window.__nvHtmlTableActiveCell;
    const cell = eventCell
      ? setActiveTableCell(eventCell)
      : (activeCell && tableWrapper.contains(activeCell) ? activeCell : null);
    if (!cell) return false;
    moveActiveTableCell(direction, { cell });
    event.preventDefault();
    return true;
  };
  const markCsvDirty = () => {
    if (window.NodevisionState) window.NodevisionState.fileIsDirty = true;
    updateToolbarState({ currentMode: "CSVediting", fileIsDirty: true });
  };
  table.addEventListener("pointerdown", updateTableSelectionFromEvent);
  table.addEventListener("click", updateTableSelectionFromEvent);
  table.addEventListener("keyup", updateTableSelectionFromSelection);
  table.addEventListener("focusin", updateTableSelectionFromSelection);
  table.addEventListener("keydown", handleCsvTableKeyNavigation);
  table.addEventListener("input", markCsvDirty);
  document.addEventListener("selectionchange", updateTableSelectionFromSelection);
  container.__cleanupCSVTableToolbar = () => {
    table.removeEventListener("pointerdown", updateTableSelectionFromEvent);
    table.removeEventListener("click", updateTableSelectionFromEvent);
    table.removeEventListener("keyup", updateTableSelectionFromSelection);
    table.removeEventListener("focusin", updateTableSelectionFromSelection);
    table.removeEventListener("keydown", handleCsvTableKeyNavigation);
    table.removeEventListener("input", markCsvDirty);
    document.removeEventListener("selectionchange", updateTableSelectionFromSelection);
    if (window.__nvTableEditorRoot === tableWrapper) window.__nvTableEditorRoot = null;
    if (window.__nvCsvEditor?.table === table) window.__nvCsvEditor = null;
    if (window.__nvHtmlTableActiveCell && tableWrapper.contains(window.__nvHtmlTableActiveCell)) {
      window.__nvHtmlTableActiveCell = null;
      window.__nvHtmlTableActiveTable = null;
    }
    updateToolbarState({ htmlTableSelected: false });
  };

  // Helper to create a cell
  function createCell(value = "") {
    const td = document.createElement("td");
    td.contentEditable = "true";
    td.style.border = "1px solid #ccc";
    td.style.padding = "4px";
    td.style.minWidth = "80px";
    td.textContent = value;
    return td;
  }

  function renderRows(rows = [[""]]) {
    table.innerHTML = "";
    const safeRows = Array.isArray(rows) && rows.length ? rows : [[""]];
    safeRows.forEach(rowCells => {
      const tr = document.createElement("tr");
      const cells = Array.isArray(rowCells) && rowCells.length ? rowCells : [""];
      cells.forEach(cell => tr.appendChild(createCell(cell)));
      table.appendChild(tr);
    });
  }

  function getRows() {
    return Array.from(table.rows).map(tr =>
      Array.from(tr.cells).map(td => td.textContent)
    );
  }

  function setSpreadsheetText(text, options = {}) {
    const delimiter = normalizeSpreadsheetDelimiter(options.delimiter || activeDelimiter);
    const rows = parseDelimitedText(text, delimiter);
    renderRows(rows);
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
