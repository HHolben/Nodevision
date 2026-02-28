// Open PHP editor device manager panel from Nodevision toolbar.
export default function phpOpenDeviceManager() {
  window.dispatchEvent(new CustomEvent("nv-php-editor-command", {
    detail: { command: "device-manager" }
  }));
}

