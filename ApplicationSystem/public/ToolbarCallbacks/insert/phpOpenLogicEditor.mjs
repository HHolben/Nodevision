// Open PHP editor logic block panel from Insert toolbar.
export default function phpOpenLogicEditor() {
  window.dispatchEvent(new CustomEvent("nv-php-editor-command", {
    detail: { command: "logic-editor" }
  }));
}
