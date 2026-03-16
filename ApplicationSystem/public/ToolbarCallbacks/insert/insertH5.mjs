// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/insertH5.mjs
// This file defines browser-side insert H5 logic for the Nodevision UI. It renders interface components and handles user interactions.
import { insertBlock } from "./utils/insertHelpers.mjs";

export default function insertH5() {
  const panel = document.querySelector(
    ".editor-panel.active, .active-editor, [data-editor-active='true'], #editor-root"
  );
  if (!panel) {
    console.warn("insertH6: No active editor panel found.");
    return;
  }

  const textarea = panel.querySelector("textarea, input[type='text']");
  const editable = panel.querySelector("[contenteditable='true']");

  const editorEl = textarea || editable;
  if (!editorEl) {
    console.warn("insertH5: No supported editor found inside active panel.");
    return;
  }

  insertBlock(editorEl, "h5");
}
