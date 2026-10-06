// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/CreateAddEventListenerPointercancelHandler.mjs
// This module implements create Add Event Listener Pointercancel Handler behavior for the SVGeditorRuntime feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { saveSvgRequest } from "../../../../../FileInterop/SvgSaveRecovery.mjs";
import { clearSvgMarquee } from "./ClearSvgMarquee.mjs";

import { toSvgPoint } from "../svgDom.mjs";
import { resolveEditorHookSavePath } from "./ParseEditableSvgRoot.mjs";

// Create Add Event Listener Pointercancel Handler operations.
export function createAddEventListenerPointercancelHandler(owner) {
  return e => {
    clearSvgMarquee(owner.svgSession, e.pointerId);
    owner.svgSession.quickMenu.cancelLongPress();
    owner.svgSession.cancelEyedropperHold();
    if (owner.svgSession.toolState.mode === "freehand" && owner.svgSession.freehandStrokeState?.pointerId === e.pointerId) {
      owner.svgSession.cancelFreehandStroke();
      try {
        owner.svgSession.svgRoot.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore unsupported pointer capture errors.
      }
      return;
    }
    if (owner.svgSession.toolState.mode === "sketch") {
      const endRoot = toSvgPoint(owner.svgSession.svgRoot, e.clientX, e.clientY);
      if (!owner.svgSession.sketchController.onPointerUp(e, endRoot)) return;
      owner.svgSession.toolState.drawing = owner.svgSession.sketchController.isDrawing();
      try {
        owner.svgSession.svgRoot.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore unsupported pointer capture errors.
      }
      return;
    }
    if ((owner.svgSession.toolState.mode === "circle" || owner.svgSession.toolState.mode === "arc") && owner.svgSession.shapeToolState.active) {
      owner.svgSession.cancelShapeTool();
      return;
    }
    if (owner.svgSession.rotateState && owner.svgSession.rotateState.pointerId === e.pointerId) {
      const wasPendingRotateDrag = Boolean(owner.svgSession.rotateState.command);
      owner.svgSession.rotateState = null;
      try {
        owner.svgSession.svgRoot.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore unsupported pointer capture errors.
      }
      if (wasPendingRotateDrag && owner.svgSession.pendingRotateCommand) {
        owner.svgSession.updatePendingRotationStatus("Rotate preview ready; Enter commits, Esc cancels");
      }
      return;
    }
    if (!owner.svgSession.toolState.drawing) return;
    owner.svgSession.toolState.drawing = false;
    owner.svgSession.toolState.tempShape = null;
    owner.svgSession.toolState.startPoint = null;
    try {
      owner.svgSession.svgRoot.releasePointerCapture(e.pointerId);
    } catch {
      // Ignore unsupported pointer capture errors.
    }
  };
}

export function createSaveWYSIWYGFileHandler(owner) {
  return async path => {
    const targetPath = resolveEditorHookSavePath("SVG Editor", owner.filePath, path);
    const content = owner.svgSession.serializeSvgForSave();
    if (!await saveSvgRequest({ path: targetPath, sourcePath: owner.filePath, content })) {
      owner.svgSession.markDocumentDirty(true);
      owner.svgSession.setStatus("Save failed: SVG exceeds the request size limit. Download a backup or keep editing.");
      return false;
    }
    owner.svgSession.markDocumentDirty(false);
    owner.svgSession.setStatus("Saved: " + targetPath);
    return true;
  };
}
