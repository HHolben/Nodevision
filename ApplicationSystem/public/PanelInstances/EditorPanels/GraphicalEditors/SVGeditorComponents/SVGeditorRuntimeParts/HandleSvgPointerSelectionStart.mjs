// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/HandleSvgPointerSelectionStart.mjs
// This module implements handle Svg Pointer Selection Start behavior for the SVGeditorRuntime feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

// Handle Svg Pointer Selection Start operations.
export function handleSvgPointerSelectionStart(scope) {
  if (scope.owner.svgSession.toolState.mode === "select" || scope.owner.svgSession.toolState.mode === "rotate") {
    scope.pointerStartState.target = scope.e.target instanceof SVGElement ? scope.e.target : null;
    scope.owner.svgSession.recordLineProbe("hit-test:start", {
      targetTag: scope.pointerStartState.target?.tagName || null
    });
    scope.pointerStartState.geometryHit = scope.owner.svgSession.findNearestGeometryAtPoint(scope.pointerStartState.p, scope.owner.svgSession.pointerToleranceInSvgUnits(10));
    scope.owner.svgSession.recordLineProbe("hit-test:end", {
      geometryHitTag: scope.pointerStartState.geometryHit?.tagName || null
    });
    if (scope.pointerStartState.geometryHit && (!scope.pointerStartState.target || !scope.owner.svgSession.isSelectableElement(scope.pointerStartState.target) || scope.owner.svgSession.shouldPreferGeometryHit(scope.pointerStartState.target))) {
      scope.pointerStartState.target = scope.pointerStartState.geometryHit;
    } else if (!scope.pointerStartState.target || !scope.owner.svgSession.isSelectableElement(scope.pointerStartState.target)) {
      scope.pointerStartState.target = null;
    }
    scope.pointerStartState.rotateToolActive = scope.owner.svgSession.toolState.mode === "rotate";
    scope.pointerStartState.rotatePreviewActive = Boolean(scope.owner.svgSession.pendingRotateCommand);
    if (scope.owner.svgSession.pendingRotateCommand?.originPlacement) {
      if (scope.owner.svgSession.targetIsInsideSingleSelection(scope.pointerStartState.target)) {
        scope.owner.svgSession.placePendingRotationOrigin(scope.pointerStartState.p);
      } else {
        scope.owner.svgSession.updateRotationOriginPlacementStatus("Rotation origin: click on the selected object to place it");
      }
      scope.e.preventDefault();
      scope.e.stopPropagation();
      return {
        value: void 0
      };
    }
    if (scope.owner.svgSession.pendingRotateCommand && (!scope.pointerStartState.target || !scope.owner.svgSession.selectedElements.includes(scope.pointerStartState.target))) {
      scope.owner.svgSession.commitPendingRotationCommand({
        silent: true
      });
    }
    if (scope.pointerStartState.target && scope.owner.svgSession.isSelectableElement(scope.pointerStartState.target)) {
      if (!scope.pointerStartState.rotateToolActive) scope.owner.svgSession.scheduleEyedropperHold(scope.e, scope.pointerStartState.target, scope.pointerStartState.p);
      scope.pointerStartState.additiveSelection = !scope.pointerStartState.rotateToolActive && (scope.e.ctrlKey || scope.e.metaKey);
      if (scope.pointerStartState.additiveSelection) {
        scope.owner.svgSession.toggleSelection(scope.pointerStartState.target);
        scope.e.preventDefault();
        scope.e.stopPropagation();
        return {
          value: void 0
        };
      }
      if (scope.pointerStartState.rotateToolActive) {
        if (!scope.owner.svgSession.selectedElements.includes(scope.pointerStartState.target) || scope.owner.svgSession.selectedElements.length !== 1) {
          scope.owner.svgSession.setSelection([scope.pointerStartState.target], {
            primary: scope.pointerStartState.target
          });
        }
        if (scope.owner.svgSession.startPendingRotationDrag(scope.pointerStartState.target, scope.e.pointerId, scope.pointerStartState.p)) {
          scope.e.preventDefault();
          scope.e.stopPropagation();
          return {
            value: void 0
          };
        }
        scope.e.preventDefault();
        scope.e.stopPropagation();
        return {
          value: void 0
        };
      }
      if (scope.pointerStartState.rotatePreviewActive && scope.owner.svgSession.selectedElements.includes(scope.pointerStartState.target)) {
        if (scope.owner.svgSession.startPendingRotationDrag(scope.pointerStartState.target, scope.e.pointerId, scope.pointerStartState.p)) {
          scope.e.preventDefault();
          scope.e.stopPropagation();
          return {
            value: void 0
          };
        }
      }
      if (scope.e.shiftKey) {
        if (!scope.owner.svgSession.selectedElements.includes(scope.pointerStartState.target) || scope.owner.svgSession.selectedElements.length !== 1) {
          scope.owner.svgSession.setSelection([scope.pointerStartState.target], {
            primary: scope.pointerStartState.target
          });
        }
        if (scope.owner.svgSession.startRotateInteraction(scope.pointerStartState.target, scope.e.pointerId, scope.pointerStartState.p)) {
          scope.e.preventDefault();
          return {
            value: void 0
          };
        }
      } else if (!scope.owner.svgSession.selectedElements.includes(scope.pointerStartState.target)) {
        scope.owner.svgSession.setSelection([scope.pointerStartState.target], {
          primary: scope.pointerStartState.target
        });
      }
      if (scope.e.detail >= 2 && scope.pointerStartState.target.tagName.toLowerCase() === "path") {
        scope.owner.svgSession.nodeEditor.enter(scope.pointerStartState.target);
        scope.e.preventDefault();
        scope.e.stopPropagation();
        return {
          value: void 0
        };
      }
      scope.owner.svgSession.dragState = scope.owner.svgSession.buildDragState(scope.e.pointerId, scope.e.clientX, scope.e.clientY);
      try {
        scope.owner.svgSession.svgRoot.setPointerCapture(scope.e.pointerId);
      } catch {
        // Ignore unsupported pointer capture errors.
      }
      scope.e.preventDefault();
      return {
        value: void 0
      };
    }
    if (scope.owner.svgSession.pendingRotateCommand) scope.owner.svgSession.commitPendingRotationCommand({
      silent: true
    });
    if (scope.pointerStartState.rotateToolActive) {
      if (!scope.e.shiftKey && !scope.e.ctrlKey && !scope.e.metaKey) scope.owner.svgSession.clearSelection();
      scope.e.preventDefault();
      scope.e.stopPropagation();
      return {
        value: void 0
      };
    }
    scope.owner.svgSession.quickMenu.scheduleLongPress(scope.e, scope.owner.svgSession.drawingAssistSettings, () => scope.e.button === 0 && !scope.owner.svgSession.toolState.drawing);
    scope.pointerStartState.additiveMarquee = scope.e.shiftKey || scope.e.ctrlKey || scope.e.metaKey;
    scope.owner.svgSession.marqueeState = {
      pointerId: scope.e.pointerId,
      start: scope.pointerStartState.p,
      current: scope.pointerStartState.p,
      baseSelection: scope.pointerStartState.additiveMarquee ? [...scope.owner.svgSession.selectedElements] : []
    };
    if (!scope.pointerStartState.additiveMarquee) scope.owner.svgSession.clearSelection();
    scope.owner.svgSession.setMarqueeBox(scope.pointerStartState.p, scope.pointerStartState.p);
    try {
      scope.owner.svgSession.svgRoot.setPointerCapture(scope.e.pointerId);
    } catch {
      // Ignore unsupported pointer capture errors.
    }
    scope.e.preventDefault();
    return {
      value: void 0
    };
  }
}
