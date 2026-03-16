// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/insertH2.mjs
// This file defines browser-side insert H2 logic for the Nodevision UI. It renders interface components and handles user interactions.
import { insertBlock } from "./utils/insertHelpers.mjs";

export default function insertH2() {
  const panel = document.querySelector(
    ".editor-panel.active, .active-editor, [data-editor-active='true'], #editor-root"
  );
  if (!panel) {
    console.warn("insertH2: No active editor panel found.");
    return;
  }

  const textarea = panel.querySelector("textarea, input[type='text']");
  const editable = panel.querySelector("[contenteditable='true']");

  const editorEl = textarea || editable;
  if (!editorEl) {
    console.warn("insertH2: No supported editor found inside active panel.");
    return;
  }

  insertBlock(editorEl, "h2");
}
