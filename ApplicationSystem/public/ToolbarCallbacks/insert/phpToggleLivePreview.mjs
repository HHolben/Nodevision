// Toggle PHP editor live preview/runtime from Insert toolbar.
export default function phpToggleLivePreview() {
  window.dispatchEvent(new CustomEvent("nv-php-editor-command", {
    detail: { command: "toggle-preview" }
  }));
}
