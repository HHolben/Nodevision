// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/CreateApplyLineToolAxisDistanceHandler.mjs
// This module implements create Apply Line Tool Axis Distance Handler behavior for the SVGeditorRuntime feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

// Create Apply Line Tool Axis Distance Handler operations.
export function createApplyLineToolAxisDistanceHandler(owner) {
  return function (distance) {
    const constraint = owner.svgSession.lineToolState.constraint;
    if (!owner.svgSession.isLineToolAxisConstraint(constraint)) return false;
    const origin = constraint.originRoot || owner.svgSession.getLineToolCurrentSegmentOriginRoot();
    if (!origin || !Number.isFinite(distance)) return false;
    const layer = constraint.layer || owner.svgSession.lineToolState.layer || owner.svgSession.svgRoot;
    const originSpace = constraint.originSpace || owner.svgSession.getLineToolAnchorSpace(layer, origin);
    const grabPercentMode = Boolean(owner.svgSession.lineToolState.grab) && constraint.inputMode !== "position" && (constraint.type === "x" || constraint.type === "y");
    const rawDistance = grabPercentMode ? owner.svgSession.axisPercentToRootDistance(constraint.type, Math.abs(distance)) : Math.abs(distance);
    if (!Number.isFinite(rawDistance)) return false;
    const signedDistance = rawDistance * owner.svgSession.getLineToolAxisDirectionSign(constraint);
    const nextSpace = constraint.type === "x" ? {
      x: originSpace.x + signedDistance,
      y: originSpace.y
    } : constraint.type === "y" ? {
      x: originSpace.x,
      y: originSpace.y + signedDistance
    } : {
      x: originSpace.x,
      y: originSpace.y
    };
    const next = owner.svgSession.elementPointToRootPoint(layer, nextSpace.x, nextSpace.y);
    constraint.fixedRoot = {
      ...next
    };
    if (constraint.type === "z") constraint.zDistance = signedDistance;
    if (owner.svgSession.lineToolState.grab) owner.svgSession.updateLineToolGrab(next);else owner.svgSession.setLineToolCursorRoot(next);
    const amountLabel = grabPercentMode ? owner.svgSession.formatLineToolAngleNumber(Math.abs(distance)) + "%" : String(signedDistance);
    owner.svgSession.setStatus((owner.svgSession.lineToolState.grab ? "Line grab" : "Line cursor") + " moved " + constraint.type.toUpperCase() + " by " + amountLabel);
    return true;
  };
}

export function createApplyLineToolAxisPositionHandler(owner) {
  return function (position) {
    const constraint = owner.svgSession.lineToolState.constraint;
    if (!owner.svgSession.isLineToolAxisConstraint(constraint)) return false;
    if (!Number.isFinite(position)) return false;
    const origin = constraint.originRoot || owner.svgSession.getLineToolCurrentSegmentOriginRoot();
    if (!origin) return false;
    const layer = constraint.layer || owner.svgSession.lineToolState.layer || owner.svgSession.svgRoot;
    const originSpace = constraint.originSpace || owner.svgSession.getLineToolAnchorSpace(layer, origin);
    const nextSpace = constraint.type === "x" ? {
      x: position,
      y: originSpace.y
    } : constraint.type === "y" ? {
      x: originSpace.x,
      y: position
    } : {
      x: originSpace.x,
      y: originSpace.y
    };
    const next = owner.svgSession.elementPointToRootPoint(layer, nextSpace.x, nextSpace.y);
    constraint.fixedRoot = {
      ...next
    };
    if (constraint.type === "z") constraint.zPosition = position;
    owner.svgSession.setLineToolCursorRoot(next);
    owner.svgSession.setStatus("Line cursor " + constraint.type.toUpperCase() + " position set to " + position);
    return true;
  };
}

export function createSetLineToolAxisConstraintHandler(owner) {
  return function (axis, distance = null, {
    toggle = false
  } = {}) {
    const origin = owner.svgSession.getLineToolAnchorRoot();
    if (!origin) {
      owner.svgSession.setStatus("Line tool: place a vertex before using axis constraints");
      return false;
    }
    if (toggle && owner.svgSession.lineToolState.constraint?.type === axis) {
      owner.svgSession.lineToolState.constraint = null;
      owner.svgSession.lineToolState.axisDistanceBuffer = "";
      owner.svgSession.lineToolState.angleInputBuffer = "";
      if (owner.svgSession.lineToolState.cursorRoot) owner.svgSession.updateLineToolPreview(owner.svgSession.lineToolState.cursorRoot);
      owner.svgSession.setStatus((owner.svgSession.lineToolState.grab ? "Line grab" : "Line cursor") + " unlocked from " + axis.toUpperCase() + " axis");
      return true;
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
      axisDirectionSign: Number.isFinite(distance) && distance < 0 ? -1 : 1
    };
    owner.svgSession.lineToolState.axisDistanceBuffer = "";
    owner.svgSession.lineToolState.angleInputBuffer = "";
    if (Number.isFinite(distance)) {
      owner.svgSession.applyLineToolAxisDistance(Math.abs(distance));
    } else {
      if (owner.svgSession.lineToolState.cursorRoot) {
        const constrainedRoot = owner.svgSession.applyLineToolConstraint(owner.svgSession.lineToolState.cursorRoot);
        if (owner.svgSession.lineToolState.grab) owner.svgSession.updateLineToolGrab(constrainedRoot);else owner.svgSession.updateLineToolPreview(constrainedRoot);
      }
      owner.svgSession.setStatus((owner.svgSession.lineToolState.grab ? "Line grab" : "Line cursor") + " locked to " + owner.svgSession.lineToolAxisConstraintLabel(owner.svgSession.lineToolState.constraint) + " axis; " + (owner.svgSession.lineToolState.grab ? "type percent, click or Enter to release" : "click or Enter to place"));
    }
    return true;
  };
}
