// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/HandleSvgPointerTransformMove.mjs
// This module implements handle Svg Pointer Transform Move behavior for the SVGeditorRuntime feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { toSvgPoint, getAttrNumber } from "../svgDom.mjs";
import { cornerResizeScale } from "../SvgResizeGeometry.mjs";

// Handle Svg Pointer Transform Move operations.
export function handleSvgPointerTransformMove(scope) {
  scope.pointerMoveState.p = toSvgPoint(scope.owner.svgSession.svgRoot, scope.e.clientX, scope.e.clientY);
  scope.owner.svgSession.lastPointerRoot = scope.pointerMoveState.p;
  scope.owner.svgSession.lastPointerClient = {
    x: scope.e.clientX,
    y: scope.e.clientY
  };
  scope.owner.svgSession.quickMenu.onPointerMove(scope.e);
  scope.owner.svgSession.updateBrushCursor(scope.pointerMoveState.p);
  scope.owner.svgSession.cancelEyedropperHoldIfMoved(scope.pointerMoveState.p);
  if (scope.owner.svgSession.selectionGrabState) {
    if (scope.owner.svgSession.selectionGrabState.layerOrderMode) {
      scope.e.preventDefault();
      return {
        value: void 0
      };
    }
    scope.owner.svgSession.applySelectionGrabTargetRoot(scope.pointerMoveState.p);
    scope.e.preventDefault();
    return {
      value: void 0
    };
  }
  if (scope.owner.svgSession.toolState.mode === "select" && scope.owner.svgSession.nodeEditor.onPointerMove?.(scope.e)) return {
    value: void 0
  };
  if (scope.owner.svgSession.lineHandleDragState && scope.owner.svgSession.lineHandleDragState.pointerId === scope.e.pointerId) {
    scope.pointerMoveState.line = scope.owner.svgSession.lineHandleDragState.line;
    scope.pointerMoveState.which = scope.owner.svgSession.lineHandleDragState.which;
    scope.pointerMoveState.base = scope.owner.svgSession.lineHandleDragState.base || {
      x1: getAttrNumber(scope.pointerMoveState.line, "x1", 0),
      y1: getAttrNumber(scope.pointerMoveState.line, "y1", 0),
      x2: getAttrNumber(scope.pointerMoveState.line, "x2", 0),
      y2: getAttrNumber(scope.pointerMoveState.line, "y2", 0)
    };
    scope.pointerMoveState.fixed = scope.pointerMoveState.which === "start" ? {
      x: scope.pointerMoveState.base.x2,
      y: scope.pointerMoveState.base.y2
    } : {
      x: scope.pointerMoveState.base.x1,
      y: scope.pointerMoveState.base.y1
    };
    scope.pointerMoveState.fixedRoot = scope.owner.svgSession.elementPointToRootPoint(scope.pointerMoveState.line, scope.pointerMoveState.fixed.x, scope.pointerMoveState.fixed.y);
    scope.pointerMoveState.movingBase = scope.pointerMoveState.which === "start" ? {
      x: scope.pointerMoveState.base.x1,
      y: scope.pointerMoveState.base.y1
    } : {
      x: scope.pointerMoveState.base.x2,
      y: scope.pointerMoveState.base.y2
    };
    scope.pointerMoveState.movingBaseRoot = scope.owner.svgSession.elementPointToRootPoint(scope.pointerMoveState.line, scope.pointerMoveState.movingBase.x, scope.pointerMoveState.movingBase.y);
    scope.pointerMoveState.nextRoot = scope.pointerMoveState.p;
    if (scope.e.shiftKey) {
      scope.pointerMoveState.tol = scope.owner.svgSession.pointerToleranceInSvgUnits(10);
      scope.pointerMoveState.snapped = scope.owner.svgSession.findNearestSnapPointInRoot(scope.pointerMoveState.p, scope.pointerMoveState.tol, {
        ignorePoints: [scope.pointerMoveState.movingBaseRoot]
      });
      scope.pointerMoveState.nextRoot = scope.pointerMoveState.snapped || scope.owner.svgSession.snapAngleEndpointInRoot(scope.pointerMoveState.fixedRoot, scope.pointerMoveState.p, Math.PI / 12);
    }
    scope.pointerMoveState.next = scope.owner.svgSession.rootPointToElementPoint(scope.pointerMoveState.line, scope.pointerMoveState.nextRoot);
    if (scope.pointerMoveState.which === "start") {
      scope.pointerMoveState.line.setAttribute("x1", String(scope.pointerMoveState.next.x));
      scope.pointerMoveState.line.setAttribute("y1", String(scope.pointerMoveState.next.y));
    } else {
      scope.pointerMoveState.line.setAttribute("x2", String(scope.pointerMoveState.next.x));
      scope.pointerMoveState.line.setAttribute("y2", String(scope.pointerMoveState.next.y));
    }
    scope.owner.svgSession.refreshSelectionGeometryAfterMutation("line-handle");
    scope.e.preventDefault();
    return {
      value: void 0
    };
  }
  if (scope.owner.svgSession.resizeState && scope.owner.svgSession.resizeState.pointerId === scope.e.pointerId) {
    ({
      bbox: scope.pointerMoveState.bbox,
      corner: scope.pointerMoveState.corner
    } = scope.owner.svgSession.resizeState);
    scope.pointerMoveState.sp = scope.owner.svgSession.resizeState.multi ? scope.pointerMoveState.p : scope.owner.svgSession.clientToElementPoint(scope.owner.svgSession.resizeState.space || scope.owner.svgSession.svgRoot, scope.e.clientX, scope.e.clientY);
    scope.pointerMoveState.element = scope.owner.svgSession.resizeState.element || scope.owner.svgSession.resizeState.items?.[0]?.element || null;
    scope.pointerMoveState.preserveAspect = scope.owner.svgSession.resizeState.multi ? scope.e.shiftKey : scope.pointerMoveState.element?.tagName?.toLowerCase?.() === "image" ? !scope.e.shiftKey : scope.e.shiftKey;
    ({
      anchor: scope.pointerMoveState.anchor,
      sx: scope.pointerMoveState.sx,
      sy: scope.pointerMoveState.sy
    } = cornerResizeScale({
      bbox: scope.pointerMoveState.bbox,
      corner: scope.pointerMoveState.corner,
      point: scope.pointerMoveState.sp,
      preserveAspect: scope.pointerMoveState.preserveAspect
    }));
    if (scope.owner.svgSession.resizeState.multi) {
      scope.owner.svgSession.resizeState.items?.forEach(item => {
        if (!item?.element) return;
        const itemAnchor = item.space && item.space !== scope.owner.svgSession.svgRoot ? scope.owner.svgSession.rootPointToElementPoint(item.space, scope.pointerMoveState.anchor) : scope.pointerMoveState.anchor;
        scope.owner.svgSession.setParentSpaceTransformFromBase(item.element, item.baseTransform, `translate(${itemAnchor.x} ${itemAnchor.y}) scale(${scope.pointerMoveState.sx} ${scope.pointerMoveState.sy}) translate(${-itemAnchor.x} ${-itemAnchor.y})`);
      });
    } else {
      scope.owner.svgSession.setParentSpaceTransformFromBase(scope.pointerMoveState.element, scope.owner.svgSession.resizeState.baseTransform, `translate(${scope.pointerMoveState.anchor.x} ${scope.pointerMoveState.anchor.y}) scale(${scope.pointerMoveState.sx} ${scope.pointerMoveState.sy}) translate(${-scope.pointerMoveState.anchor.x} ${-scope.pointerMoveState.anchor.y})`);
    }
    scope.owner.svgSession.refreshSelectionGeometryAfterMutation("resize");
    scope.e.preventDefault();
    return {
      value: void 0
    };
  }
}
