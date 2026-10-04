// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/HandleSvgPointerDrawingMove.mjs
// This module implements handle Svg Pointer Drawing Move behavior for the SVGeditorRuntime feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

// Handle Svg Pointer Drawing Move operations.
export function handleSvgPointerDrawingMove(scope) {
  if (scope.owner.svgSession.rotateState && scope.owner.svgSession.rotateState.pointerId === scope.e.pointerId) {
    if (scope.owner.svgSession.rotateState.command) {
      scope.pointerMoveState.angleLocal = Math.atan2(scope.pointerMoveState.p.y - scope.owner.svgSession.rotateState.cy, scope.pointerMoveState.p.x - scope.owner.svgSession.rotateState.cx) - scope.owner.svgSession.rotateState.startAngle;
      scope.owner.svgSession.applyRotationAngleToCommand(scope.owner.svgSession.rotateState.command, scope.owner.svgSession.rotateState.baseAngleRad + scope.pointerMoveState.angleLocal);
      scope.owner.svgSession.updatePendingRotationStatus();
      scope.e.preventDefault();
      return {
        value: void 0
      };
    }
    scope.pointerMoveState.angle = Math.atan2(scope.pointerMoveState.p.y - scope.owner.svgSession.rotateState.cy, scope.pointerMoveState.p.x - scope.owner.svgSession.rotateState.cx) - scope.owner.svgSession.rotateState.startAngle;
    scope.pointerMoveState.angleDeg = scope.pointerMoveState.angle * 180 / Math.PI;
    if (scope.owner.svgSession.rotateState.baseLine) {
      scope.pointerMoveState.p1 = scope.owner.svgSession.rotatePointAroundCenter(scope.owner.svgSession.rotateState.baseLine.p1, {
        x: scope.owner.svgSession.rotateState.cx,
        y: scope.owner.svgSession.rotateState.cy
      }, scope.pointerMoveState.angle);
      scope.pointerMoveState.p2 = scope.owner.svgSession.rotatePointAroundCenter(scope.owner.svgSession.rotateState.baseLine.p2, {
        x: scope.owner.svgSession.rotateState.cx,
        y: scope.owner.svgSession.rotateState.cy
      }, scope.pointerMoveState.angle);
      scope.owner.svgSession.rotateState.element.setAttribute("x1", String(scope.pointerMoveState.p1.x));
      scope.owner.svgSession.rotateState.element.setAttribute("y1", String(scope.pointerMoveState.p1.y));
      scope.owner.svgSession.rotateState.element.setAttribute("x2", String(scope.pointerMoveState.p2.x));
      scope.owner.svgSession.rotateState.element.setAttribute("y2", String(scope.pointerMoveState.p2.y));
    } else {
      scope.owner.svgSession.setTransformFromBase(scope.owner.svgSession.rotateState.element, scope.owner.svgSession.rotateState.baseTransform, `rotate(${scope.pointerMoveState.angleDeg} ${scope.owner.svgSession.rotateState.cx} ${scope.owner.svgSession.rotateState.cy})`);
    }
    scope.owner.svgSession.refreshSelectionGeometryAfterMutation("rotate");
    scope.e.preventDefault();
    return {
      value: void 0
    };
  }
  if (scope.owner.svgSession.toolState.mode === "select") {
    if (scope.owner.svgSession.dragState && scope.owner.svgSession.dragState.pointerId === scope.e.pointerId) {
      scope.owner.svgSession.updateDragFromClient(scope.owner.svgSession.dragState, scope.e.clientX, scope.e.clientY);
      scope.e.preventDefault();
      return {
        value: void 0
      };
    }
    if (scope.owner.svgSession.marqueeState && scope.owner.svgSession.marqueeState.pointerId === scope.e.pointerId) {
      scope.owner.svgSession.marqueeState.current = scope.pointerMoveState.p;
      scope.pointerMoveState.rect = scope.owner.svgSession.setMarqueeBox(scope.owner.svgSession.marqueeState.start, scope.owner.svgSession.marqueeState.current);
      scope.pointerMoveState.hits = scope.owner.svgSession.getSelectableElements().filter(el => {
        try {
          const bbox = scope.owner.svgSession.getElementBBoxInRoot(el);
          return bbox ? scope.owner.svgSession.intersectsRect(scope.pointerMoveState.rect, bbox) : false;
        } catch {
          return false;
        }
      });
      if (scope.owner.svgSession.marqueeState.baseSelection.length) {
        scope.owner.svgSession.setSelection([...scope.owner.svgSession.marqueeState.baseSelection, ...scope.pointerMoveState.hits]);
      } else {
        scope.owner.svgSession.setSelection(scope.pointerMoveState.hits);
      }
      scope.e.preventDefault();
      return {
        value: void 0
      };
    }
  }
  if (scope.owner.svgSession.toolState.mode === "line" && scope.owner.svgSession.lineToolState.active) {
    scope.pointerMoveState.nextLocal = scope.owner.svgSession.resolveLineToolPoint(scope.pointerMoveState.p, scope.e);
    if (scope.owner.svgSession.lineToolState.grab) scope.owner.svgSession.updateLineToolGrab(scope.pointerMoveState.nextLocal);else scope.owner.svgSession.updateLineToolPreview(scope.pointerMoveState.nextLocal);
    scope.e.preventDefault();
    return {
      value: void 0
    };
  }
  if ((scope.owner.svgSession.toolState.mode === "circle" || scope.owner.svgSession.toolState.mode === "arc") && scope.owner.svgSession.shapeToolState.active) {
    scope.owner.svgSession.updateShapeToolPreview(scope.pointerMoveState.p);
    scope.e.preventDefault();
    return {
      value: void 0
    };
  }
  if (scope.owner.svgSession.toolState.mode === "bezier" && scope.owner.svgSession.bezierController.isActive()) {
    scope.pointerMoveState.target = scope.pointerMoveState.p;
    scope.pointerMoveState.model = scope.owner.svgSession.bezierController.state?.model;
    scope.pointerMoveState.last = scope.pointerMoveState.model?.nodes?.[scope.pointerMoveState.model.nodes.length - 1];
    if (scope.e.shiftKey && scope.pointerMoveState.last) {
      scope.pointerMoveState.tolLocal = scope.owner.svgSession.pointerToleranceInSvgUnits(10);
      scope.pointerMoveState.snappedLocal = scope.owner.svgSession.findNearestSnapPointInRoot(scope.pointerMoveState.p, scope.pointerMoveState.tolLocal);
      scope.pointerMoveState.target = scope.pointerMoveState.snappedLocal || scope.owner.svgSession.snapAngleEndpointInRoot(scope.pointerMoveState.last, scope.pointerMoveState.p, Math.PI / 12);
    }
    scope.owner.svgSession.bezierController.onPointerMove(scope.e, scope.pointerMoveState.target);
    scope.e.preventDefault();
    return {
      value: void 0
    };
  }
  if (scope.owner.svgSession.toolState.mode === "sketch") {
    if (!scope.owner.svgSession.sketchController.onPointerMove(scope.e, scope.pointerMoveState.p)) return {
      value: void 0
    };
    scope.e.preventDefault();
    return {
      value: void 0
    };
  }
  if (scope.owner.svgSession.toolState.mode === "freehand" && scope.owner.svgSession.freehandStrokeState) {
    scope.owner.svgSession.appendFreehandSample(scope.e, scope.pointerMoveState.p);
    scope.e.preventDefault();
    return {
      value: void 0
    };
  }
  if (!scope.owner.svgSession.toolState.drawing || !scope.owner.svgSession.toolState.tempShape) return {
    value: void 0
  };
  scope.e.preventDefault();
}
