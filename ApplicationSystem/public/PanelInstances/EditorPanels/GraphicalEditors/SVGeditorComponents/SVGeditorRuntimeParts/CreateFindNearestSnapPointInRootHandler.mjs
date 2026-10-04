// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/CreateFindNearestSnapPointInRootHandler.mjs
// This module implements create Find Nearest Snap Point In Root Handler behavior for the SVGeditorRuntime feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { createCollectSnapPointsHandler } from "./CreateActivateSvgEditorContextHandler.mjs";

// Create Find Nearest Snap Point In Root Handler operations.
export function createFindNearestSnapPointInRootHandler(owner) {
  return function (targetRootPoint, tolerance, options = {}) {
    const tol = Number.isFinite(tolerance) ? Math.max(0, tolerance) : 0;
    if (!tol) return null;
    const ignorePoints = Array.isArray(options.ignorePoints) ? options.ignorePoints : [];
    const useLineToolSnapCache = options.snapCache === "line-tool" && !options.ignoreElement;
    const collectSnapPoints = createCollectSnapPointsHandler({
      get svgSession() {
        return owner.svgSession;
      },
      get options() {
        return options;
      }
    });
    let snapPoints = useLineToolSnapCache ? owner.svgSession.lineToolState.snapPointsRoot : null;
    if (!Array.isArray(snapPoints)) {
      snapPoints = collectSnapPoints();
      if (useLineToolSnapCache) owner.svgSession.lineToolState.snapPointsRoot = snapPoints;
    }
    const tol2 = tol * tol;
    let best = null;
    let bestD2 = tol2 + 1e-12;
    for (const rootPt of snapPoints) {
      if (!rootPt) continue;
      let ignored = false;
      for (const ip of ignorePoints) {
        if (!ip) continue;
        const ddx = rootPt.x - ip.x;
        const ddy = rootPt.y - ip.y;
        if (ddx * ddx + ddy * ddy <= 1e-12) {
          ignored = true;
          break;
        }
      }
      if (ignored) continue;
      const dx = rootPt.x - targetRootPoint.x;
      const dy = rootPt.y - targetRootPoint.y;
      const d2 = dx * dx + dy * dy;
      if (d2 <= tol2 && d2 < bestD2) {
        bestD2 = d2;
        best = rootPt;
      }
    }
    return best;
  };
}

export function createGetElementBBoxInRootHandler(owner) {
  return function (el) {
    if (!el || typeof el.getBBox !== "function") return null;
    let bbox = null;
    try {
      bbox = el.getBBox();
    } catch {
      return null;
    }
    if (!bbox || !Number.isFinite(bbox.x) || !Number.isFinite(bbox.y)) return null;
    const elToScreen = typeof el.getScreenCTM === "function" ? el.getScreenCTM() : null;
    const rootToScreen = typeof owner.svgSession.svgRoot.getScreenCTM === "function" ? owner.svgSession.svgRoot.getScreenCTM() : null;
    if (!elToScreen || !rootToScreen || typeof rootToScreen.inverse !== "function") {
      return {
        x: bbox.x,
        y: bbox.y,
        width: bbox.width || 0,
        height: bbox.height || 0
      };
    }
    let screenToRoot = null;
    try {
      screenToRoot = rootToScreen.inverse();
    } catch {
      return {
        x: bbox.x,
        y: bbox.y,
        width: bbox.width || 0,
        height: bbox.height || 0
      };
    }
    const x1 = bbox.x;
    const y1 = bbox.y;
    const x2 = bbox.x + bbox.width;
    const y2 = bbox.y + bbox.height;
    const corners = [[x1, y1], [x2, y1], [x1, y2], [x2, y2]];
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const [x, y] of corners) {
      const screen = owner.svgSession.applySvgMatrix(elToScreen, x, y);
      const root = owner.svgSession.applySvgMatrix(screenToRoot, screen.x, screen.y);
      if (!Number.isFinite(root.x) || !Number.isFinite(root.y)) continue;
      minX = Math.min(minX, root.x);
      minY = Math.min(minY, root.y);
      maxX = Math.max(maxX, root.x);
      maxY = Math.max(maxY, root.y);
    }
    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
      return {
        x: bbox.x,
        y: bbox.y,
        width: bbox.width || 0,
        height: bbox.height || 0
      };
    }
    return {
      x: minX,
      y: minY,
      width: Math.max(0, maxX - minX),
      height: Math.max(0, maxY - minY)
    };
  };
}
