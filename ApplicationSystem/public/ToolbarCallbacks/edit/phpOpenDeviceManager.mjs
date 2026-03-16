// Nodevision/ApplicationSystem/public/ToolbarCallbacks/edit/phpOpenDeviceManager.mjs
// This file defines browser-side php Open Device Manager logic for the Nodevision UI. It renders interface components and handles user interactions.
// Open PHP editor device manager panel from Nodevision toolbar.
export default function phpOpenDeviceManager() {
  window.dispatchEvent(new CustomEvent("nv-php-editor-command", {
    detail: { command: "device-manager" }
  }));
}
