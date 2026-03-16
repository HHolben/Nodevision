// Nodevision/ApplicationSystem/public/ToolbarCallbacks/edit/phpOpenLogicEditor.mjs
// This file defines browser-side php Open Logic Editor logic for the Nodevision UI. It renders interface components and handles user interactions.
// Open PHP editor logic block panel from Nodevision toolbar.
export default function phpOpenLogicEditor() {
  window.dispatchEvent(new CustomEvent("nv-php-editor-command", {
    detail: { command: "logic-editor" }
  }));
}
