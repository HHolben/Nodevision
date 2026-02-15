// Toggle SVG editor layers panel from View toolbar.

export default function ViewLayers() {
  if (window.SVGEditorContext?.toggleLayersPanel) {
    window.SVGEditorContext.toggleLayersPanel();
    return;
  }

  if (typeof window.toggleSVGLayersPanel === "function") {
    window.toggleSVGLayersPanel();
    return;
  }

  console.warn("ViewLayers: SVG editor context not available.");
}
