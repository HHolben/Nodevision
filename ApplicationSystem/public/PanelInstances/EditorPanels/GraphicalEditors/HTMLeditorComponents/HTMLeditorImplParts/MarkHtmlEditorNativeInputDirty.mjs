// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/MarkHtmlEditorNativeInputDirty.mjs
// This module implements mark Html Editor Native Input Dirty behavior for the HTMLeditorImpl feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { updateToolbarState } from "../../../../../panels/createToolbar.mjs";
import { HTML_TABLE_MIN_COLUMN_WIDTH } from "./EnsureHTMLLayoutStyles.mjs";

// Mark Html Editor Native Input Dirty operations.
export function markHtmlEditorNativeInputDirty(filePath = "", wysiwyg) {
  wysiwyg.__nvHtmlDirty = true;
  if (window.__nvActiveHtmlEditorContext?.editorElement !== wysiwyg) return;
  window.NodevisionState = window.NodevisionState || {};
  const wasDirty = Boolean(window.NodevisionState.fileIsDirty);
  window.NodevisionState.fileIsDirty = true;
  if (filePath) {
    window.NodevisionState.selectedFile = filePath;
    window.NodevisionState.activeEditorFilePath = filePath;
  }
  if (!wasDirty) {
    updateToolbarState({
      fileIsDirty: true
    });
    try {
      window.dispatchEvent(new CustomEvent("nodevision-editor-dirty", {
        detail: {
          filePath: filePath || window.NodevisionState.selectedFile || ""
        }
      }));
    } catch {
      // Non-critical notification only.
    }
  }
}

export function normalizeDocumentMetadataTags(value) {
  if (Array.isArray(value)) return value.map(item => String(item || "").trim()).filter(Boolean);
  return String(value || "").split(/[;,]/).map(item => item.trim()).filter(Boolean);
}

export function findHeadChild(headContainer, tagName, create = false) {
  const tag = String(tagName || "").toLowerCase();
  let el = Array.from(headContainer?.children || []).find(child => child.tagName?.toLowerCase() === tag) || null;
  if (!el && create && headContainer) {
    el = document.createElement(tag);
    headContainer.appendChild(el);
  }
  return el;
}

export function findNamedMeta(headContainer, name, create = false) {
  const wanted = String(name || "").toLowerCase();
  let el = Array.from(headContainer?.querySelectorAll?.("meta") || []).find(meta => String(meta.getAttribute("name") || "").toLowerCase() === wanted) || null;
  if (!el && create && headContainer) {
    el = document.createElement("meta");
    el.setAttribute("name", wanted);
    headContainer.appendChild(el);
  }
  return el;
}

export function setHeadText(headContainer, tagName, value) {
  const text = String(value || "").trim();
  const el = findHeadChild(headContainer, tagName, Boolean(text));
  if (!el) return;
  if (!text) {
    el.remove();
    return;
  }
  el.textContent = text;
}

export function setNamedMeta(headContainer, name, value) {
  const text = String(value || "").trim();
  const el = findNamedMeta(headContainer, name, Boolean(text));
  if (!el) return;
  if (!text) {
    el.remove();
    return;
  }
  el.setAttribute("content", text);
}

export function readHtmlDocumentMetadata(headContainer) {
  const title = findHeadChild(headContainer, "title")?.textContent || "";
  const description = findNamedMeta(headContainer, "description")?.getAttribute("content") || "";
  const author = findNamedMeta(headContainer, "author")?.getAttribute("content") || "";
  const tags = normalizeDocumentMetadataTags(findNamedMeta(headContainer, "keywords")?.getAttribute("content") || "");
  return {
    formatLabel: "HTML document",
    fields: ["title", "description", "author", "tags"],
    title: title.trim(),
    description: description.trim(),
    author: author.trim(),
    tags
  };
}

export function applyHtmlDocumentMetadata(headContainer, patch = {}) {
  setHeadText(headContainer, "title", patch.title);
  setNamedMeta(headContainer, "description", patch.description);
  setNamedMeta(headContainer, "author", patch.author);
  setNamedMeta(headContainer, "keywords", normalizeDocumentMetadataTags(patch.tags).join(", "));
  return readHtmlDocumentMetadata(headContainer);
}

export function getHtmlEditorElementFromNode(node) {
  return node?.nodeType === Node.TEXT_NODE ? node.parentElement : node;
}

export function getTableCellFromEditorTarget(wysiwyg, node) {
  const el = getHtmlEditorElementFromNode(node);
  const cell = el?.closest?.("td, th") || null;
  return cell && wysiwyg?.contains?.(cell) ? cell : null;
}

export function getTableColumnCount(table) {
  return Math.max(0, ...Array.from(table?.rows || []).map(row => row.cells.length));
}

export function getTableColumnCells(table, columnIndex) {
  return Array.from(table?.rows || []).map(row => row.cells[columnIndex] || null).filter(Boolean);
}

export function measureTableColumnWidth(table, columnIndex) {
  const cell = getTableColumnCells(table, columnIndex)[0] || null;
  const rect = cell?.getBoundingClientRect?.();
  return Math.max(HTML_TABLE_MIN_COLUMN_WIDTH, Math.round(cell?.offsetWidth || rect?.width || HTML_TABLE_MIN_COLUMN_WIDTH));
}

export function formatTableCssPixels(value, minimum) {
  const n = Math.max(minimum, Number(value) || minimum);
  return Math.round(n * 100) / 100 + "px";
}

export function applyTableColumnWidth(table, columnIndex, width) {
  const px = formatTableCssPixels(width, HTML_TABLE_MIN_COLUMN_WIDTH);
  for (const cell of getTableColumnCells(table, columnIndex)) {
    cell.style.width = px;
    cell.style.boxSizing = "border-box";
  }
}

export function freezeTableColumnWidths(table) {
  if (!table) return;
  const tableRect = table.getBoundingClientRect?.();
  const tableWidth = table.offsetWidth || tableRect?.width || 0;
  if (tableWidth > 0) table.style.width = Math.round(tableWidth) + "px";
  table.style.tableLayout = "fixed";
  const columnCount = getTableColumnCount(table);
  for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
    applyTableColumnWidth(table, columnIndex, measureTableColumnWidth(table, columnIndex));
  }
}
