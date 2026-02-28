// Open PHP editor data logging panel from Insert toolbar.
export default function phpOpenDataLogging() {
  window.dispatchEvent(new CustomEvent("nv-php-editor-command", {
    detail: { command: "data-logging" }
  }));
}
