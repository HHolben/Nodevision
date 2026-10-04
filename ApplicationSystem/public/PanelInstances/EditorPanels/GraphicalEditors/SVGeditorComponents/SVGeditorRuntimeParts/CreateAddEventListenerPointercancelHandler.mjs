// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/CreateAddEventListenerPointercancelHandler.mjs
// This module implements create Add Event Listener Pointercancel Handler behavior for the SVGeditorRuntime feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { toSvgPoint } from "../svgDom.mjs";
import { resolveEditorHookSavePath } from "./ParseEditableSvgRoot.mjs";

// Create Add Event Listener Pointercancel Handler operations.
export function createAddEventListenerPointercancelHandler(owner) {
  return e => {
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
    const response = await fetch("/api/save", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        path: targetPath,
        sourcePath: owner.filePath,
        content
      })
    });
    if (!response.ok) {
      let detail = response.statusText || `HTTP ${response.status}`;
      try {
        const data = await response.json();
        detail = data?.error || detail;
      } catch {
        // Keep the HTTP status text.
      }
      throw new Error(detail);
    }
    owner.svgSession.markDocumentDirty(false);
    owner.svgSession.setStatus("Saved: " + targetPath);
  };
}
