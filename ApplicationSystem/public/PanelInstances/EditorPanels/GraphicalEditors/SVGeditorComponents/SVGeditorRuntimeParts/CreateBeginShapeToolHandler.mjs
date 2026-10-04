// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/CreateBeginShapeToolHandler.mjs
// This module implements create Begin Shape Tool Handler behavior for the SVGeditorRuntime feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { createSvgEl } from "../svgDom.mjs";

// Create Begin Shape Tool Handler operations.
export function createBeginShapeToolHandler(owner) {
  return function (kind, rootPoint, layer) {
    const targetLayer = layer || owner.svgSession.getActiveLayer() || owner.svgSession.svgRoot;
    owner.svgSession.shapeToolState.kind = kind;
    owner.svgSession.shapeToolState.active = true;
    owner.svgSession.shapeToolState.layer = targetLayer;
    owner.svgSession.shapeToolState.pointsRoot = [{
      x: rootPoint.x,
      y: rootPoint.y
    }];
    owner.svgSession.shapeToolState.pointsSpace = [owner.svgSession.rootPointToElementPoint(targetLayer, rootPoint)];
    if (kind === "circle") {
      owner.svgSession.shapeToolPreviewCircle.setAttribute("cx", String(rootPoint.x));
      owner.svgSession.shapeToolPreviewCircle.setAttribute("cy", String(rootPoint.y));
      owner.svgSession.shapeToolPreviewCircle.setAttribute("r", "0");
      owner.svgSession.shapeToolPreviewCircle.setAttribute("display", "");
      owner.svgSession.shapeToolPreviewPath.setAttribute("display", "none");
      owner.svgSession.setStatus("Circle: click a second point to set the radius");
    } else {
      owner.svgSession.shapeToolPreviewPath.setAttribute("d", `M ${rootPoint.x} ${rootPoint.y}`);
      owner.svgSession.shapeToolPreviewPath.setAttribute("display", "");
      owner.svgSession.shapeToolPreviewCircle.setAttribute("display", "none");
      owner.svgSession.setStatus("Arc: click a point on the arc, then click the end point");
    }
  };
}

export function createPlaceShapeToolPointHandler(owner) {
  return function (kind, rootPoint) {
    const layer = owner.svgSession.shapeToolState.layer || owner.svgSession.getActiveLayer() || owner.svgSession.svgRoot;
    if (!owner.svgSession.shapeToolState.active || owner.svgSession.shapeToolState.kind !== kind) {
      owner.svgSession.beginShapeTool(kind, rootPoint, layer);
      return true;
    }
    owner.svgSession.shapeToolState.pointsRoot.push({
      x: rootPoint.x,
      y: rootPoint.y
    });
    owner.svgSession.shapeToolState.pointsSpace.push(owner.svgSession.rootPointToElementPoint(layer, rootPoint));
    if (kind === "circle" && owner.svgSession.shapeToolState.pointsSpace.length >= 2) {
      const [center, edge] = owner.svgSession.shapeToolState.pointsSpace;
      const radius = Math.hypot(edge.x - center.x, edge.y - center.y);
      if (Number.isFinite(radius) && radius > 0) {
        const style = owner.svgSession.currentStyleDefaults();
        owner.svgSession.runSvgSnapshotOperation("draw-circle", () => {
          const circle = createSvgEl("circle", {
            cx: owner.svgSession.formatSvgNumber(center.x),
            cy: owner.svgSession.formatSvgNumber(center.y),
            r: owner.svgSession.formatSvgNumber(radius),
            fill: style.fill,
            stroke: style.stroke,
            "stroke-width": style.strokeWidth
          });
          owner.svgSession.appendElement(circle);
          return circle;
        });
        owner.svgSession.setStatus("Circle drawn");
      }
      owner.svgSession.clearShapeToolState();
      return true;
    }
    if (kind === "arc") {
      if (owner.svgSession.shapeToolState.pointsSpace.length === 2) {
        owner.svgSession.setStatus("Arc: click the end point");
        owner.svgSession.updateShapeToolPreview(rootPoint);
        return true;
      }
      if (owner.svgSession.shapeToolState.pointsSpace.length >= 3) {
        const [start, through, end] = owner.svgSession.shapeToolState.pointsSpace;
        const d = owner.svgSession.svgArcPathFromThreePoints(start, through, end);
        const style = owner.svgSession.currentStyleDefaults();
        owner.svgSession.runSvgSnapshotOperation("draw-arc", () => {
          const arc = createSvgEl("path", {
            d,
            fill: "none",
            stroke: style.stroke,
            "stroke-width": style.strokeWidth,
            "stroke-linecap": "round"
          });
          owner.svgSession.appendElement(arc);
          return arc;
        });
        owner.svgSession.setStatus("Arc drawn");
        owner.svgSession.clearShapeToolState();
        return true;
      }
    }
    return true;
  };
}

export function createUpdateLineToolAngleArcHandler(owner) {
  return function (start, current) {
    if (!start || !current) {
      owner.svgSession.lineToolAngleArc.setAttribute("display", "none");
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
      owner.svgSession.lineToolAngleArc.setAttribute("display", "none");
      return;
    }
    const minR = owner.svgSession.pointerToleranceInSvgUnits(14);
    const maxR = owner.svgSession.pointerToleranceInSvgUnits(72);
    const r = Math.max(minR, Math.min(maxR, len * 0.7));
    const theta = Math.atan2(dy, dx); // SVG coords: +y down -> positive theta is clockwise
    const startPt = {
      x: start.x + r,
      y: start.y
    };
    const endPt = {
      x: start.x + r * Math.cos(theta),
      y: start.y + r * Math.sin(theta)
    };
    const sweep = theta >= 0 ? 1 : 0;
    const dot = Math.max(0.001, owner.svgSession.pointerToleranceInSvgUnits(0.6));
    const gap = Math.max(dot * 2, owner.svgSession.pointerToleranceInSvgUnits(5));
    owner.svgSession.lineToolAngleArc.setAttribute("stroke-width", String(Math.max(0.001, owner.svgSession.pointerToleranceInSvgUnits(1.25))));
    owner.svgSession.lineToolAngleArc.setAttribute("stroke-dasharray", String(dot) + " " + String(gap));
    owner.svgSession.lineToolAngleArc.setAttribute("d", `M ${startPt.x} ${startPt.y} A ${r} ${r} 0 0 ${sweep} ${endPt.x} ${endPt.y}`);
    owner.svgSession.lineToolAngleArc.setAttribute("display", "");
  };
}
