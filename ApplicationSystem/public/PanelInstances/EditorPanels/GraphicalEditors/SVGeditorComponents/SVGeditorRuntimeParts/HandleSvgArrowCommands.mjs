// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/HandleSvgArrowCommands.mjs
// This module implements handle Svg Arrow Commands behavior for the SVGeditorRuntime feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

// Handle Svg Arrow Commands operations.
export function handleSvgArrowCommands(scope) {
  if (scope.owner.svgSession.toolState.mode === "line") {
    if (scope.keyCommandState.key === "Escape") {
      if (scope.owner.svgSession.cancelLineToolTransientOperation()) {
        scope.e.preventDefault();
        return {
          value: void 0
        };
      }
      if (scope.owner.svgSession.lineToolState.active) {
        scope.owner.svgSession.cancelLineToolAndDeletePlaced();
      } else {
        scope.owner.svgSession.clearLineToolState();
      }
      scope.owner.svgSession.setMode("select");
      scope.e.preventDefault();
      return {
        value: void 0
      };
    }
    if (scope.keyCommandState.key === "Enter" && scope.owner.svgSession.lineToolState.grab) {
      scope.owner.svgSession.finishLineToolGrab();
      scope.e.preventDefault();
      return {
        value: void 0
      };
    }
    if (scope.owner.svgSession.handleLineToolAxisDistanceKey(scope.e)) {
      scope.e.preventDefault();
      return {
        value: void 0
      };
    }
    if (scope.owner.svgSession.handleLineToolAngleKey(scope.e)) {
      scope.e.preventDefault();
      return {
        value: void 0
      };
    }
    if (scope.owner.svgSession.handleLineToolKeyCommand(scope.e)) {
      scope.e.preventDefault();
      return {
        value: void 0
      };
    }
    if (scope.keyCommandState.key === "Enter" && scope.owner.svgSession.lineToolState.active) {
      if (scope.owner.svgSession.lineToolState.constraint && scope.owner.svgSession.placeLineToolConstrainedPoint()) {
        scope.e.preventDefault();
        return {
          value: void 0
        };
      }
      scope.owner.svgSession.finishLineTool();
      scope.e.preventDefault();
      return {
        value: void 0
      };
    }
  }
  if (scope.owner.svgSession.toolState.mode === "circle" || scope.owner.svgSession.toolState.mode === "arc") {
    if (scope.keyCommandState.key === "Escape") {
      if (!scope.owner.svgSession.cancelShapeTool()) scope.owner.svgSession.setMode("select");
      scope.e.preventDefault();
      return {
        value: void 0
      };
    }
  }
  if (scope.owner.svgSession.toolState.mode === "bezier") {
    if (scope.owner.svgSession.bezierController.onKeyDown(scope.e)) {
      if (!scope.owner.svgSession.bezierController.isActive()) scope.owner.svgSession.setMode("select");
      scope.e.preventDefault();
      return {
        value: void 0
      };
    }
  }
  if (scope.owner.svgSession.toolState.mode !== "select") return {
    value: void 0
  };
  if (scope.keyCommandState.key.toLowerCase() === "c" && scope.keyCommandState.meta) {
    if (scope.owner.svgSession.copySelection()) scope.e.preventDefault();
    return {
      value: void 0
    };
  }
  if (scope.keyCommandState.key.toLowerCase() === "v" && scope.keyCommandState.meta) {
    if (scope.owner.svgSession.runSvgSnapshotOperation("paste-selection", () => scope.owner.svgSession.pasteSelection()).length) scope.e.preventDefault();
    return {
      value: void 0
    };
  }
  if (scope.keyCommandState.key === "Delete" || scope.keyCommandState.key === "Backspace") {
    if (scope.owner.svgSession.runSvgSnapshotOperation("delete-selection", () => scope.owner.svgSession.deleteSelection())) scope.e.preventDefault();
    return {
      value: void 0
    };
  }
  if (scope.keyCommandState.key.toLowerCase() === "d" && scope.keyCommandState.meta) {
    scope.owner.svgSession.runSvgSnapshotOperation("duplicate-selection", () => scope.owner.svgSession.duplicateSelection());
    scope.e.preventDefault();
    return {
      value: void 0
    };
  }
  if (scope.keyCommandState.key.startsWith("Arrow")) {
    scope.keyCommandState.step = scope.e.shiftKey ? 10 : 1;
    if (scope.keyCommandState.key === "ArrowLeft") scope.owner.svgSession.runSvgSnapshotOperation("move-selection", () => scope.owner.svgSession.moveSelectionBy(-scope.keyCommandState.step, 0));
    if (scope.keyCommandState.key === "ArrowRight") scope.owner.svgSession.runSvgSnapshotOperation("move-selection", () => scope.owner.svgSession.moveSelectionBy(scope.keyCommandState.step, 0));
    if (scope.keyCommandState.key === "ArrowUp") scope.owner.svgSession.runSvgSnapshotOperation("move-selection", () => scope.owner.svgSession.moveSelectionBy(0, -scope.keyCommandState.step));
    if (scope.keyCommandState.key === "ArrowDown") scope.owner.svgSession.runSvgSnapshotOperation("move-selection", () => scope.owner.svgSession.moveSelectionBy(0, scope.keyCommandState.step));
    scope.e.preventDefault();
  }
}
