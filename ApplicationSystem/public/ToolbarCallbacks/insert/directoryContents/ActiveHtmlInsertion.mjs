// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/directoryContents/ActiveHtmlInsertion.mjs
// This module locates the current HTML or PHP editor and inserts generated markup through existing editor hooks.

import { normalizeNotebookPath } from "./DirectoryContentsSnippet.mjs";

function firstPath(...values) {
  for (const value of values) {
    const normalized = normalizeNotebookPath(value || "");
    if (normalized) return normalized;
  }
  return "";
}

function samePath(left = "", right = "") {
  return normalizeNotebookPath(left).toLowerCase() === normalizeNotebookPath(right).toLowerCase();
}

function editorMode() {
  return String(window.NodevisionState?.currentMode || window.currentMode || "");
}

function activeHtmlContext() {
  const focused = document.activeElement?.closest?.(".panel-cell")?.__nvHtmlEditorContext || null;
  const active = window.activeCell?.__nvHtmlEditorContext || null;
  const global = window.__nvActiveHtmlEditorContext || null;
  for (const context of [focused, active, global]) {
    if (context?.kind !== "html" || !context.filePath) continue;
    if (typeof context.activate === "function") context.activate();
    return context;
  }
  return null;
}

export function getActiveHtmlOrPhpPath() {
  const htmlContext = activeHtmlContext();
  return firstPath(
    htmlContext?.filePath,
    window.NodevisionState?.activeEditorFilePath,
    window.__nvWysiwygActivePath,
    window.__nvHtmlEditorActivePath,
    window.__nvCodeEditorActivePath,
    window.currentActiveFilePath,
    window.selectedFilePath,
    window.NodevisionState?.selectedFile,
  );
}

export function isHtmlOrPhpPath(filePath = "") {
  return /\.(html?|php)$/i.test(normalizeNotebookPath(filePath));
}

function markEditorDirty(filePath = "") {
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.fileIsDirty = true;
  window.NodevisionState.activeEditorFilePath = filePath || window.NodevisionState.activeEditorFilePath;
  if (window.__nvCodeEditorActivePath && samePath(window.__nvCodeEditorActivePath, filePath)) {
    window.__nvCodeEditorDirty = true;
  }
  window.HTMLWysiwygTools?.markDirty?.();
}

function insertIntoMonaco(html, filePath) {
  const editor = window.monacoEditor;
  const editorPath = firstPath(window.__nvCodeEditorActivePath, window.currentActiveFilePath);
  if (editorMode() !== "CodeEditing") return false;
  if (!editor?.getModel || !editor?.getSelection || !editor?.executeEdits) return false;
  if (filePath && editorPath && !samePath(editorPath, filePath)) return false;
  editor.executeEdits("insert-directory-contents", [{
    range: editor.getSelection(),
    text: String(html || ""),
    forceMoveMarkers: true,
  }]);
  editor.focus?.();
  markEditorDirty(filePath);
  return true;
}

function appendViaTextHooks(html, filePath) {
  const mode = editorMode();
  if (mode !== "PHPediting" || typeof window.getEditorMarkdown !== "function") return false;
  if (typeof window.setEditorMarkdown !== "function") return false;
  const current = String(window.getEditorMarkdown() || "");
  const separator = current && !current.endsWith("\n") ? "\n\n" : "";
  window.setEditorMarkdown(`${current}${separator}${html}\n`);
  markEditorDirty(filePath);
  return true;
}

function insertIntoPhpTextarea(html, filePath) {
  if (editorMode() !== "PHPediting") return false;
  const input = document.querySelector(".nv-php-input");
  if (!(input instanceof HTMLTextAreaElement)) return false;
  const text = String(html || "");
  const start = Number.isFinite(input.selectionStart) ? input.selectionStart : input.value.length;
  const end = Number.isFinite(input.selectionEnd) ? input.selectionEnd : start;
  input.value = input.value.slice(0, start) + text + input.value.slice(end);
  const nextCaret = start + text.length;
  input.setSelectionRange(nextCaret, nextCaret);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.focus();
  markEditorDirty(filePath);
  return true;
}

function insertIntoWysiwyg(html, filePath) {
  if (!["HTMLediting", "HTMLviewing", "EPUBediting"].includes(editorMode())) return false;
  const tools = window.HTMLWysiwygTools;
  if (!tools || typeof tools.insertHTMLAtCaret !== "function") return false;
  tools.insertHTMLAtCaret(String(html || ""));
  document.querySelector("#wysiwyg")?.dispatchEvent(new Event("input", { bubbles: true }));
  markEditorDirty(filePath);
  return true;
}

function appendViaHtmlHooks(html, filePath) {
  if (!["HTMLediting", "HTMLviewing", "EPUBediting"].includes(editorMode())) return false;
  if (typeof window.getEditorHTML !== "function" || typeof window.setEditorHTML !== "function") return false;
  const current = String(window.getEditorHTML() || "");
  const separator = current && !current.endsWith("\n") ? "\n\n" : "";
  window.setEditorHTML(`${current}${separator}${html}\n`);
  markEditorDirty(filePath);
  return true;
}

export function insertIntoActiveHtmlOrPhpEditor(html, filePath = getActiveHtmlOrPhpPath()) {
  if (insertIntoMonaco(html, filePath)) return true;
  if (insertIntoWysiwyg(html, filePath)) return true;
  if (insertIntoPhpTextarea(html, filePath)) return true;
  if (appendViaTextHooks(html, filePath)) return true;
  if (appendViaHtmlHooks(html, filePath)) return true;
  try {
    document.execCommand("insertHTML", false, String(html || ""));
    markEditorDirty(filePath);
    return true;
  } catch (err) {
    console.warn("insertDirectoryContents: unable to insert markup", err);
    return false;
  }
}
