// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/InstallSvgSelectionGeometry.mjs
// This module implements install Svg Selection Geometry behavior for the SVGeditorRuntime feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { createCropToSelectionHandler } from "./CreateActivateSvgEditorContextHandler.mjs";
import { SVG_UI_ATTR } from "./CreateBlankSvgRoot.mjs";
import { BACKGROUND_OWNER_ATTR } from "../SvgDocumentBackground.mjs";
import { createFindNearestSnapPointInRootHandler, createGetElementBBoxInRootHandler } from "./CreateFindNearestSnapPointInRootHandler.mjs";
import { createGetElementBBoxInSpaceHandler } from "./CreateGetElementBBoxInSpaceHandler.mjs";

// Install Svg Selection Geometry operations.
export function installSvgSelectionGeometry(scope) {
  scope.svgSession.setLayersPanelVisible = function (visible) {
    const show = Boolean(visible);
    if (show) {
      window.dispatchEvent(new CustomEvent("nv-show-subtoolbar", {
        detail: {
          heading: "View Layers",
          force: true,
          toggle: false
        }
      }));
      scope.svgSession.setStatus("Layer tools moved to sub-toolbar");
    }
    return show;
  };
  scope.svgSession.toggleLayersPanel = function () {
    window.dispatchEvent(new CustomEvent("nv-show-subtoolbar", {
      detail: {
        heading: "View Layers",
        force: true,
        toggle: true
      }
    }));
    scope.svgSession.setStatus("Layer tools moved to sub-toolbar");
    return true;
  };
  scope.svgSession.cropToSelection = createCropToSelectionHandler({
    get svgSession() {
      return scope.svgSession;
    }
  });
  scope.svgSession.isSelectableElement = function (el, options = {}) {
    if (!(el instanceof SVGElement) || !scope.svgSession.svgRoot.contains(el)) return false;
    if (el === scope.svgSession.svgRoot || el === scope.svgSession.overlayLayer || el === scope.svgSession.selectionBox || el === scope.svgSession.marqueeBox) return false;
    if (el.closest(`[${SVG_UI_ATTR}]`)) return false;
    if (el.closest(`[${BACKGROUND_OWNER_ATTR}="document"]`)) return false;
    if (!options.allowLocked && el.closest("[data-nv-locked='true']")) return false;
    const tag = el.tagName.toLowerCase();
    if (["defs", "desc", "metadata", "title"].includes(tag)) return false;
    return true;
  };
  scope.svgSession.getSelectableElements = function () {
    return Array.from(scope.svgSession.svgRoot.querySelectorAll("*")).filter(scope.svgSession.isSelectableElement);
  };
  scope.svgSession.applySvgMatrix = function (matrix, x, y) {
    return {
      x: matrix.a * x + matrix.c * y + matrix.e,
      y: matrix.b * x + matrix.d * y + matrix.f
    };
  };
  scope.svgSession.elementPointToRootPoint = function (el, x, y) {
    const elToScreen = el && typeof el.getScreenCTM === "function" ? el.getScreenCTM() : null;
    const rootToScreen = typeof scope.svgSession.svgRoot.getScreenCTM === "function" ? scope.svgSession.svgRoot.getScreenCTM() : null;
    if (!elToScreen || !rootToScreen || typeof rootToScreen.inverse !== "function") return {
      x,
      y
    };
    try {
      const screenToRoot = rootToScreen.inverse();
      const screen = scope.svgSession.applySvgMatrix(elToScreen, x, y);
      const root = scope.svgSession.applySvgMatrix(screenToRoot, screen.x, screen.y);
      if (Number.isFinite(root.x) && Number.isFinite(root.y)) return root;
    } catch {
      // ignore
    }
    return {
      x,
      y
    };
  };
  scope.svgSession.rootPointToElementPoint = function (el, rootPoint) {
    const rootToScreen = typeof scope.svgSession.svgRoot.getScreenCTM === "function" ? scope.svgSession.svgRoot.getScreenCTM() : null;
    const elToScreen = el && typeof el.getScreenCTM === "function" ? el.getScreenCTM() : null;
    if (!rootToScreen || !elToScreen || typeof elToScreen.inverse !== "function") return rootPoint;
    try {
      const screenToEl = elToScreen.inverse();
      const screen = scope.svgSession.applySvgMatrix(rootToScreen, rootPoint.x, rootPoint.y);
      const pt = scope.svgSession.applySvgMatrix(screenToEl, screen.x, screen.y);
      if (Number.isFinite(pt.x) && Number.isFinite(pt.y)) return pt;
    } catch {
      // ignore
    }
    return rootPoint;
  };
  scope.svgSession.findNearestSnapPointInRoot = createFindNearestSnapPointInRootHandler({
    get svgSession() {
      return scope.svgSession;
    }
  });
  scope.svgSession.snapAngleEndpointInRoot = function (anchorRoot, rawRoot, incrementRad = Math.PI / 12) {
    if (!anchorRoot || !rawRoot) return rawRoot;
    const dx = rawRoot.x - anchorRoot.x;
    const dy = rawRoot.y - anchorRoot.y;
    const r = Math.hypot(dx, dy);
    if (!Number.isFinite(r) || r <= 1e-9) return rawRoot;
    const inc = Number.isFinite(incrementRad) && incrementRad > 1e-9 ? incrementRad : Math.PI / 12;
    const theta = Math.atan2(dy, dx);
    const snappedTheta = Math.round(theta / inc) * inc;
    return {
      x: anchorRoot.x + r * Math.cos(snappedTheta),
      y: anchorRoot.y + r * Math.sin(snappedTheta)
    };
  };
  scope.svgSession.getElementBBoxInRoot = createGetElementBBoxInRootHandler({
    get svgSession() {
      return scope.svgSession;
    }
  });
  scope.svgSession.getElementBBoxInSpace = createGetElementBBoxInSpaceHandler({
    get svgSession() {
      return scope.svgSession;
    }
  });
}
