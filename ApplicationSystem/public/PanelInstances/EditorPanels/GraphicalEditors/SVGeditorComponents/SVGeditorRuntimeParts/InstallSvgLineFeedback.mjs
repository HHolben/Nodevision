// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/InstallSvgLineFeedback.mjs
// This module implements install Svg Line Feedback behavior for the SVGeditorRuntime feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { SVG_TOOL_MODES, SVG_UI_ATTR } from "./CreateBlankSvgRoot.mjs";
import { createSvgEl } from "../svgDom.mjs";
import { svgClickTraceMark } from "../../../../../SvgClickFeedbackTrace.mjs";
import { createAddLineToolVertexMarkerHandler, createCommitLineToolGeometryHandler, createFinishLineToolHandler } from "./PersistSvgAttention.mjs";

// Install Svg Line Feedback operations.
export function installSvgLineFeedback(scope) {
  scope.svgSession.syncModeFromToolbarState = function () {
    const desired = window.NodevisionState?.svgDrawTool;
    if (typeof desired !== "string" || !desired) return false;
    if (!SVG_TOOL_MODES.has(desired)) return false;
    if (desired === scope.svgSession.toolState.mode) return false;
    if (scope.svgSession.toolState.drawing || scope.svgSession.dragState || scope.svgSession.marqueeState || scope.svgSession.lineHandleDragState || scope.svgSession.resizeState || scope.svgSession.rotateState || scope.svgSession.selectionGrabState) return false;
    scope.svgSession.setMode(desired);
    return true;
  };
  scope.svgSession.createOverlayHandle = function (kind, attrs = {}) {
    const node = createSvgEl(kind, {
      [SVG_UI_ATTR]: "handle",
      fill: "#ffffff",
      stroke: "#2f80ff",
      "stroke-width": "1.5",
      display: "none",
      ...attrs
    });
    node.style.pointerEvents = "all";
    node.style.cursor = "pointer";
    return node;
  };
  scope.svgSession.recordLineProbe = function (label, detail = {}) {
    if (window.NodevisionSvgClickFeedbackTrace) svgClickTraceMark(label, detail);
    const probe = window.__nvSvgLinePointerProbe;
    if (!Array.isArray(probe)) return;
    try {
      probe.push({
        label,
        time: performance.now(),
        ...detail
      });
    } catch {
      // ignore probe failures
    }
  };
  scope.svgSession.clearLineToolSnapCache = function () {
    scope.svgSession.lineToolState.snapPointsRoot = null;
  };
  scope.svgSession.addLineToolSnapPoint = function (rootPoint) {
    if (!Array.isArray(scope.svgSession.lineToolState.snapPointsRoot) || !rootPoint) return;
    const x = Number(rootPoint.x);
    const y = Number(rootPoint.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    scope.svgSession.lineToolState.snapPointsRoot.push({
      x,
      y
    });
  };
  scope.svgSession.clearLineToolVertexMarkers = function () {
    scope.svgSession.lineToolState.vertexMarkers?.forEach(marker => {
      try {
        marker.remove();
      } catch {
        // ignore stale overlay cleanup
      }
    });
    scope.svgSession.lineToolState.vertexMarkers = [];
    scope.svgSession.lineToolVertexMarkerLayer.replaceChildren();
  };
  scope.svgSession.addLineToolVertexMarker = createAddLineToolVertexMarkerHandler({
    get svgSession() {
      return scope.svgSession;
    }
  });
  scope.svgSession.hideLineToolOverlays = function () {
    scope.svgSession.lineToolPreviewLine.setAttribute("display", "none");
    scope.svgSession.lineToolPreviewEnd.setAttribute("display", "none");
    scope.svgSession.lineToolAngleArc.setAttribute("display", "none");
    scope.svgSession.lineToolLengthLabel.setAttribute("display", "none");
    scope.svgSession.lineToolAngleLabel.setAttribute("display", "none");
  };
  scope.svgSession.setLineToolOverlayStyle = function (style) {
    const stroke = style?.stroke || "#2f80ff";
    const strokeWidth = style?.strokeWidth || "1.5";
    scope.svgSession.lineToolPreviewLine.setAttribute("stroke", stroke);
    scope.svgSession.lineToolPreviewLine.setAttribute("stroke-width", strokeWidth);
    scope.svgSession.lineToolPreviewEnd.setAttribute("stroke", stroke);
    scope.svgSession.lineToolPreviewEnd.setAttribute("stroke-width", strokeWidth);
    scope.svgSession.lineToolAngleArc.setAttribute("stroke", stroke);
  };
  scope.svgSession.clearLineToolState = function () {
    scope.svgSession.lineToolState.active = false;
    scope.svgSession.lineToolState.layer = null;
    scope.svgSession.lineToolState.startRoot = null;
    scope.svgSession.lineToolState.startSpace = null;
    scope.svgSession.lineToolState.lastPlacedRoot = null;
    scope.svgSession.lineToolState.lastPlacedSpace = null;
    scope.svgSession.lineToolState.pointsSpace = [];
    scope.svgSession.lineToolState.placedLines = [];
    scope.svgSession.lineToolState.cursorRoot = null;
    scope.svgSession.lineToolState.constraint = null;
    scope.svgSession.lineToolState.commandBuffer = "";
    if (scope.svgSession.lineToolState.commandTimer) window.clearTimeout(scope.svgSession.lineToolState.commandTimer);
    scope.svgSession.lineToolState.commandTimer = null;
    scope.svgSession.lineToolState.axisDistanceBuffer = "";
    scope.svgSession.lineToolState.angleInputBuffer = "";
    scope.svgSession.lineToolState.grab = null;
    scope.svgSession.clearLineToolSnapCache();
    scope.svgSession.clearLineToolVertexMarkers();
    scope.svgSession.hideLineToolOverlays();
  };
  scope.svgSession.commitLineToolGeometry = createCommitLineToolGeometryHandler({
    get svgSession() {
      return scope.svgSession;
    }
  });
  scope.svgSession.finishLineTool = createFinishLineToolHandler({
    get svgSession() {
      return scope.svgSession;
    }
  });
}
