// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/phpOpenDashboardConfig.mjs
// This file defines browser-side php Open Dashboard Config logic for the Nodevision UI. It renders interface components and handles user interactions.
// Open PHP editor dashboard configuration panel from Insert toolbar.
export default function phpOpenDashboardConfig() {
  window.dispatchEvent(new CustomEvent("nv-php-editor-command", {
    detail: { command: "dashboard-config" }
  }));
}
