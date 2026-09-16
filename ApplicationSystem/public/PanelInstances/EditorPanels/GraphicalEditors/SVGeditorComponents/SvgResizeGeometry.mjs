// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SvgResizeGeometry.mjs
// This module provides reusable resize geometry helpers for the graphical SVG editor.

const DEFAULT_MIN_SCALE_MAGNITUDE = 0.05;

function finiteNumber(value, fallback = 0) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

export function keepScaleOutsideDeadZone(scale, minScaleMagnitude = DEFAULT_MIN_SCALE_MAGNITUDE) {
  const next = finiteNumber(scale, 1);
  const min = Math.max(0, finiteNumber(minScaleMagnitude, DEFAULT_MIN_SCALE_MAGNITUDE));
  if (Math.abs(next) >= min) return next;
  return next < 0 ? -min : min;
}

function signedMagnitude(signSource, magnitude) {
  return signSource < 0 ? -magnitude : magnitude;
}

export function cornerResizeScale({ bbox, corner, point, preserveAspect = false, minScaleMagnitude = DEFAULT_MIN_SCALE_MAGNITUDE } = {}) {
  const width = Math.max(1e-6, finiteNumber(bbox?.width, 0));
  const height = Math.max(1e-6, finiteNumber(bbox?.height, 0));
  const anchor = {
    x: String(corner || "").includes("w") ? finiteNumber(bbox?.x, 0) + width : finiteNumber(bbox?.x, 0),
    y: String(corner || "").includes("n") ? finiteNumber(bbox?.y, 0) + height : finiteNumber(bbox?.y, 0),
  };
  const p = {
    x: finiteNumber(point?.x, anchor.x),
    y: finiteNumber(point?.y, anchor.y),
  };
  const rawScaleX = String(corner || "").includes("w")
    ? (anchor.x - p.x) / width
    : (p.x - anchor.x) / width;
  const rawScaleY = String(corner || "").includes("n")
    ? (anchor.y - p.y) / height
    : (p.y - anchor.y) / height;

  let sx = rawScaleX;
  let sy = rawScaleY;
  if (preserveAspect) {
    const magnitude = Math.max(Math.abs(rawScaleX), Math.abs(rawScaleY));
    sx = signedMagnitude(rawScaleX, magnitude);
    sy = signedMagnitude(rawScaleY, magnitude);
  }

  return {
    anchor,
    sx: keepScaleOutsideDeadZone(sx, minScaleMagnitude),
    sy: keepScaleOutsideDeadZone(sy, minScaleMagnitude),
    rawScaleX,
    rawScaleY,
  };
}
