// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/CreateApplyDragDeltaToElementHandler.mjs
// This module implements create Apply Drag Delta To Element Handler behavior for the SVGeditorRuntime feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { setAttrNumber, formatPoints, getAttrNumber, distancePointToSegment } from "../svgDom.mjs";

// Create Apply Drag Delta To Element Handler operations.
export function createApplyDragDeltaToElementHandler(owner) {
  return function (el, base, dx, dy) {
    if (!el || !base) return;
    if (base.kind === "xy") {
      setAttrNumber(el, "x", base.x + dx);
      setAttrNumber(el, "y", base.y + dy);
      owner.svgSession.applyDragRotationOriginDelta(el, base, dx, dy);
      return;
    }
    if (base.kind === "cxy") {
      setAttrNumber(el, "cx", base.cx + dx);
      setAttrNumber(el, "cy", base.cy + dy);
      owner.svgSession.applyDragRotationOriginDelta(el, base, dx, dy);
      return;
    }
    if (base.kind === "line") {
      setAttrNumber(el, "x1", base.x1 + dx);
      setAttrNumber(el, "y1", base.y1 + dy);
      setAttrNumber(el, "x2", base.x2 + dx);
      setAttrNumber(el, "y2", base.y2 + dy);
      owner.svgSession.applyDragRotationOriginDelta(el, base, dx, dy);
      return;
    }
    if (base.kind === "points") {
      const moved = (base.points || []).map(([x, y]) => [x + dx, y + dy]);
      el.setAttribute("points", formatPoints(moved));
      owner.svgSession.applyDragRotationOriginDelta(el, base, dx, dy);
      return;
    }
    const translate = `translate(${dx} ${dy})`;
    const baseTransform = String(base.baseTransform || "").trim();
    // Prepend translate so movement is in parent coordinates (not scaled/rotated by baseTransform).
    el.setAttribute("transform", baseTransform ? `${translate} ${baseTransform}` : translate);
  };
}

export function createBuildDragStateHandler(owner) {
  return function (pointerId, clientX, clientY) {
    const startClient = {
      x: clientX,
      y: clientY
    };
    const items = owner.svgSession.selectedElements.filter(Boolean).map(el => ({
      el,
      space: owner.svgSession.getDragSpaceForElement(el),
      base: owner.svgSession.getDragBaseForElement(el)
    }));
    const spaceStarts = new Map();
    for (const item of items) {
      if (!spaceStarts.has(item.space)) {
        spaceStarts.set(item.space, owner.svgSession.clientToElementPoint(item.space, startClient.x, startClient.y));
      }
    }
    return {
      pointerId,
      startClient,
      items,
      spaceStarts
    };
  };
}

export function createUpdateDragFromClientHandler(owner) {
  return function (drag, clientX, clientY) {
    if (!drag || !drag.items?.length) return false;
    const nextClient = {
      x: clientX,
      y: clientY
    };
    const deltasBySpace = new Map();
    for (const item of drag.items) {
      if (deltasBySpace.has(item.space)) continue;
      const startPoint = drag.spaceStarts.get(item.space);
      if (!startPoint) continue;
      const curPoint = owner.svgSession.clientToElementPoint(item.space, nextClient.x, nextClient.y);
      deltasBySpace.set(item.space, {
        dx: curPoint.x - startPoint.x,
        dy: curPoint.y - startPoint.y
      });
    }
    let moved = false;
    for (const item of drag.items) {
      const delta = deltasBySpace.get(item.space);
      if (!delta) continue;
      if (delta.dx || delta.dy) {
        owner.svgSession.applyDragDeltaToElement(item.el, item.base, delta.dx, delta.dy);
        moved = true;
      } else {
        // Ensure exact snap-back when pointer returns to start.
        owner.svgSession.applyDragDeltaToElement(item.el, item.base, 0, 0);
      }
    }
    if (moved) owner.svgSession.refreshSelectionGeometryAfterMutation("move");
    return moved;
  };
}

export function createDistanceToGeometryStrokeInRootHandler(owner) {
  return function (el, point, tolerance) {
    if (!el || !Number.isFinite(tolerance) || tolerance < 0) return Infinity;
    const tag = el.tagName.toLowerCase();
    if (tag === "line") {
      const a = owner.svgSession.elementPointToRootPoint(el, getAttrNumber(el, "x1", 0), getAttrNumber(el, "y1", 0));
      const b = owner.svgSession.elementPointToRootPoint(el, getAttrNumber(el, "x2", 0), getAttrNumber(el, "y2", 0));
      return distancePointToSegment(point, a, b);
    }
    if (typeof el.getTotalLength !== "function" || typeof el.getPointAtLength !== "function") return Infinity;
    let length = 0;
    try {
      length = Number(el.getTotalLength());
    } catch {
      return Infinity;
    }
    if (!Number.isFinite(length) || length <= 1e-6) return Infinity;
    const step = Math.max(1, tolerance * 0.5);
    const samples = Math.max(12, Math.min(260, Math.ceil(length / step)));
    let bestDistance = Infinity;
    for (let i = 0; i <= samples; i += 1) {
      let localPoint = null;
      try {
        localPoint = el.getPointAtLength(length * i / samples);
      } catch {
        break;
      }
      if (!localPoint) continue;
      const rootPoint = owner.svgSession.elementPointToRootPoint(el, localPoint.x, localPoint.y);
      const dx = rootPoint.x - point.x;
      const dy = rootPoint.y - point.y;
      const d = Math.hypot(dx, dy);
      if (d < bestDistance) bestDistance = d;
      if (bestDistance <= 1e-6) break;
    }
    return bestDistance;
  };
}
