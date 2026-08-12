// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/TableProgrammaticHistory.mjs
// This module connects table toolbar DOM mutations to the active HTML editor's programmatic undo history without coupling table tools to the editor implementation.

export function readEditorHtml(root) {
  return root ? String(root.innerHTML || "") : "";
}

export function recordTableEditorMutation(root, beforeHtml) {
  if (!root) return false;
  const before = String(beforeHtml || "");
  if (readEditorHtml(root) === before) return false;

  const tools = window.HTMLWysiwygTools || {};
  if (typeof tools.recordProgrammaticChange === "function") {
    return tools.recordProgrammaticChange(before);
  }

  root.__nvProgrammaticHistory?.record?.(before);
  tools.markDirty?.();
  return true;
}
