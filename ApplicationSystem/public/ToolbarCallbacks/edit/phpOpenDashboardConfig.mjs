// Nodevision/ApplicationSystem/public/ToolbarCallbacks/edit/phpOpenDashboardConfig.mjs
// This file defines browser-side php Open Dashboard Config logic for the Nodevision UI. It renders interface components and handles user interactions.
// Open PHP editor dashboard configuration panel from Nodevision toolbar.
export default function phpOpenDashboardConfig() {
  window.dispatchEvent(new CustomEvent("nv-php-editor-command", {
    detail: { command: "dashboard-config" }
  }));
}
