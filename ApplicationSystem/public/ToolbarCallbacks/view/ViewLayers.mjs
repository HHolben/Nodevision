// Nodevision/ApplicationSystem/public/ToolbarCallbacks/view/ViewLayers.mjs
// This file defines browser-side View Layers logic for the Nodevision UI. The callback routes available layer providers through the shared panel.

export default function ViewLayers() {
  const hasContext =
    window.SVGEditorContext?.layers ||
    window.HTMLLayersContext?.attachHost ||
    window.HTMLViewLayersContext?.attachHost ||
    window.KMLLayersContext?.attachHost ||
    window.GLBLayersContext?.attachHost ||
    window.MetaWorldLayersContext?.attachHost ||
    window.SCADLayersContext?.attachHost;

  if (!hasContext) {
    alert("Open an SVG, HTML, KML, GLB, SCAD, or MetaWorld document to use the Layers panel.");
    return;
  }

  const detail = {
    id: "SVGLayersPanel",
    type: "InfoPanel",
    replaceActive: true,
  };
  window.dispatchEvent(new CustomEvent("toolbarAction", { detail }));
}
