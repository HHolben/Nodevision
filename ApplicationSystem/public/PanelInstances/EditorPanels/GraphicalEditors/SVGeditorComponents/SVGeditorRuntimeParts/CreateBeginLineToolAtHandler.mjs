// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/CreateBeginLineToolAtHandler.mjs
// This module implements create Begin Line Tool At Handler behavior for the SVGeditorRuntime feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { createSvgEl } from "../svgDom.mjs";

// Create Begin Line Tool At Handler operations.
export function createBeginLineToolAtHandler(owner) {
  return function (rootPoint, layer = null) {
    owner.svgSession.recordLineProbe("beginLineToolAt:start");
    const targetLayer = layer || owner.svgSession.lineToolState.layer || owner.svgSession.getActiveLayer() || owner.svgSession.svgRoot;
    owner.svgSession.recordLineProbe("beginLineToolAt:after-target-layer", {
      layerTag: targetLayer?.tagName || null
    });
    const spacePoint = owner.svgSession.rootPointToElementPoint(targetLayer, rootPoint);
    owner.svgSession.recordLineProbe("beginLineToolAt:after-rootPointToElementPoint", {
      x: spacePoint.x,
      y: spacePoint.y
    });
    owner.svgSession.clearLineToolSnapCache();
    owner.svgSession.recordLineProbe("beginLineToolAt:after-clear-snap-cache");
    owner.svgSession.clearLineToolVertexMarkers();
    owner.svgSession.recordLineProbe("beginLineToolAt:after-clear-markers");
    owner.svgSession.clearSelection();
    owner.svgSession.recordLineProbe("beginLineToolAt:after-clear-selection");
    owner.svgSession.lineToolState.active = true;
    owner.svgSession.lineToolState.layer = targetLayer;
    owner.svgSession.lineToolState.startRoot = rootPoint;
    owner.svgSession.lineToolState.startSpace = spacePoint;
    owner.svgSession.lineToolState.lastPlacedRoot = rootPoint;
    owner.svgSession.lineToolState.lastPlacedSpace = {
      x: spacePoint.x,
      y: spacePoint.y
    };
    owner.svgSession.lineToolState.pointsSpace = [[spacePoint.x, spacePoint.y]];
    owner.svgSession.lineToolState.placedLines = [];
    owner.svgSession.lineToolState.cursorRoot = rootPoint;
    owner.svgSession.recordLineProbe("beginLineToolAt:after-state");
    owner.svgSession.addLineToolVertexMarker(rootPoint);
    owner.svgSession.recordLineProbe("beginLineToolAt:after-add-marker");
    owner.svgSession.updateLineToolPreview(rootPoint);
    owner.svgSession.recordLineProbe("beginLineToolAt:after-update-preview");
    owner.svgSession.setStatus("Line tool: click next point, X/Y/Z lock axis, type distance, Enter finishes, Esc cancels");
    return true;
  };
}

export function createPlaceLineToolVertexHandler(owner) {
  return function (rootPoint, layer = null) {
    owner.svgSession.recordLineProbe("placeLineToolVertex:start", {
      active: Boolean(owner.svgSession.lineToolState.active)
    });
    const targetLayer = layer || owner.svgSession.lineToolState.layer || owner.svgSession.getActiveLayer() || owner.svgSession.svgRoot;
    owner.svgSession.recordLineProbe("placeLineToolVertex:after-target-layer", {
      layerTag: targetLayer?.tagName || null
    });
    if (!owner.svgSession.lineToolState.active) {
      owner.svgSession.recordLineProbe("placeLineToolVertex:before-begin");
      const began = owner.svgSession.beginLineToolAt(rootPoint, targetLayer);
      owner.svgSession.recordLineProbe("placeLineToolVertex:after-begin");
      return began;
    }
    const spacePoint = owner.svgSession.rootPointToElementPoint(targetLayer, rootPoint);
    if (!owner.svgSession.lineToolState.startSpace) return false;
    const segmentStartRoot = owner.svgSession.lineToolState.startRoot ? {
      ...owner.svgSession.lineToolState.startRoot
    } : null;
    const dx = spacePoint.x - owner.svgSession.lineToolState.startSpace.x;
    const dy = spacePoint.y - owner.svgSession.lineToolState.startSpace.y;
    const segLen = Math.hypot(dx, dy);
    if (Number.isFinite(segLen) && segLen > 1e-6) {
      const style = owner.svgSession.currentStyleDefaults();
      const seg = createSvgEl("line", {
        x1: owner.svgSession.lineToolState.startSpace.x,
        y1: owner.svgSession.lineToolState.startSpace.y,
        x2: spacePoint.x,
        y2: spacePoint.y,
        stroke: style.stroke,
        "stroke-width": style.strokeWidth
      });
      try {
        targetLayer.appendChild(seg);
        owner.svgSession.lineToolState.placedLines.push(seg);
      } catch {
        // ignore
      }
      owner.svgSession.lineToolState.startRoot = rootPoint;
      owner.svgSession.lineToolState.startSpace = spacePoint;
      owner.svgSession.lineToolState.lastPlacedRoot = rootPoint;
      owner.svgSession.lineToolState.lastPlacedSpace = {
        x: spacePoint.x,
        y: spacePoint.y
      };
      owner.svgSession.lineToolState.pointsSpace.push([spacePoint.x, spacePoint.y]);
      owner.svgSession.lineToolState.cursorRoot = rootPoint;
      owner.svgSession.lineToolState.constraint = null;
      owner.svgSession.lineToolState.axisDistanceBuffer = "";
      owner.svgSession.lineToolState.angleInputBuffer = "";
      owner.svgSession.addLineToolSnapPoint(segmentStartRoot);
      owner.svgSession.addLineToolSnapPoint(rootPoint);
      owner.svgSession.addLineToolVertexMarker(rootPoint);
      owner.svgSession.updateLineToolPreview(rootPoint);
      owner.svgSession.setStatus("Line vertex placed");
    }
    return true;
  };
}
