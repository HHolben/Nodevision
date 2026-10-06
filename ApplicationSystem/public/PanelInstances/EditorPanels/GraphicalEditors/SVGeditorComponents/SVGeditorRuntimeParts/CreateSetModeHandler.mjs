// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/CreateSetModeHandler.mjs
// This module implements create Set Mode Handler behavior for the SVGeditorRuntime feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { clearSvgMarquee } from "./ClearSvgMarquee.mjs";

import { SVG_TOOL_MODES } from "./CreateBlankSvgRoot.mjs";
import { setActiveTool } from "../../../../../EditorAttentionState.mjs";
import { getAttrNumber, parsePoints } from "../svgDom.mjs";

// Create Set Mode Handler operations.
export function createSetModeHandler(owner) {
  return function (mode) {
    if (mode !== owner.svgSession.toolState.mode) clearSvgMarquee(owner.svgSession);
    if (owner.svgSession.selectionGrabState && mode !== "select") owner.svgSession.commitSelectionGrabCommand({
      silent: true
    });
    if (owner.svgSession.pendingRotateCommand && mode !== "rotate") owner.svgSession.commitPendingRotationCommand({
      silent: true
    });
    if (owner.svgSession.toolState.mode === "freehand" && mode !== "freehand" && owner.svgSession.freehandStrokeState) {
      owner.svgSession.cancelFreehandStroke();
    }
    if (owner.svgSession.toolState.mode === "sketch" && mode !== "sketch") {
      owner.svgSession.sketchController.onModeExit();
    }
    if (owner.svgSession.toolState.mode === "line" && mode !== "line") {
      if (owner.svgSession.lineToolState.active) owner.svgSession.finishLineTool();else owner.svgSession.clearLineToolState();
    }
    if ((owner.svgSession.toolState.mode === "circle" || owner.svgSession.toolState.mode === "arc") && mode !== owner.svgSession.toolState.mode) {
      owner.svgSession.clearShapeToolState();
    }
    if (owner.svgSession.toolState.mode === "bezier" && mode !== "bezier") {
      // Only tear down the live bezier session when a path is mid-draw; if the user
      // already finished (Enter), leave the completed path in place.
      if (owner.svgSession.bezierController.isActive()) {
        owner.svgSession.bezierController.reset();
      }
    }
    if (mode !== "select" && owner.svgSession.nodeEditor.isActive?.()) {
      owner.svgSession.nodeEditor.exit?.();
    }
    if (SVG_TOOL_MODES.has(mode)) {
      window.NodevisionState = window.NodevisionState || {};
      window.NodevisionState.svgDrawTool = mode;
    }
    owner.svgSession.toolState.mode = mode;
    setActiveTool(mode, `${String(mode).replace(/[-_]+/g, " ").replace(/\b\w/g, char => char.toUpperCase())} Tool`);
    try {
      window.dispatchEvent(new CustomEvent("nv-contextual-cursor-family-changed", {
        detail: {
          providerId: "svg-cursor-tools",
          mode
        }
      }));
    } catch {
      // Toolbar cursor-family updates are best-effort; editor mode changes should still succeed.
    }
    owner.svgSession.toolState.drawing = false;
    owner.svgSession.toolState.tempShape = null;
    owner.svgSession.toolState.startPoint = null;
    owner.svgSession.toolState.bezierStep = 0;
    owner.svgSession.toolState.bezierPoints = [];
    if (mode === "sketch") {
      owner.svgSession.clearSelection();
      owner.svgSession.sketchController.onModeEnter();
    }
    const cursor = mode === "select" ? "default" : mode === "rotate" ? "grab" : "crosshair";
    owner.svgSession.svgRoot.style.cursor = mode === "eyedropper" ? "copy" : mode === "eraser" ? "not-allowed" : cursor;
    owner.svgSession.updateBrushCursor(owner.svgSession.lastPointerRoot);
    try {
      owner.svgSession.wrapper.focus({
        preventScroll: true
      });
    } catch {
      try {
        owner.svgSession.wrapper.focus();
      } catch {
        // ignore
      }
    }
    owner.svgSession.setStatus(`Tool: ${mode}`);
  };
}

export function createGetDragBaseForElementHandler(owner) {
  return function (el) {
    const rotationOriginLocal = owner.svgSession.getStoredRotationOriginLocal(el);
    const withOrigin = base => rotationOriginLocal ? {
      ...base,
      rotationOriginLocal: {
        ...rotationOriginLocal
      }
    } : base;
    const baseTransform = String(el.getAttribute("transform") || "").trim();
    if (baseTransform) {
      return withOrigin({
        kind: "transform",
        baseTransform
      });
    }
    const tag = el.tagName.toLowerCase();
    if (tag === "rect" || tag === "image" || tag === "use" || tag === "foreignobject") {
      return withOrigin({
        kind: "xy",
        x: getAttrNumber(el, "x", 0),
        y: getAttrNumber(el, "y", 0)
      });
    }
    if (tag === "text") {
      return withOrigin({
        kind: "xy",
        x: getAttrNumber(el, "x", 0),
        y: getAttrNumber(el, "y", 0)
      });
    }
    if (tag === "circle" || tag === "ellipse") {
      return withOrigin({
        kind: "cxy",
        cx: getAttrNumber(el, "cx", 0),
        cy: getAttrNumber(el, "cy", 0)
      });
    }
    if (tag === "line") {
      return withOrigin({
        kind: "line",
        x1: getAttrNumber(el, "x1", 0),
        y1: getAttrNumber(el, "y1", 0),
        x2: getAttrNumber(el, "x2", 0),
        y2: getAttrNumber(el, "y2", 0)
      });
    }
    if (tag === "polygon" || tag === "polyline") {
      return withOrigin({
        kind: "points",
        points: parsePoints(el.getAttribute("points") || "")
      });
    }
    return withOrigin({
      kind: "transform",
      baseTransform: ""
    });
  };
}
