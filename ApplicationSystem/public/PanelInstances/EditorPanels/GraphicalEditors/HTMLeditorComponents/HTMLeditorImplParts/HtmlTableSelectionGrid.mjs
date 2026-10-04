// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/HtmlTableSelectionGrid.mjs
// This module implements html Table Selection Grid behavior for the HTMLeditorImpl feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { htmlSourceProvenanceFor } from "/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlPresentation.mjs";
import { HTML_DOCUMENT_BACKGROUND_PROPERTIES } from "./EnsureHTMLLayoutStyles.mjs";

// Html Table Selection Grid operations.
export function htmlTableSelectionGrid(table, selectedCells) {
  const positions = Array.from(selectedCells || []).filter(cell => cell?.closest?.("table") === table).map(cell => ({
    cell,
    rowIndex: cell.parentElement?.rowIndex ?? -1,
    colIndex: cell.cellIndex ?? -1
  })).filter(({
    rowIndex,
    colIndex
  }) => rowIndex >= 0 && colIndex >= 0);
  if (!positions.length) return null;
  const selectedSet = new Set(positions.map(({
    cell
  }) => cell));
  const minRow = Math.min(...positions.map(({
    rowIndex
  }) => rowIndex));
  const maxRow = Math.max(...positions.map(({
    rowIndex
  }) => rowIndex));
  const minCol = Math.min(...positions.map(({
    colIndex
  }) => colIndex));
  const maxCol = Math.max(...positions.map(({
    colIndex
  }) => colIndex));
  const rows = [];
  for (let rowIndex = minRow; rowIndex <= maxRow; rowIndex += 1) {
    const tableRow = table.rows?.[rowIndex] || null;
    const row = [];
    for (let colIndex = minCol; colIndex <= maxCol; colIndex += 1) {
      const cell = tableRow?.cells?.[colIndex] || null;
      row.push(cell && selectedSet.has(cell) ? cell : null);
    }
    rows.push(row);
  }
  return rows;
}

export function selectedHtmlTableCellsToPlainText(table, selectedCells) {
  const rows = htmlTableSelectionGrid(table, selectedCells);
  if (!rows) return null;
  return rows.map(row => row.map(cell => {
    if (!cell) return "";
    return String(cell.innerText ?? cell.textContent ?? "").replace(/\r?\n/g, " ");
  }).join("\t")).join("\n");
}

export function selectedHtmlTableCellsToHtml(table, selectedCells) {
  const rows = htmlTableSelectionGrid(table, selectedCells);
  if (!rows) return null;
  const tableClone = document.createElement("table");
  const tbody = document.createElement("tbody");
  tableClone.appendChild(tbody);
  rows.forEach(row => {
    const tr = document.createElement("tr");
    row.forEach(sourceCell => {
      const copyCell = sourceCell ? sourceCell.cloneNode(true) : document.createElement("td");
      tr.appendChild(copyCell);
    });
    tbody.appendChild(tr);
  });
  htmlSourceProvenanceFor(table)?.clean(tableClone);
  return tableClone.outerHTML;
}

export function copyHtmlTableSelection(event, table, selectedCells) {
  const plainText = selectedHtmlTableCellsToPlainText(table, selectedCells);
  if (plainText === null) return false;
  const htmlText = selectedHtmlTableCellsToHtml(table, selectedCells);
  if (event?.clipboardData) {
    event.preventDefault();
    event.clipboardData.setData("text/plain", plainText);
    if (htmlText) event.clipboardData.setData("text/html", htmlText);
    return true;
  }
  const clipboard = typeof navigator !== "undefined" ? navigator.clipboard : null;
  if (clipboard?.writeText) {
    event?.preventDefault?.();
    clipboard.writeText(plainText).catch(err => console.warn("Failed to copy HTML table selection:", err));
    return true;
  }
  return false;
}

export function sanitizeCssFontValue(value) {
  const clean = String(value || "").trim();
  if (!clean) throw new Error("Choose a font family.");
  if (/[;{}<>]/.test(clean) || /javascript:/i.test(clean) || /<\/?[a-z][\s\S]*>/i.test(clean)) {
    throw new Error("Font family contains unsafe characters.");
  }
  return clean.replace(/\s+/g, " ").slice(0, 220);
}

export function sanitizeSingleFontFamily(value) {
  const clean = String(value || "").trim().replace(/^['"]|['"]$/g, "");
  if (!clean) return "";
  if (/[,;{}<>]/.test(clean) || /javascript:/i.test(clean) || /<\/?[a-z][\s\S]*>/i.test(clean)) {
    throw new Error("Font family contains unsafe characters.");
  }
  return clean.replace(/["']/g, "").replace(/\s+/g, " ").slice(0, 90);
}

export function cssQuote(value) {
  return String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/[\n\r]/g, " ");
}

export function cssUrlQuote(value) {
  return String(value || "").replace(/\\/g, "/").replace(/"/g, "%22").replace(/[\n\r]/g, "");
}

export function sanitizeDocumentBackgroundImageSource(value) {
  const clean = String(value || "").trim();
  if (!clean) return "";
  if (/[<>{}]/.test(clean) || /javascript:/i.test(clean) || /<\/?[a-z][\s\S]*>/i.test(clean)) {
    throw new Error("Background picture source is unsafe.");
  }
  if (/^data:/i.test(clean) && !/^data:image\/[a-z0-9.+-]+;base64,/i.test(clean)) {
    throw new Error("Only image data URLs are supported.");
  }
  if (/^(https?:)?\/\//i.test(clean)) return clean;
  return clean.replace(/\\/g, "/");
}

export function applyDocumentBackgroundPreview(wysiwyg, styleSource) {
  if (!wysiwyg) return;
  for (const property of HTML_DOCUMENT_BACKGROUND_PROPERTIES) {
    wysiwyg.style[property] = styleSource?.[property] || "";
  }
}
