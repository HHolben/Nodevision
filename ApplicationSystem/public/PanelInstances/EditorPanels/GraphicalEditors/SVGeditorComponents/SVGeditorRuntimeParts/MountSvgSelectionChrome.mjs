// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/MountSvgSelectionChrome.mjs
// This module implements mount Svg Selection Chrome behavior for the SVGeditorRuntime feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { createSvgEl } from "../svgDom.mjs";
import { SVG_UI_ATTR } from "./CreateBlankSvgRoot.mjs";

// Mount Svg Selection Chrome operations.
export function mountSvgSelectionChrome(scope) {
  scope.svgSession.overlayLayer = createSvgEl("g", {
    [SVG_UI_ATTR]: "overlay"
  });
  scope.svgSession.overlayLayer.style.pointerEvents = "none";
  scope.svgSession.selectionBox = createSvgEl("rect", {
    [SVG_UI_ATTR]: "selection-box",
    fill: "none",
    stroke: "#2f80ff",
    "stroke-width": "1",
    "stroke-dasharray": "6 4",
    display: "none"
  });
  scope.svgSession.marqueeBox = createSvgEl("rect", {
    [SVG_UI_ATTR]: "marquee-box",
    fill: "rgba(47,128,255,0.12)",
    stroke: "#2f80ff",
    "stroke-width": "1",
    "stroke-dasharray": "3 3",
    display: "none"
  });
  scope.svgSession.selectionBox.style.pointerEvents = "none";
  scope.svgSession.marqueeBox.style.pointerEvents = "none";
  scope.svgSession.rotationOriginMarker = createSvgEl("g", {
    [SVG_UI_ATTR]: "rotation-origin-marker",
    display: "none"
  });
  scope.svgSession.rotationOriginMarker.style.pointerEvents = "none";
  scope.svgSession.rotationOriginRing = createSvgEl("circle", {
    fill: "rgba(255,255,255,0.92)",
    stroke: "#f97316"
  });
  scope.svgSession.rotationOriginHorizontal = createSvgEl("line", {
    stroke: "#f97316",
    "stroke-linecap": "round"
  });
  scope.svgSession.rotationOriginVertical = createSvgEl("line", {
    stroke: "#f97316",
    "stroke-linecap": "round"
  });
  scope.svgSession.rotationOriginMarker.append(scope.svgSession.rotationOriginRing, scope.svgSession.rotationOriginHorizontal, scope.svgSession.rotationOriginVertical);
  scope.svgSession.lineStartHandle = scope.svgSession.createOverlayHandle("circle", {
    r: "5"
  });
  scope.svgSession.lineEndHandle = scope.svgSession.createOverlayHandle("circle", {
    r: "5"
  });
  scope.svgSession.resizeHandles = {
    nw: scope.svgSession.createOverlayHandle("rect", {
      width: "8",
      height: "8",
      rx: "1.5",
      ry: "1.5"
    }),
    ne: scope.svgSession.createOverlayHandle("rect", {
      width: "8",
      height: "8",
      rx: "1.5",
      ry: "1.5"
    }),
    se: scope.svgSession.createOverlayHandle("rect", {
      width: "8",
      height: "8",
      rx: "1.5",
      ry: "1.5"
    }),
    sw: scope.svgSession.createOverlayHandle("rect", {
      width: "8",
      height: "8",
      rx: "1.5",
      ry: "1.5"
    })
  };
  scope.svgSession.resizeHandles.nw.style.cursor = "nwse-resize";
  scope.svgSession.resizeHandles.se.style.cursor = "nwse-resize";
  scope.svgSession.resizeHandles.ne.style.cursor = "nesw-resize";
  scope.svgSession.resizeHandles.sw.style.cursor = "nesw-resize";
  scope.svgSession.overlayLayer.appendChild(scope.svgSession.selectionBox);
  scope.svgSession.overlayLayer.appendChild(scope.svgSession.marqueeBox);
  scope.svgSession.overlayLayer.appendChild(scope.svgSession.rotationOriginMarker);
  scope.svgSession.overlayLayer.appendChild(scope.svgSession.lineStartHandle);
  scope.svgSession.overlayLayer.appendChild(scope.svgSession.lineEndHandle);
  Object.values(scope.svgSession.resizeHandles).forEach(handle => scope.svgSession.overlayLayer.appendChild(handle));
  scope.svgSession.lineToolPreviewLine = createSvgEl("line", {
    [SVG_UI_ATTR]: "line-tool-preview-line",
    fill: "none",
    stroke: "#2f80ff",
    "stroke-width": "1.5",
    display: "none"
  });
  scope.svgSession.lineToolPreviewLine.style.pointerEvents = "none";
  scope.svgSession.lineToolPreviewEnd = createSvgEl("circle", {
    [SVG_UI_ATTR]: "line-tool-preview-end",
    r: "3",
    fill: "#ffffff",
    stroke: "#2f80ff",
    "stroke-width": "1.5",
    display: "none"
  });
  scope.svgSession.lineToolPreviewEnd.style.pointerEvents = "none";
  scope.svgSession.lineToolAngleArc = createSvgEl("path", {
    [SVG_UI_ATTR]: "line-tool-angle-arc",
    fill: "none",
    stroke: "#2f80ff",
    "stroke-width": "0.05",
    "stroke-dasharray": "1 4",
    "stroke-linecap": "round",
    display: "none"
  });
  scope.svgSession.lineToolAngleArc.style.pointerEvents = "none";
}
