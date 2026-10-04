// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/CreateSvgCoreContext.mjs
// This module implements create Svg Core Context behavior for the SVGeditorRuntime feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { reparentSvgElement } from "../../ElementLayers/reparent.mjs";
import { getBrushPresets as listBrushPresets } from "../VectorBrushPresets.mjs";
import { expandSymmetryClones } from "../SymmetryGenerator.mjs";
import { addMask, addClipPath, useSelectedObjectAsMask, useSelectedObjectAsClipPath, setMaskOrClipEnabled, detachMaskOrClip, releaseClipPath } from "../SvgMaskClipCommands.mjs";

// Create Svg Core Context operations.
export function createSvgCoreContext(owner) {
  return () => ({
    kind: "svg",
    filePath: owner.filePath,
    svgRoot: owner.svgSession.svgRoot,
    activate: owner.svgSession.activateSvgEditorContext,
    getEditorHTML: owner.svgSession.serializeSvgForSave,
    setEditorHTML: owner.svgSession.setSvgFromString,
    dirty: owner.svgSession.svgDocumentDirty,
    isDirty() {
      return owner.svgSession.svgDocumentDirty;
    },
    layers: owner.svgSession.layersMgr,
    reparentLayerElement(element, target, before = null) {
      const action = reparentSvgElement(owner.svgSession.svgRoot, element, target, before);
      if (!action) return false;
      owner.svgSession.history.pushCustom({
        kind: "layer-reparent",
        undo: action.undo,
        redo: action.redo
      });
      owner.svgSession.markDocumentDirty(true);
      owner.svgSession.setSelection([element], {
        primary: element
      });
      return true;
    },
    setMode: owner.svgSession.setMode,
    getMode() {
      return owner.svgSession.toolState.mode;
    },
    undo: owner.svgSession.undoSvgHistory,
    redo: owner.svgSession.redoSvgHistory,
    createBackgroundAppearanceAdapter: owner.svgSession.createSvgBackgroundAppearanceAdapter,
    openBackgroundAppearance: owner.svgSession.openSvgBackgroundAppearanceOverlay,
    recordSvgSnapshot(label, operation) {
      return owner.svgSession.runSvgSnapshotOperation(label, operation);
    },
    getDrawingAssistSettings() {
      return {
        ...owner.svgSession.drawingAssistSettings
      };
    },
    setDrawingAssistSettings(patch = {}) {
      return owner.svgSession.refreshDrawingAssistSettings(patch);
    },
    getBrushPresets() {
      return listBrushPresets(window.NodevisionVectorBrushPresets || []);
    },
    getCurrentBrushPreset() {
      return owner.svgSession.currentBrushPreset();
    },
    debugLineToolState() {
      return {
        active: Boolean(owner.svgSession.lineToolState.active),
        pointCount: Array.isArray(owner.svgSession.lineToolState.pointsSpace) ? owner.svgSession.lineToolState.pointsSpace.length : 0,
        placedLineCount: Array.isArray(owner.svgSession.lineToolState.placedLines) ? owner.svgSession.lineToolState.placedLines.length : 0,
        vertexMarkerCount: Array.isArray(owner.svgSession.lineToolState.vertexMarkers) ? owner.svgSession.lineToolState.vertexMarkers.filter(marker => marker?.isConnected).length : 0,
        startRoot: owner.svgSession.lineToolState.startRoot ? {
          x: owner.svgSession.lineToolState.startRoot.x,
          y: owner.svgSession.lineToolState.startRoot.y
        } : null,
        cursorRoot: owner.svgSession.lineToolState.cursorRoot ? {
          x: owner.svgSession.lineToolState.cursorRoot.x,
          y: owner.svgSession.lineToolState.cursorRoot.y
        } : null
      };
    },
    showQuickMenu(clientX = null, clientY = null) {
      const rect = owner.svgSession.svgRoot.getBoundingClientRect();
      owner.svgSession.quickMenu.show(clientX ?? rect.left + 48, clientY ?? rect.top + 48, owner.svgSession.drawingAssistSettings);
    },
    insertGuidesIntoSvg() {
      return owner.svgSession.runSvgSnapshotOperation("insert-guides", () => owner.svgSession.drawingGuidesController.insertGuidesIntoSvg());
    },
    expandSymmetrySelection() {
      return owner.svgSession.runSvgSnapshotOperation("expand-symmetry", () => expandSymmetryClones(owner.svgSession.selectedElements));
    },
    addMask() {
      return owner.svgSession.runSvgSnapshotOperation("add-mask", () => addMask(owner.svgSession.svgRoot, owner.svgSession.selectedElements.length ? owner.svgSession.selectedElements : [owner.svgSession.getActiveLayer()].filter(Boolean)));
    },
    addClippingPath() {
      return owner.svgSession.runSvgSnapshotOperation("add-clip-path", () => addClipPath(owner.svgSession.svgRoot, owner.svgSession.selectedElements.length ? owner.svgSession.selectedElements : [owner.svgSession.getActiveLayer()].filter(Boolean)));
    },
    useSelectedObjectAsMask() {
      return owner.svgSession.runSvgSnapshotOperation("use-selected-mask", () => useSelectedObjectAsMask(owner.svgSession.svgRoot, owner.svgSession.selectedElements));
    },
    useSelectedObjectAsClippingPath() {
      return owner.svgSession.runSvgSnapshotOperation("use-selected-clip-path", () => useSelectedObjectAsClipPath(owner.svgSession.svgRoot, owner.svgSession.selectedElements));
    },
    disableSelectedMaskOrClip(attr = "mask") {
      return owner.svgSession.runSvgSnapshotOperation("disable-mask-clip", () => setMaskOrClipEnabled(owner.svgSession.selectedElements, attr, false));
    },
    enableSelectedMaskOrClip(attr = "mask") {
      return owner.svgSession.runSvgSnapshotOperation("enable-mask-clip", () => setMaskOrClipEnabled(owner.svgSession.selectedElements, attr, true));
    },
    detachSelectedMaskOrClip(attr = "mask") {
      return owner.svgSession.runSvgSnapshotOperation("detach-mask-clip", () => detachMaskOrClip(owner.svgSession.svgRoot, owner.svgSession.selectedElements, attr));
    },
    releaseSelectedClipPath() {
      return owner.svgSession.runSvgSnapshotOperation("release-clip-path", () => releaseClipPath(owner.svgSession.svgRoot, owner.svgSession.selectedElements));
    },
    editSelectedMask() {
      return owner.svgSession.beginMaskOrClipEdit("mask");
    }
  });
}
