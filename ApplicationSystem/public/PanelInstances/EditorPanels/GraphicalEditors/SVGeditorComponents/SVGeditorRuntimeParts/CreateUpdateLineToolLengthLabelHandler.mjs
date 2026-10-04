// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/CreateUpdateLineToolLengthLabelHandler.mjs
// This module implements create Update Line Tool Length Label Handler behavior for the SVGeditorRuntime feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

// Create Update Line Tool Length Label Handler operations.
export function createUpdateLineToolLengthLabelHandler(owner) {
  return function (start, current) {
    if (!start || !current) {
      owner.svgSession.lineToolLengthLabel.setAttribute("display", "none");
      return;
    }
    const dx = current.x - start.x;
    const dy = current.y - start.y;
    const len = Math.hypot(dx, dy);
    if (!Number.isFinite(len) || len <= 1e-6) {
      owner.svgSession.lineToolLengthLabel.setAttribute("display", "none");
      return;
    }
    const vb = owner.svgSession.getViewBox();
    const pct = vb?.width ? len / vb.width * 100 : 0;
    const mid = {
      x: (start.x + current.x) / 2,
      y: (start.y + current.y) / 2
    };
    const nLen = Math.hypot(dx, dy);
    const nx = nLen > 1e-9 ? -dy / nLen : 0;
    const ny = nLen > 1e-9 ? dx / nLen : 1;
    const offset = owner.svgSession.pointerToleranceInSvgUnits(18);
    const px = mid.x + nx * offset;
    const py = mid.y + ny * offset;
    const fontSize = Math.max(0.001, owner.svgSession.pointerToleranceInSvgUnits(16));
    const strokeWidth = Math.max(0.001, owner.svgSession.pointerToleranceInSvgUnits(2));
    owner.svgSession.lineToolLengthLabel.setAttribute("font-size", String(fontSize));
    owner.svgSession.lineToolLengthLabel.setAttribute("stroke-width", String(strokeWidth));
    owner.svgSession.lineToolLengthLabel.setAttribute("x", String(px));
    owner.svgSession.lineToolLengthLabel.setAttribute("y", String(py));
    owner.svgSession.lineToolLengthLabel.textContent = `${pct.toFixed(2)}%`;
    owner.svgSession.lineToolLengthLabel.setAttribute("display", "");
  };
}

export function createUpdateLineToolAngleLabelHandler(owner) {
  return function (start, current) {
    if (!start || !current) {
      owner.svgSession.lineToolAngleLabel.setAttribute("display", "none");
      return;
    }
    const mid = {
      x: (start.x + current.x) / 2,
      y: (start.y + current.y) / 2
    };
    const dx = mid.x - start.x;
    const dy = mid.y - start.y;
    const len = Math.hypot(dx, dy);
    if (!Number.isFinite(len) || len <= 1e-6) {
      owner.svgSession.lineToolAngleLabel.setAttribute("display", "none");
      return;
    }
    const theta = Math.atan2(dy, dx);
    const minR = owner.svgSession.pointerToleranceInSvgUnits(14);
    const maxR = owner.svgSession.pointerToleranceInSvgUnits(72);
    const r = Math.max(minR, Math.min(maxR, len * 0.7));
    const half = theta / 2;
    const outward = owner.svgSession.pointerToleranceInSvgUnits(18);
    const px = start.x + (r + outward) * Math.cos(half);
    const py = start.y + (r + outward) * Math.sin(half);
    const fontSize = Math.max(0.001, owner.svgSession.pointerToleranceInSvgUnits(16));
    const strokeWidth = Math.max(0.001, owner.svgSession.pointerToleranceInSvgUnits(2));
    owner.svgSession.lineToolAngleLabel.setAttribute("font-size", String(fontSize));
    owner.svgSession.lineToolAngleLabel.setAttribute("stroke-width", String(strokeWidth));
    owner.svgSession.lineToolAngleLabel.setAttribute("x", String(px));
    owner.svgSession.lineToolAngleLabel.setAttribute("y", String(py));
    owner.svgSession.lineToolAngleLabel.textContent = `${theta.toFixed(4)} rad`;
    owner.svgSession.lineToolAngleLabel.setAttribute("display", "");
  };
}

export function createApplyLineToolConstraintHandler(owner) {
  return function (rawPoint) {
    const constraint = owner.svgSession.lineToolState.constraint;
    if (!rawPoint || !constraint) return rawPoint;
    if (constraint.fixedRoot) return {
      ...constraint.fixedRoot
    };
    const origin = constraint.originRoot || (constraint.type === "angle" ? owner.svgSession.getLineToolCurrentSegmentOriginRoot() : owner.svgSession.getLineToolAnchorRoot()) || rawPoint;
    if (owner.svgSession.isLineToolAxisConstraint(constraint)) {
      const layer = constraint.layer || owner.svgSession.lineToolState.layer || owner.svgSession.svgRoot;
      const originSpace = constraint.originSpace || owner.svgSession.getLineToolAnchorSpace(layer, origin);
      const rawSpace = owner.svgSession.rootPointToElementPoint(layer, rawPoint);
      const sign = owner.svgSession.getLineToolAxisDirectionSign(constraint);
      const lockedSpace = constraint.type === "x" ? {
        x: originSpace.x + Math.abs(rawSpace.x - originSpace.x) * sign,
        y: originSpace.y
      } : constraint.type === "y" ? {
        x: originSpace.x,
        y: originSpace.y + Math.abs(rawSpace.y - originSpace.y) * sign
      } : {
        x: originSpace.x,
        y: originSpace.y
      };
      return owner.svgSession.elementPointToRootPoint(layer, lockedSpace.x, lockedSpace.y);
    }
    if (constraint.type === "angle") return owner.svgSession.projectPointToDirectedLine(rawPoint, origin, constraint.angleRad);
    return rawPoint;
  };
}
