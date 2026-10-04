// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/MountSvgDrawingChrome.mjs
// This module implements mount Svg Drawing Chrome behavior for the SVGeditorRuntime feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { createSvgEl, toSvgPoint } from "../svgDom.mjs";
import { SVG_UI_ATTR } from "./CreateBlankSvgRoot.mjs";
import { createSvgChrome } from "../SvgChrome.mjs";
import { createSvgUndoStack } from "../SvgUndoStack.mjs";
import { createBezierToolController } from "../BezierToolController.mjs";

// Mount Svg Drawing Chrome operations.
export function mountSvgDrawingChrome(scope) {
  scope.svgSession.lineToolLengthLabel = createSvgEl("text", {
    [SVG_UI_ATTR]: "line-tool-length-label",
    fill: "#ffffff",
    "font-family": "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial",
    "font-size": "12",
    "font-weight": "700",
    "stroke": "#000000",
    "stroke-width": "0.75",
    "paint-order": "stroke fill",
    "text-anchor": "start",
    display: "none"
  });
  scope.svgSession.lineToolLengthLabel.style.pointerEvents = "none";
  scope.svgSession.lineToolLengthLabel.style.mixBlendMode = "normal";
  scope.svgSession.lineToolAngleLabel = createSvgEl("text", {
    [SVG_UI_ATTR]: "line-tool-angle-label",
    fill: "#ffffff",
    "font-family": "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial",
    "font-size": "12",
    "font-weight": "700",
    "stroke": "#000000",
    "stroke-width": "0.75",
    "paint-order": "stroke fill",
    "text-anchor": "start",
    display: "none"
  });
  scope.svgSession.lineToolAngleLabel.style.pointerEvents = "none";
  scope.svgSession.lineToolAngleLabel.style.mixBlendMode = "normal";
  scope.svgSession.shapeToolPreviewCircle = createSvgEl("circle", {
    [SVG_UI_ATTR]: "shape-tool-preview-circle",
    fill: "rgba(47,128,255,0.08)",
    stroke: "#2f80ff",
    "stroke-width": "1.5",
    "stroke-dasharray": "5 4",
    display: "none"
  });
  scope.svgSession.shapeToolPreviewCircle.style.pointerEvents = "none";
  scope.svgSession.shapeToolPreviewPath = createSvgEl("path", {
    [SVG_UI_ATTR]: "shape-tool-preview-arc",
    fill: "none",
    stroke: "#2f80ff",
    "stroke-width": "1.5",
    "stroke-dasharray": "5 4",
    display: "none"
  });
  scope.svgSession.shapeToolPreviewPath.style.pointerEvents = "none";
  scope.svgSession.lineToolVertexMarkerLayer = createSvgEl("g", {
    [SVG_UI_ATTR]: "line-tool-vertex-markers"
  });
  scope.svgSession.lineToolVertexMarkerLayer.style.setProperty("pointer-events", "none", "important");
  scope.svgSession.overlayLayer.appendChild(scope.svgSession.lineToolAngleArc);
  scope.svgSession.overlayLayer.appendChild(scope.svgSession.lineToolPreviewLine);
  scope.svgSession.overlayLayer.appendChild(scope.svgSession.lineToolPreviewEnd);
  scope.svgSession.overlayLayer.appendChild(scope.svgSession.shapeToolPreviewCircle);
  scope.svgSession.overlayLayer.appendChild(scope.svgSession.shapeToolPreviewPath);
  scope.svgSession.overlayLayer.appendChild(scope.svgSession.lineToolVertexMarkerLayer);
  scope.svgSession.overlayLayer.appendChild(scope.svgSession.lineToolLengthLabel);
  scope.svgSession.overlayLayer.appendChild(scope.svgSession.lineToolAngleLabel);
  scope.svgSession.brushCursor = createSvgEl("circle", {
    [SVG_UI_ATTR]: "brush-cursor",
    "data-nv-brush-cursor": "true",
    fill: "none",
    stroke: "rgba(17,24,39,0.72)",
    "stroke-width": "1",
    display: "none"
  });
  scope.svgSession.brushCursor.style.pointerEvents = "none";
  scope.svgSession.overlayLayer.appendChild(scope.svgSession.brushCursor);

  // === Bezier tool preview ===
  scope.svgSession.bezierToolPreviewPath = createSvgEl("path", {
    [SVG_UI_ATTR]: "bezier-tool-preview",
    fill: "none",
    stroke: "#2f80ff",
    "stroke-width": "1.5",
    display: "none"
  });
  scope.svgSession.bezierToolPreviewPath.style.pointerEvents = "none";
  scope.svgSession.overlayLayer.appendChild(scope.svgSession.bezierToolPreviewPath);
  scope.svgSession.chrome = createSvgChrome(scope.svgSession.svgRoot, scope.svgSession.svgViewportHost, scope.svgSession.overlayLayer);
  scope.svgSession.history = createSvgUndoStack(120); // Bezier creation + node editing controllers
  scope.svgSession.bezierController = createBezierToolController({
    svgRoot: scope.svgSession.svgRoot,
    overlayPath: scope.svgSession.bezierToolPreviewPath,
    currentStyleDefaults: scope.svgSession.currentStyleDefaults,
    pointerToleranceInSvgUnits: scope.svgSession.pointerToleranceInSvgUnits,
    findNearestSnapPointInRoot: scope.svgSession.findNearestSnapPointInRoot,
    snapAngleEndpointInRoot: scope.svgSession.snapAngleEndpointInRoot,
    rootPointToElementPoint: scope.svgSession.rootPointToElementPoint,
    toRootPoint: (clientX, clientY) => toSvgPoint(scope.svgSession.svgRoot, clientX, clientY),
    setSelection: scope.svgSession.setSelection,
    setStatus: scope.svgSession.setStatus,
    getActiveLayer: scope.svgSession.getActiveLayer,
    history: scope.svgSession.history,
    focusEditor: () => {
      try {
        scope.svgSession.wrapper.focus({
          preventScroll: true
        });
      } catch {
        try {
          scope.svgSession.wrapper.focus();
        } catch {}
      }
    }
  });
}
