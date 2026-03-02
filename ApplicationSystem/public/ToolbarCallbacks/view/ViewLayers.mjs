// Toggle SVG editor layers panel from View toolbar.

export default function ViewLayers() {
  if (!window.SVGEditorContext?.layers) {
    console.warn("ViewLayers: SVG editor context not available.");
    return;
  }

  const detail = {
    id: "SVGLayersPanel",
    type: "InfoPanel",
    replaceActive: true,
  };
  window.dispatchEvent(new CustomEvent("toolbarAction", { detail }));
}
