// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/InstallSvgPointerGeometry.mjs
// This module implements install Svg Pointer Geometry behavior for the SVGeditorRuntime feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { toSvgPoint } from "../svgDom.mjs";
import { createGetDragBaseForElementHandler } from "./CreateSetModeHandler.mjs";
import { createApplyDragDeltaToElementHandler, createBuildDragStateHandler, createUpdateDragFromClientHandler, createDistanceToGeometryStrokeInRootHandler } from "./CreateApplyDragDeltaToElementHandler.mjs";

// Install Svg Pointer Geometry operations.
export function installSvgPointerGeometry(scope) {
  scope.svgSession.isSvgGraphicsElement = function (el) {
    if (!el) return false;
    if (typeof SVGGraphicsElement !== "undefined") {
      return el instanceof SVGGraphicsElement;
    }
    return el instanceof SVGElement && typeof el.getScreenCTM === "function";
  };
  scope.svgSession.clientToElementPoint = function (element, clientX, clientY) {
    const ctm = element && typeof element.getScreenCTM === "function" ? element.getScreenCTM() : null;
    if (!ctm || typeof ctm.inverse !== "function") {
      return toSvgPoint(scope.svgSession.svgRoot, clientX, clientY);
    }
    try {
      const inv = ctm.inverse();
      const pt = typeof DOMPoint === "function" ? new DOMPoint(clientX, clientY).matrixTransform(inv) : {
        x: 0,
        y: 0
      };
      if (Number.isFinite(pt.x) && Number.isFinite(pt.y)) return {
        x: pt.x,
        y: pt.y
      };
    } catch {
      // ignore
    }
    return toSvgPoint(scope.svgSession.svgRoot, clientX, clientY);
  };
  scope.svgSession.getDragSpaceForElement = function (el) {
    const parent = el?.parentNode;
    if (scope.svgSession.isSvgGraphicsElement(parent)) return parent;
    return scope.svgSession.svgRoot;
  };
  scope.svgSession.getDragBaseForElement = createGetDragBaseForElementHandler({
    get svgSession() {
      return scope.svgSession;
    }
  });
  scope.svgSession.applyDragDeltaToElement = createApplyDragDeltaToElementHandler({
    get svgSession() {
      return scope.svgSession;
    }
  });
  scope.svgSession.buildDragState = createBuildDragStateHandler({
    get svgSession() {
      return scope.svgSession;
    }
  });
  scope.svgSession.updateDragFromClient = createUpdateDragFromClientHandler({
    get svgSession() {
      return scope.svgSession;
    }
  });
  scope.svgSession.isLayerGroupElement = function (el) {
    return Boolean(el?.getAttribute?.("data-layer") === "true");
  };
  scope.svgSession.shouldPreferGeometryHit = function (target) {
    if (!(target instanceof SVGElement)) return true;
    if (target === scope.svgSession.svgRoot || target === scope.svgSession.overlayLayer || target === scope.svgSession.selectionBox || target === scope.svgSession.marqueeBox) return true;
    const tag = target.tagName.toLowerCase();
    return tag === "svg" || tag === "g" || scope.svgSession.isLayerGroupElement(target);
  };
  scope.svgSession.allowsGeometryHitTesting = function (el) {
    let node = el;
    while (node && node !== scope.svgSession.svgRoot) {
      const attr = typeof node.getAttribute === "function" ? node.getAttribute("pointer-events") : null;
      const styleValue = node.style?.pointerEvents || "";
      const pointerEvents = String(attr || styleValue || "").trim().toLowerCase();
      if (pointerEvents === "none") return false;
      node = node.parentNode;
    }
    return true;
  };
  scope.svgSession.distanceToGeometryStrokeInRoot = createDistanceToGeometryStrokeInRootHandler({
    get svgSession() {
      return scope.svgSession;
    }
  });
  scope.svgSession.findNearestGeometryAtPoint = function (point, tolerance) {
    let hit = null;
    let bestDistance = Infinity;
    const geometryTags = new Set(["line", "path", "polyline", "polygon", "rect", "circle", "ellipse"]);
    scope.svgSession.getSelectableElements().forEach(el => {
      const tag = el.tagName.toLowerCase();
      if (!geometryTags.has(tag) || !scope.svgSession.allowsGeometryHitTesting(el)) return;
      const distance = scope.svgSession.distanceToGeometryStrokeInRoot(el, point, tolerance);
      if (distance <= tolerance && distance < bestDistance) {
        bestDistance = distance;
        hit = el;
      }
    });
    return hit;
  };
  scope.svgSession.setMarqueeBox = function (start, current) {
    const x = Math.min(start.x, current.x);
    const y = Math.min(start.y, current.y);
    const width = Math.abs(current.x - start.x);
    const height = Math.abs(current.y - start.y);
    scope.svgSession.marqueeBox.setAttribute("x", String(x));
    scope.svgSession.marqueeBox.setAttribute("y", String(y));
    scope.svgSession.marqueeBox.setAttribute("width", String(width));
    scope.svgSession.marqueeBox.setAttribute("height", String(height));
    scope.svgSession.marqueeBox.setAttribute("display", "");
    return {
      x,
      y,
      width,
      height
    };
  };
}
