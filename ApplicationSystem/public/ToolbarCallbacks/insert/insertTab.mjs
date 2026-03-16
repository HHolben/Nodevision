// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/insertTab.mjs
// This file defines browser-side insert Tab logic for the Nodevision UI. It renders interface components and handles user interactions.

export default function insertTab() {
  const panel = document.querySelector(
    ".editor-panel.active, .active-editor, [data-editor-active='true'], #editor-root"
  );

  if (!panel) {
    console.warn("insertTab: No active editor panel found.");
    return;
  }

  const textarea = panel.querySelector("textarea, input[type='text']");
  const editable = panel.querySelector("[contenteditable='true']");

  const editorEl = textarea || editable;

  if (!editorEl) {
    console.warn("insertTab: No supported editor found inside active panel.");
    return;
  }

  const TAB = "\t";

  // TEXTAREA / INPUT
  if (editorEl.tagName === "TEXTAREA" || editorEl.tagName === "INPUT") {
    const start = editorEl.selectionStart;
    const end = editorEl.selectionEnd;

    editorEl.value =
      editorEl.value.slice(0, start) +
      TAB +
      editorEl.value.slice(end);

    editorEl.selectionStart = editorEl.selectionEnd =
      start + TAB.length;

    editorEl.dispatchEvent(new Event("input", { bubbles: true }));
    return;
  }

  // CONTENTEDITABLE (HTML editor)
  if (editorEl.isContentEditable) {
    editorEl.focus();
    document.execCommand("insertText", false, TAB);
  }
}
