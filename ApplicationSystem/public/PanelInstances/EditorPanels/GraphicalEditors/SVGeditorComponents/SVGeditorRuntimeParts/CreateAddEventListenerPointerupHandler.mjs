// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/CreateAddEventListenerPointerupHandler.mjs
// This module implements create Add Event Listener Pointerup Handler behavior for the SVGeditorRuntime feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { toSvgPoint } from "../svgDom.mjs";

// Create Add Event Listener Pointerup Handler operations.
export function createAddEventListenerPointerupHandler(owner) {
  return e => {
    owner.svgSession.quickMenu.cancelLongPress();
    owner.svgSession.cancelEyedropperHold();
    if (owner.svgSession.toolState.mode !== "sketch" && owner.svgSession.nodeEditor.onPointerUp?.(e)) return;
    if (owner.svgSession.lineHandleDragState && owner.svgSession.lineHandleDragState.pointerId === e.pointerId) {
      owner.svgSession.lineHandleDragState = null;
      try {
        owner.svgSession.svgRoot.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore unsupported pointer capture errors.
      }
      return;
    }
    if (owner.svgSession.resizeState && owner.svgSession.resizeState.pointerId === e.pointerId) {
      owner.svgSession.resizeState = null;
      try {
        owner.svgSession.svgRoot.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore unsupported pointer capture errors.
      }
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
    if (owner.svgSession.toolState.mode === "bezier" && owner.svgSession.bezierController.isActive()) {
      let endRoot = toSvgPoint(owner.svgSession.svgRoot, e.clientX, e.clientY);
      const model = owner.svgSession.bezierController.state?.model;
      const last = model?.nodes?.[model.nodes.length - 1];
      if (e.shiftKey && last) {
        const tol = owner.svgSession.pointerToleranceInSvgUnits(10);
        const snapped = owner.svgSession.findNearestSnapPointInRoot(endRoot, tol);
        endRoot = snapped || owner.svgSession.snapAngleEndpointInRoot(last, endRoot, Math.PI / 12);
      }
      owner.svgSession.bezierController.onPointerUp(e, endRoot);
      return;
    }
    if (owner.svgSession.toolState.mode === "select") {
      if (owner.svgSession.dragState && owner.svgSession.dragState.pointerId === e.pointerId) {
        owner.svgSession.dragState = null;
      }
      if (owner.svgSession.marqueeState && owner.svgSession.marqueeState.pointerId === e.pointerId) {
        owner.svgSession.marqueeState = null;
        owner.svgSession.marqueeBox.setAttribute("display", "none");
      }
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
      e.preventDefault();
      return;
    }
    if (owner.svgSession.toolState.mode === "freehand" && owner.svgSession.freehandStrokeState?.pointerId === e.pointerId) {
      owner.svgSession.appendFreehandSample(e, toSvgPoint(owner.svgSession.svgRoot, e.clientX, e.clientY));
      owner.svgSession.commitFreehandStroke({
        preferCorrection: true
      });
      try {
        owner.svgSession.svgRoot.releasePointerCapture(e.pointerId);
      } catch {
        // Ignore unsupported pointer capture errors.
      }
      e.preventDefault();
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
