// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/CreateSvgMaskAndSketchContext.mjs
// This module implements create Svg Mask And Sketch Context behavior for the SVGeditorRuntime feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

// Create Svg Mask And Sketch Context operations.
export function createSvgMaskAndSketchContext(owner) {
  return () => ({
    editSelectedClippingPath() {
      return owner.svgSession.beginMaskOrClipEdit("clip-path");
    },
    editArtwork() {
      return owner.svgSession.editArtworkFromMaskEdit();
    },
    invertSelectedMask() {
      return owner.svgSession.invertSelectedMaskCommand();
    },
    getMaskEditState() {
      return owner.svgSession.maskEditState ? {
        kind: owner.svgSession.maskEditState.kind,
        id: owner.svgSession.maskEditState.id
      } : null;
    },
    insertShape: owner.svgSession.insertShape,
    insertInternalPng: owner.svgSession.insertInternalPng,
    insertImageFromInsertion: owner.svgSession.insertImageFromInsertion,
    replaceSelectedInternalPng: owner.svgSession.replaceSelectedInternalPng,
    editSelectedInternalPng: owner.svgSession.editSelectedInternalPng,
    exportSelectedInternalPng: owner.svgSession.exportSelectedInternalPng,
    editSelectedImageHere: owner.svgSession.editSelectedImageHere,
    toggleSelectedImageInlineEditor: owner.svgSession.editSelectedImageHere,
    openSelectedImageEditorUndocked: owner.svgSession.editSelectedImageHere,
    toggleLayersPanel: owner.svgSession.toggleLayersPanel,
    setLayersPanelVisible: owner.svgSession.setLayersPanelVisible,
    isLayersPanelVisible() {
      return Boolean(owner.svgSession.layersPanelHost && owner.svgSession.layersPanelHost.isConnected);
    },
    getCanvasSize: owner.svgSession.getCanvasSize,
    resizeCanvas: owner.svgSession.resizeCanvas,
    canCrop() {
      return Boolean(owner.svgSession.selectedElement && owner.svgSession.selectedElement !== owner.svgSession.svgRoot);
    },
    cropEdges: owner.svgSession.cropEdges,
    rotate90CW() {
      return owner.svgSession.rotateCanvas90("cw");
    },
    rotate90CCW() {
      return owner.svgSession.rotateCanvas90("ccw");
    },
    flipHorizontal() {
      return owner.svgSession.flipCanvas("h");
    },
    flipVertical() {
      return owner.svgSession.flipCanvas("v");
    },
    finalizeSketch() {
      const element = owner.svgSession.sketchController.finalizeSketch();
      if (element) {
        window.NodevisionState = window.NodevisionState || {};
        window.NodevisionState.svgDrawTool = "select";
        owner.svgSession.setMode("select");
        owner.svgSession.setSelection([element], {
          primary: element
        });
      }
      return element;
    },
    renderSketchPreview(previewId, options = {}) {
      return owner.svgSession.sketchController.renderSketchPreview(previewId, options);
    },
    renderVisibleSketchPreviews(options = {}) {
      return owner.svgSession.sketchController.renderVisibleSketchPreviews(options);
    },
    clearSketch() {
      return owner.svgSession.sketchController.clearSketch();
    },
    cancelSketchMode() {
      window.NodevisionState.svgDrawTool = "select";
      return owner.svgSession.sketchController.cancelSketchMode();
    },
    undoSketchStroke() {
      return owner.svgSession.sketchController.undoLastStroke();
    },
    toggleKeepSketchConstruction(nextValue) {
      return owner.svgSession.sketchController.setKeepConstruction(nextValue);
    },
    toggleSketchConstructionVisibility(forceValue) {
      return owner.svgSession.sketchController.toggleConstructionVisibility(forceValue);
    },
    setSketchRoughOpacity(value) {
      return owner.svgSession.sketchController.setRoughOpacity(value);
    },
    setSketchSmoothingLevel(value) {
      return owner.svgSession.sketchController.setSmoothingLevel(value);
    },
    setSketchStrokeOrderColors(value) {
      return owner.svgSession.sketchController.setStrokeOrderColorsEnabled(value);
    },
    getSketchStrokeOrderColors() {
      return owner.svgSession.sketchController.getStrokeOrderColorsEnabled();
    },
    setSketchPredictionMode(mode, options = {}) {
      return owner.svgSession.sketchController.setPredictionMode(mode, options);
    },
    getSketchPredictionMode() {
      return owner.svgSession.sketchController.getPredictionMode();
    },
    beginSketchFocalPointPlacement() {
      const begin = owner.svgSession.sketchController.beginFocalPointPlacement || owner.svgSession.sketchController.beginSetFocalPoint;
      return typeof begin === "function" ? begin.call(owner.svgSession.sketchController) : false;
    }
  });
}
