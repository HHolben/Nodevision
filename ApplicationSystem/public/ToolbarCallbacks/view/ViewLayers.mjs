// Nodevision/ApplicationSystem/public/ToolbarCallbacks/view/ViewLayers.mjs
// This file defines browser-side View Layers logic for the Nodevision UI. It renders interface components and handles user interactions.
// Toggle Layers panel from View toolbar (supports SVG + HTML contexts).

export default function ViewLayers() {
  const hasContext =
    window.SVGEditorContext?.layers ||
    window.HTMLLayersContext?.attachHost ||
    window.HTMLViewLayersContext?.attachHost;

  if (!hasContext) {
    alert("Open an SVG or HTML document to use the Layers panel.");
    return;
  }

  const detail = {
    id: "SVGLayersPanel",
    type: "InfoPanel",
    replaceActive: true,
  };
  window.dispatchEvent(new CustomEvent("toolbarAction", { detail }));
}
