// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/CSVeditor.mjs
// This file defines browser-side CSVeditor logic for the Nodevision UI. It renders interface components and handles user interactions.
// CSVeditor.mjs
import { updateToolbarState } from "/panels/createToolbar.mjs";
import { handleTableArrowKeyNavigation, setActiveTableCell } from "/ToolbarCallbacks/insert/tableTools.mjs";
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
  table.addEventListener("pointerdown", updateTableSelectionFromEvent);
  table.addEventListener("click", updateTableSelectionFromEvent);
  table.addEventListener("keyup", updateTableSelectionFromSelection);
  table.addEventListener("focusin", updateTableSelectionFromSelection);
  table.addEventListener("keydown", handleTableArrowKeyNavigation);
  document.addEventListener("selectionchange", updateTableSelectionFromSelection);
  container.__cleanupCSVTableToolbar = () => {
    table.removeEventListener("keydown", handleTableArrowKeyNavigation);
    document.removeEventListener("selectionchange", updateTableSelectionFromSelection);
    if (window.__nvTableEditorRoot === tableWrapper) window.__nvTableEditorRoot = null;
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

  // Load CSV data
  try {
    const res = await fetch(`/Notebook/${filePath}`);
    if (!res.ok) throw new Error(res.statusText);
    const csvText = await res.text();

    const rows = csvText.split(/\r?\n/);
    rows.forEach(rowText => {
      const tr = document.createElement("tr");
      const cells = rowText.split(",");
      cells.forEach(cell => tr.appendChild(createCell(cell)));
      table.appendChild(tr);
    });

    // Expose API for saving CSV
    window.getEditorHTML = () => {
      const data = Array.from(table.rows).map(tr =>
        Array.from(tr.cells).map(td => td.textContent).join(",")
      ).join("\n");
      return data;
    };

    window.setEditorHTML = csv => {
      table.innerHTML = "";
      const rows = csv.split(/\r?\n/);
      rows.forEach(rowText => {
        const tr = document.createElement("tr");
        const cells = rowText.split(",");
        cells.forEach(cell => tr.appendChild(createCell(cell)));
        table.appendChild(tr);
      });
    };

    window.saveWYSIWYGFile = async (path) => {
      const content = window.getEditorHTML();
      await fetch("/api/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: path || filePath, sourcePath: filePath, content }),
      });
      console.log("Saved CSV file:", path || filePath);
    };

  } catch (err) {
    wrapper.innerHTML = `<div style="color:red;padding:12px">Failed to load file: ${err.message}</div>`;
    console.error(err);
  }
}
