// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/insertH3.mjs
// This file defines browser-side insert H3 logic for the Nodevision UI. It renders interface components and handles user interactions.
import { insertMarkdownHeadingIfActive } from "./utils/markdownInsertHelpers.mjs";
import { insertBlock } from "./utils/insertHelpers.mjs";

export default function insertH3() {
  if (insertMarkdownHeadingIfActive(3)) return;

  const panel = document.querySelector(
    ".editor-panel.active, .active-editor, [data-editor-active='true'], #editor-root"
  );
  if (!panel) {
    console.warn("insertH3: No active editor panel found.");
    return;
  }

  const textarea = panel.querySelector("textarea, input[type='text']");
  const editable = panel.querySelector("[contenteditable='true']");

  const editorEl = textarea || editable;
  if (!editorEl) {
    console.warn("insertH3: No supported editor found inside active panel.");
    return;
  }

  insertBlock(editorEl, "h3");
}
