// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/CreateSetLineToolPositionAxisConstraintHandler.mjs
// This module implements create Set Line Tool Position Axis Constraint Handler behavior for the SVGeditorRuntime feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

// Create Set Line Tool Position Axis Constraint Handler operations.
export function createSetLineToolPositionAxisConstraintHandler(owner) {
  return function (axis) {
    const origin = owner.svgSession.getLineToolAnchorRoot();
    if (!origin) {
      owner.svgSession.setStatus("Line tool: place a vertex before setting an axis position");
      return false;
    }
    const layer = owner.svgSession.lineToolState.layer || owner.svgSession.getActiveLayer() || owner.svgSession.svgRoot;
    const originSpace = owner.svgSession.getLineToolAnchorSpace(layer, origin);
    owner.svgSession.lineToolState.constraint = {
      type: axis,
      layer,
      originRoot: {
        ...origin
      },
      originSpace: {
        ...originSpace
      },
      axisDirectionSign: 1,
      inputMode: "position"
    };
    owner.svgSession.lineToolState.axisDistanceBuffer = "";
    owner.svgSession.lineToolState.angleInputBuffer = "";
    if (owner.svgSession.lineToolState.cursorRoot) owner.svgSession.updateLineToolPreview(owner.svgSession.applyLineToolConstraint(owner.svgSession.lineToolState.cursorRoot));
    owner.svgSession.setStatus("Line cursor locked to " + owner.svgSession.lineToolAxisConstraintLabel(owner.svgSession.lineToolState.constraint) + " axis; type absolute position, Enter places point");
    return true;
  };
}

export function createUpdateLineToolGrabHandler(owner) {
  return function (rootPoint) {
    const grab = owner.svgSession.lineToolState.grab;
    if (!grab || !owner.svgSession.lineToolState.active) return false;
    const layer = grab.layer || owner.svgSession.lineToolState.layer || owner.svgSession.svgRoot;
    const spacePoint = owner.svgSession.rootPointToElementPoint(layer, rootPoint);
    const index = grab.index;
    owner.svgSession.lineToolState.pointsSpace[index] = [spacePoint.x, spacePoint.y];
    if (index === owner.svgSession.lineToolState.pointsSpace.length - 1) {
      owner.svgSession.lineToolState.startRoot = rootPoint;
      owner.svgSession.lineToolState.startSpace = spacePoint;
      owner.svgSession.lineToolState.lastPlacedRoot = rootPoint;
      owner.svgSession.lineToolState.lastPlacedSpace = {
        x: spacePoint.x,
        y: spacePoint.y
      };
      const lastSeg = owner.svgSession.lineToolState.placedLines[owner.svgSession.lineToolState.placedLines.length - 1];
      if (lastSeg) {
        lastSeg.setAttribute("x2", String(spacePoint.x));
        lastSeg.setAttribute("y2", String(spacePoint.y));
      }
    } else {
      const prevSeg = owner.svgSession.lineToolState.placedLines[index - 1];
      const nextSeg = owner.svgSession.lineToolState.placedLines[index];
      if (prevSeg) {
        prevSeg.setAttribute("x2", String(spacePoint.x));
        prevSeg.setAttribute("y2", String(spacePoint.y));
      }
      if (nextSeg) {
        nextSeg.setAttribute("x1", String(spacePoint.x));
        nextSeg.setAttribute("y1", String(spacePoint.y));
      }
    }
    owner.svgSession.setLineToolCursorRoot(rootPoint);
    owner.svgSession.updateLineToolPreview(rootPoint);
    return true;
  };
}

export function createHandleLineToolAxisDistanceKeyHandler(owner) {
  return function (e) {
    const constraint = owner.svgSession.lineToolState.constraint;
    if (!owner.svgSession.isLineToolAxisConstraint(constraint)) return false;
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    const key = String(e.key || "");
    const isPositionMode = constraint.inputMode === "position";
    if (key === "Backspace") {
      owner.svgSession.lineToolState.axisDistanceBuffer = owner.svgSession.lineToolState.axisDistanceBuffer.slice(0, -1);
      if (!owner.svgSession.lineToolState.axisDistanceBuffer) {
        delete constraint.fixedRoot;
        delete constraint.zDistance;
        delete constraint.zPosition;
        if (owner.svgSession.lineToolState.cursorRoot) {
          const constrainedRoot = owner.svgSession.applyLineToolConstraint(owner.svgSession.lineToolState.cursorRoot);
          if (owner.svgSession.lineToolState.grab) owner.svgSession.updateLineToolGrab(constrainedRoot);else owner.svgSession.updateLineToolPreview(constrainedRoot);
        }
        const action = isPositionMode ? "type position" : owner.svgSession.lineToolState.grab ? "type percent, click or Enter to release" : "click or Enter to place";
        owner.svgSession.setStatus((owner.svgSession.lineToolState.grab ? "Line grab" : "Line cursor") + " locked to " + owner.svgSession.lineToolAxisConstraintLabel(constraint) + " axis; " + action);
        return true;
      }
      return owner.svgSession.reapplyLineToolAxisDistanceBuffer();
    }
    if (isPositionMode && (key === "-" || key === "+")) {
      if (owner.svgSession.lineToolState.axisDistanceBuffer.startsWith("-")) {
        owner.svgSession.lineToolState.axisDistanceBuffer = key === "-" ? owner.svgSession.lineToolState.axisDistanceBuffer.slice(1) : owner.svgSession.lineToolState.axisDistanceBuffer;
      } else if (key === "-") {
        owner.svgSession.lineToolState.axisDistanceBuffer = "-" + owner.svgSession.lineToolState.axisDistanceBuffer;
      }
      return owner.svgSession.reapplyLineToolAxisDistanceBuffer();
    }
    if (key === "-") return owner.svgSession.toggleLineToolAxisDirection();
    if (key === "+") return owner.svgSession.setLineToolAxisDirectionSign(1);
    if (!"0123456789.".includes(key)) return false;
    if (key === "." && owner.svgSession.lineToolState.axisDistanceBuffer.includes(".")) return false;
    owner.svgSession.lineToolState.axisDistanceBuffer += key;
    return owner.svgSession.reapplyLineToolAxisDistanceBuffer();
  };
}
