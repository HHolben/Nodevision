// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/phpOpenDataLogging.mjs
// This file defines browser-side php Open Data Logging logic for the Nodevision UI. It renders interface components and handles user interactions.
// Open PHP editor data logging panel from Insert toolbar.
export default function phpOpenDataLogging() {
  window.dispatchEvent(new CustomEvent("nv-php-editor-command", {
    detail: { command: "data-logging" }
  }));
}
