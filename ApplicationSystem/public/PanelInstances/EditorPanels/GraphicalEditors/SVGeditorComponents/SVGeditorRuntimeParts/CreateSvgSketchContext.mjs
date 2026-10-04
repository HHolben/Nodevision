// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/CreateSvgSketchContext.mjs
// This module implements create Svg Sketch Context behavior for the SVGeditorRuntime feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

// Create Svg Sketch Context operations.
export function createSvgSketchContext(owner) {
  return () => ({
    setSketchMirrorX(value, options = {}) {
      return owner.svgSession.sketchController.setMirrorX(value, options);
    },
    setSketchMirrorY(value, options = {}) {
      return owner.svgSession.sketchController.setMirrorY(value, options);
    },
    getSketchMirrorX() {
      return owner.svgSession.sketchController.getMirrorX();
    },
    getSketchMirrorY() {
      return owner.svgSession.sketchController.getMirrorY();
    },
    endSketchCurveAndStartNew() {
      return owner.svgSession.sketchController.endCurveAndStartNew();
    },
    convertSketchPreviewToBezier() {
      const element = owner.svgSession.sketchController.convertPreviewToBezier();
      if (element) {
        owner.svgSession.setSelection([element], {
          primary: element
        });
        owner.svgSession.nodeEditor.enter(element);
      }
      return element;
    },
    finalizeSketchBezier() {
      const element = owner.svgSession.sketchController.finalizeBezierRefinement();
      if (element) {
        owner.svgSession.nodeEditor.exit?.();
        owner.svgSession.setSelection([element], {
          primary: element
        });
      }
      return element;
    },
    getSketchPreviews() {
      return owner.svgSession.sketchController.getSketchPreviews();
    },
    getActiveSketchPreviewId() {
      return owner.svgSession.sketchController.getActiveSketchPreviewId();
    },
    createSketchPreview(name = null, options = {}) {
      return owner.svgSession.sketchController.createSketchPreview(name, options);
    },
    setActiveSketchPreview(previewId) {
      return owner.svgSession.sketchController.setActiveSketchPreview(previewId);
    },
    renameSketchPreview(previewId, nextName) {
      return owner.svgSession.sketchController.renameSketchPreview(previewId, nextName);
    },
    setSketchPreviewVisible(previewId, visible) {
      return owner.svgSession.sketchController.setSketchPreviewVisible(previewId, visible);
    },
    toggleSketchPreviewVisible(previewId) {
      return owner.svgSession.sketchController.toggleSketchPreviewVisible(previewId);
    },
    setSketchPreviewLocked(previewId, locked) {
      return owner.svgSession.sketchController.setSketchPreviewLocked(previewId, locked);
    },
    toggleSketchPreviewLocked(previewId) {
      return owner.svgSession.sketchController.toggleSketchPreviewLocked(previewId);
    },
    clearSketchPreview(previewId, options = {}) {
      return owner.svgSession.sketchController.clearSketchPreview(previewId, options);
    },
    deleteSketchPreview(previewId) {
      return owner.svgSession.sketchController.deleteSketchPreview(previewId);
    },
    getSketchState() {
      const previews = owner.svgSession.sketchController.getSketchPreviews();
      return {
        strokeCount: owner.svgSession.sketchController.getStrokeCount(),
        previewPointCount: owner.svgSession.sketchController.getPreviewPointCount(),
        keepConstruction: owner.svgSession.sketchController.getKeepConstruction(),
        enableSketchStrokeOrderColors: owner.svgSession.sketchController.getStrokeOrderColorsEnabled(),
        predictionMode: owner.svgSession.sketchController.getPredictionMode(),
        mirrorX: owner.svgSession.sketchController.getMirrorX(),
        mirrorY: owner.svgSession.sketchController.getMirrorY(),
        previewCount: previews.length,
        activePreviewId: owner.svgSession.sketchController.getActiveSketchPreviewId(),
        drawing: owner.svgSession.sketchController.isDrawing()
      };
    },
    applyCurrentStyleToSelection() {
      return owner.svgSession.runSvgSnapshotOperation("apply-style", () => owner.svgSession.applyCurrentStyleToSelection());
    },
    setFillColor(value) {
      return owner.svgSession.runSvgSnapshotOperation("set-fill-color", () => {
        owner.svgSession.styleState.fill = String(value || owner.svgSession.styleState.fill || "#80c0ff");
        window.NodevisionState = window.NodevisionState || {};
        window.NodevisionState.svgLastEditedPaint = "fill";
        if (owner.svgSession.selectedElement) owner.svgSession.selectedElement.setAttribute("fill", owner.svgSession.styleState.fill);
        return true;
      });
    }
  });
}
