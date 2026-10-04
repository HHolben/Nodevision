// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/CreateGetElementBBoxInSpaceHandler.mjs
// This module implements create Get Element BBox In Space Handler behavior for the SVGeditorRuntime feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

// Create Get Element BBox In Space Handler operations.
export function createGetElementBBoxInSpaceHandler(owner) {
  return function (el, spaceEl) {
    if (!el || typeof el.getBBox !== "function") return null;
    if (!spaceEl || typeof spaceEl.getScreenCTM !== "function") return owner.svgSession.getElementBBoxInRoot(el);
    let bbox = null;
    try {
      bbox = el.getBBox();
    } catch {
      return null;
    }
    if (!bbox || !Number.isFinite(bbox.x) || !Number.isFinite(bbox.y)) return null;
    const elToScreen = typeof el.getScreenCTM === "function" ? el.getScreenCTM() : null;
    const spaceToScreen = typeof spaceEl.getScreenCTM === "function" ? spaceEl.getScreenCTM() : null;
    if (!elToScreen || !spaceToScreen || typeof spaceToScreen.inverse !== "function") {
      return {
        x: bbox.x,
        y: bbox.y,
        width: bbox.width || 0,
        height: bbox.height || 0
      };
    }
    let screenToSpace = null;
    try {
      screenToSpace = spaceToScreen.inverse();
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
      const space = owner.svgSession.applySvgMatrix(screenToSpace, screen.x, screen.y);
      if (!Number.isFinite(space.x) || !Number.isFinite(space.y)) continue;
      minX = Math.min(minX, space.x);
      minY = Math.min(minY, space.y);
      maxX = Math.max(maxX, space.x);
      maxY = Math.max(maxY, space.y);
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

export function createGetSelectedUnionBBoxHandler(owner) {
  return function () {
    if (!owner.svgSession.selectedElements.length) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const el of owner.svgSession.selectedElements) {
      try {
        const bbox = owner.svgSession.getElementBBoxInRoot(el);
        if (!bbox || !Number.isFinite(bbox.x) || !Number.isFinite(bbox.y)) continue;
        minX = Math.min(minX, bbox.x);
        minY = Math.min(minY, bbox.y);
        maxX = Math.max(maxX, bbox.x + bbox.width);
        maxY = Math.max(maxY, bbox.y + bbox.height);
      } catch {
        // Skip elements without measurable bbox.
      }
    }
    if (!Number.isFinite(minX) || !Number.isFinite(minY) || !Number.isFinite(maxX) || !Number.isFinite(maxY)) {
      return null;
    }
    return {
      x: minX,
      y: minY,
      width: Math.max(0, maxX - minX),
      height: Math.max(0, maxY - minY)
    };
  };
}

export function createUpdateRotationOriginMarkerHandler(owner) {
  return function (rootPoint = null) {
    const point = owner.svgSession.normalizeRootPoint(rootPoint) || owner.svgSession.getCurrentRotationOriginMarkerPoint();
    if (!point || !owner.svgSession.selectedElements.length) {
      owner.svgSession.rotationOriginMarker.setAttribute("display", "none");
      return;
    }
    const size = Math.max(2, owner.svgSession.pointerToleranceInSvgUnits(7));
    const radius = Math.max(1.5, owner.svgSession.pointerToleranceInSvgUnits(4));
    const strokeWidth = Math.max(0.05, owner.svgSession.pointerToleranceInSvgUnits(1.5));
    owner.svgSession.rotationOriginMarker.setAttribute("transform", "translate(" + point.x + " " + point.y + ")");
    owner.svgSession.rotationOriginRing.setAttribute("r", String(radius));
    owner.svgSession.rotationOriginRing.setAttribute("stroke-width", String(strokeWidth));
    owner.svgSession.rotationOriginHorizontal.setAttribute("x1", String(-size));
    owner.svgSession.rotationOriginHorizontal.setAttribute("y1", "0");
    owner.svgSession.rotationOriginHorizontal.setAttribute("x2", String(size));
    owner.svgSession.rotationOriginHorizontal.setAttribute("y2", "0");
    owner.svgSession.rotationOriginHorizontal.setAttribute("stroke-width", String(strokeWidth));
    owner.svgSession.rotationOriginVertical.setAttribute("x1", "0");
    owner.svgSession.rotationOriginVertical.setAttribute("y1", String(-size));
    owner.svgSession.rotationOriginVertical.setAttribute("x2", "0");
    owner.svgSession.rotationOriginVertical.setAttribute("y2", String(size));
    owner.svgSession.rotationOriginVertical.setAttribute("stroke-width", String(strokeWidth));
    owner.svgSession.rotationOriginMarker.setAttribute("display", "");
  };
}
