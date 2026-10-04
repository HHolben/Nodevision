// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/tableToolsParts/IsEditableTableRoot.mjs
// This module implements is Editable Table Root behavior for the tableTools feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { presentHtmlClass, presentHtmlAttribute } from "/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlPresentation.mjs";
import { updateToolbarState } from "/panels/createToolbar.mjs";

// Is Editable Table Root operations.
export const TABLE_SELECTED_CELL_CLASS = "nv-html-table-selected-cell";

export const TABLE_SELECTION_ANCHOR_CLASS = "nv-html-table-selection-anchor";

export const TABLE_SELECTION_FOCUS_CLASS = "nv-html-table-selection-focus";

export function isEditableTableRoot(root) {
  return Boolean(root && root.isConnected && (root.isContentEditable || root.getAttribute?.("contenteditable") === "true" || root.getAttribute?.("data-nv-table-editor-root") === "true"));
}

export function getActiveGridTableContext() {
  const context = window.__nvActiveGridTableContext || window.__nvCsvTableContext || null;
  if (!context?.isActive?.()) return null;
  return context;
}

export function getTableEditorRoot() {
  try {
    const gridRoot = getActiveGridTableContext()?.getEditorRoot?.();
    if (isEditableTableRoot(gridRoot)) return gridRoot;
  } catch {}
  try {
    const toolsRoot = window.HTMLWysiwygTools?.getEditorElement?.();
    if (isEditableTableRoot(toolsRoot)) return toolsRoot;
  } catch {}
  try {
    const context = window.__nvActiveHtmlEditorContext || null;
    const contextRoot = context?.getEditorElement?.() || context?.editorElement || null;
    if (isEditableTableRoot(contextRoot)) return contextRoot;
  } catch {}
  const registeredRoot = window.__nvTableEditorRoot;
  if (isEditableTableRoot(registeredRoot)) return registeredRoot;
  return document.querySelector("#wysiwyg[contenteditable='true']");
}

export function closestCell(node) {
  const el = node?.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  return el?.closest?.("td, th") || null;
}

export function isCellInEditor(cell, wysiwyg = getTableEditorRoot()) {
  return Boolean(cell && cell.isConnected && wysiwyg && wysiwyg.contains(cell));
}

export function currentSelectionCell() {
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

export function cellsWithTableSelectionClasses(root = getTableEditorRoot()) {
  if (!root?.querySelectorAll) return [];
  return Array.from(root.querySelectorAll(`.${TABLE_SELECTED_CELL_CLASS}, .${TABLE_SELECTION_ANCHOR_CLASS}, .${TABLE_SELECTION_FOCUS_CLASS}`));
}

export function clearTableCellSelection(options = {}) {
  const keepActive = options.keepActive !== false;
  for (const cell of cellsWithTableSelectionClasses()) {
    [TABLE_SELECTED_CELL_CLASS, TABLE_SELECTION_ANCHOR_CLASS, TABLE_SELECTION_FOCUS_CLASS].forEach(name => presentHtmlClass(cell, name, false));
    presentHtmlAttribute(cell, "data-nv-html-table-selected", null);
  }
  window.__nvHtmlTableSelectedCells = [];
  window.__nvHtmlTableSelectedTable = null;
  window.__nvHtmlTableSelectionMode = null;
  if (!keepActive) {
    setActiveTableCell(null);
    updateToolbarState({
      htmlTableSelected: false
    });
  }
}

export function getSelectedTableCells(table = null) {
  const wysiwyg = getTableEditorRoot();
  const saved = Array.isArray(window.__nvHtmlTableSelectedCells) ? window.__nvHtmlTableSelectedCells : [];
  const cells = saved.filter(cell => isCellInEditor(cell, wysiwyg) && (!table || cell.closest("table") === table));
  if (cells.length) return cells;
  return cellsWithTableSelectionClasses(wysiwyg).filter(cell => isCellInEditor(cell, wysiwyg) && (!table || cell.closest("table") === table));
}

export function setSelectedTableCells(cells = [], options = {}) {
  const wysiwyg = getTableEditorRoot();
  const valid = [];
  const seen = new Set();
  for (const cell of cells) {
    if (!isCellInEditor(cell, wysiwyg) || seen.has(cell)) continue;
    seen.add(cell);
    valid.push(cell);
  }
  clearTableCellSelection({
    keepActive: true
  });
  const activeCell = valid.includes(options.activeCell) ? options.activeCell : valid[valid.length - 1] || null;
  const anchorCell = valid.includes(options.anchorCell) ? options.anchorCell : valid[0] || null;
  for (const cell of valid) {
    presentHtmlClass(cell, TABLE_SELECTED_CELL_CLASS, true);
    presentHtmlAttribute(cell, "data-nv-html-table-selected", "true");
  }
  presentHtmlClass(anchorCell, TABLE_SELECTION_ANCHOR_CLASS, true);
  presentHtmlClass(activeCell, TABLE_SELECTION_FOCUS_CLASS, true);
  window.__nvHtmlTableSelectedCells = valid;
  window.__nvHtmlTableSelectedTable = valid[0]?.closest("table") || null;
  window.__nvHtmlTableSelectionMode = valid.length ? options.mode || "cells" : null;
  setActiveTableCell(activeCell);
  updateToolbarState({
    htmlTableSelected: Boolean(activeCell)
  });
  return valid;
}

export function maxGridColumnCount(model) {
  return Math.max(0, ...model.grid.map(row => row?.length || 0));
}
