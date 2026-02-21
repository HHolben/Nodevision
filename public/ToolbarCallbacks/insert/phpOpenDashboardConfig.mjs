// Open PHP editor dashboard configuration panel from Insert toolbar.
export default function phpOpenDashboardConfig() {
  window.dispatchEvent(new CustomEvent("nv-php-editor-command", {
    detail: { command: "dashboard-config" }
  }));
}
