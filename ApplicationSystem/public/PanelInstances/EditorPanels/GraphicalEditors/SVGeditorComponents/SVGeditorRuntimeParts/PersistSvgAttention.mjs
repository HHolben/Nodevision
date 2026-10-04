// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/PersistSvgAttention.mjs
// This module implements persist Svg Attention behavior for the SVGeditorRuntime feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { saveEditingContext } from "../../../../../EditorAttentionState.mjs";
import { createSvgEl, formatPoints } from "../svgDom.mjs";
import { SVG_UI_ATTR } from "./CreateBlankSvgRoot.mjs";

// Persist Svg Attention operations.
export function persistSvgAttention(filePath, root, tool) {
  if (!filePath) return;
  saveEditingContext(filePath, {
    editorMode: "SVGediting",
    activeTool: tool || null,
    scroll: {
      top: root?.scrollTop || 0,
      left: root?.scrollLeft || 0
    }
  });
}

export function createAddLineToolVertexMarkerHandler(owner) {
  return function (rootPoint) {
    if (!rootPoint) return null;
    const x = Number(rootPoint.x);
    const y = Number(rootPoint.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    const svgUnitsPerCssPx = owner.svgSession.pointerToleranceInSvgUnits(1);
    const r = Math.max(2.75, 4.75 * svgUnitsPerCssPx);
    const strokeWidth = Math.max(1, 1.5 * svgUnitsPerCssPx);
    const marker = createSvgEl("circle", {
      [SVG_UI_ATTR]: "line-tool-vertex-marker",
      cx: String(x),
      cy: String(y),
      r: String(r),
      fill: "#2f80ff",
      stroke: "#ffffff",
      "stroke-width": String(strokeWidth)
    });
    marker.style.setProperty("pointer-events", "none", "important");
    marker.style.setProperty("fill", "#2f80ff", "important");
    marker.style.setProperty("stroke", "#ffffff", "important");
    marker.style.setProperty("stroke-width", String(strokeWidth), "important");
    marker.style.setProperty("display", "inline", "important");
    marker.style.setProperty("visibility", "visible", "important");
    marker.style.setProperty("opacity", "1", "important");
    owner.svgSession.lineToolVertexMarkerLayer.appendChild(marker);
    owner.svgSession.lineToolState.vertexMarkers.push(marker);
    owner.svgSession.recordLineProbe("line:vertex-marker:inserted", {
      markerCount: owner.svgSession.lineToolState.vertexMarkers.length
    });
    return marker;
  };
}

export function createCommitLineToolGeometryHandler(owner) {
  return function () {
    const layer = owner.svgSession.lineToolState.layer;
    const points = owner.svgSession.lineToolState.pointsSpace || [];
    if (!layer || !Array.isArray(points) || points.length < 2) return null;
    if (points.length === 2) {
      const lastLine = owner.svgSession.lineToolState.placedLines[owner.svgSession.lineToolState.placedLines.length - 1] || null;
      if (lastLine) owner.svgSession.setSelection([lastLine], {
        primary: lastLine
      });
      return lastLine;
    }
    const style = owner.svgSession.currentStyleDefaults();
    const poly = createSvgEl("polygon", {
      points: formatPoints(points),
      fill: style.fill,
      stroke: style.stroke,
      "stroke-width": style.strokeWidth
    });
    try {
      owner.svgSession.lineToolState.placedLines.forEach(el => {
        try {
          el.remove();
        } catch {
          // ignore
        }
      });
      layer.appendChild(poly);
    } catch {
      // ignore
    }
    owner.svgSession.setSelection([poly], {
      primary: poly
    });
    return poly;
  };
}

export function createFinishLineToolHandler(owner) {
  return function () {
    if (!owner.svgSession.lineToolState.active) return false;
    owner.svgSession.commitLineToolGeometry();
    owner.svgSession.lineToolState.active = false;
    owner.svgSession.lineToolState.startRoot = null;
    owner.svgSession.lineToolState.startSpace = null;
    owner.svgSession.lineToolState.lastPlacedRoot = null;
    owner.svgSession.lineToolState.lastPlacedSpace = null;
    owner.svgSession.lineToolState.placedLines = [];
    owner.svgSession.lineToolState.pointsSpace = [];
    owner.svgSession.lineToolState.cursorRoot = null;
    owner.svgSession.lineToolState.constraint = null;
    owner.svgSession.lineToolState.commandBuffer = "";
    if (owner.svgSession.lineToolState.commandTimer) window.clearTimeout(owner.svgSession.lineToolState.commandTimer);
    owner.svgSession.lineToolState.commandTimer = null;
    owner.svgSession.lineToolState.axisDistanceBuffer = "";
    owner.svgSession.lineToolState.angleInputBuffer = "";
    owner.svgSession.lineToolState.grab = null;
    owner.svgSession.clearLineToolSnapCache();
    owner.svgSession.clearLineToolVertexMarkers();
    owner.svgSession.hideLineToolOverlays();
    owner.svgSession.setStatus("Line tool finished");
    return true;
  };
}

export function createCircleFromThreePointsHandler(owner) {
  return function (a, b, c) {
    const ax = Number(a?.x),
      ay = Number(a?.y);
    const bx = Number(b?.x),
      by = Number(b?.y);
    const cx = Number(c?.x),
      cy = Number(c?.y);
    if (![ax, ay, bx, by, cx, cy].every(Number.isFinite)) return null;
    const d = 2 * (ax * (by - cy) + bx * (cy - ay) + cx * (ay - by));
    if (Math.abs(d) < 1e-9) return null;
    const a2 = ax * ax + ay * ay;
    const b2 = bx * bx + by * by;
    const c2 = cx * cx + cy * cy;
    const ux = (a2 * (by - cy) + b2 * (cy - ay) + c2 * (ay - by)) / d;
    const uy = (a2 * (cx - bx) + b2 * (ax - cx) + c2 * (bx - ax)) / d;
    const r = Math.hypot(ax - ux, ay - uy);
    if (!Number.isFinite(r) || r <= 1e-9) return null;
    return {
      x: ux,
      y: uy,
      r
    };
  };
}
