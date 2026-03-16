// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/phpToggleLivePreview.mjs
// This file defines browser-side php Toggle Live Preview logic for the Nodevision UI. It renders interface components and handles user interactions.
// Toggle PHP editor live preview/runtime from Insert toolbar.
export default function phpToggleLivePreview() {
  window.dispatchEvent(new CustomEvent("nv-php-editor-command", {
    detail: { command: "toggle-preview" }
  }));
}
