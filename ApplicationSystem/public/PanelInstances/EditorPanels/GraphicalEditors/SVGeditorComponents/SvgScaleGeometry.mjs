// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SvgScaleGeometry.mjs
// This module provides reusable SVG scale geometry helpers for modal keyboard scaling in the graphical SVG editor.

// Scale factor formatting and mode mapping.
const MIN_SCALE_MAGNITUDE = 0.05;

function cleanNumber(value, fallback = 1) {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

export function formatScaleNumber(value) {
  return Number(cleanNumber(value).toFixed(6)).toString();
}

export function boundedScale(value) {
  const next = cleanNumber(value, 1);
  if (Math.abs(next) >= MIN_SCALE_MAGNITUDE) return next;
  return next < 0 ? -MIN_SCALE_MAGNITUDE : MIN_SCALE_MAGNITUDE;
}

export function scaleFactorsForMode(mode, factor) {
  const f = boundedScale(factor);
  if (mode === "x" || mode === "local-x") return { sx: f, sy: 1, local: mode === "local-x" };
  if (mode === "y" || mode === "local-y") return { sx: 1, sy: f, local: mode === "local-y" };
  return { sx: f, sy: f, local: false };
}

// Coordinate conversion helpers.
function transformAround(point, sx, sy) {
  return "translate(" + formatScaleNumber(point.x) + " " + formatScaleNumber(point.y) + ") scale(" +
    formatScaleNumber(sx) + " " + formatScaleNumber(sy) + ") translate(" + formatScaleNumber(-point.x) + " " + formatScaleNumber(-point.y) + ")";
}

function matrixPoint(matrix, x, y) {
  return { x: matrix.a * x + matrix.c * y + matrix.e, y: matrix.b * x + matrix.d * y + matrix.f };
}

export function rootPointFromClient(svgRoot, clientX, clientY) {
  const ctm = svgRoot?.getScreenCTM?.();
  if (ctm?.inverse) {
    try {
      const point = matrixPoint(ctm.inverse(), clientX, clientY);
      if (Number.isFinite(point.x) && Number.isFinite(point.y)) return point;
    } catch {
      // Fall back to viewBox-based approximation.
    }
  }
  const rect = svgRoot?.getBoundingClientRect?.();
  const box = svgRoot?.viewBox?.baseVal;
  if (!rect || !box || !rect.width || !rect.height) return null;
  return { x: box.x + ((clientX - rect.left) / rect.width) * box.width, y: box.y + ((clientY - rect.top) / rect.height) * box.height };
}

function elementPointToRootPoint(svgRoot, el, point) {
  const elToScreen = el?.getScreenCTM?.();
  const rootToScreen = svgRoot?.getScreenCTM?.();
  if (!elToScreen || !rootToScreen?.inverse) return point;
  try {
    const screen = matrixPoint(elToScreen, point.x, point.y);
    const root = matrixPoint(rootToScreen.inverse(), screen.x, screen.y);
    if (Number.isFinite(root.x) && Number.isFinite(root.y)) return root;
  } catch {
    // Use local coordinates if matrices are unavailable.
  }
  return point;
}

function rootPointToElementPoint(svgRoot, el, point) {
  const rootToScreen = svgRoot?.getScreenCTM?.();
  const elToScreen = el?.getScreenCTM?.();
  if (!rootToScreen || !elToScreen?.inverse) return point;
  try {
    const screen = matrixPoint(rootToScreen, point.x, point.y);
    const local = matrixPoint(elToScreen.inverse(), screen.x, screen.y);
    if (Number.isFinite(local.x) && Number.isFinite(local.y)) return local;
  } catch {
    // Use root coordinates if matrices are unavailable.
  }
  return point;
}

function elementBox(el) {
  try {
    const box = el?.getBBox?.();
    return box && Number.isFinite(box.x) && Number.isFinite(box.y) ? box : null;
  } catch {
    return null;
  }
}

function elementSpace(svgRoot, el) {
  const parent = el?.parentNode;
  const canCheckSvgElement = typeof SVGElement !== "undefined";
  return canCheckSvgElement && parent instanceof SVGElement && typeof parent.getScreenCTM === "function" ? parent : svgRoot;
}

function unitVector(vector, fallback) {
  const length = Math.hypot(vector.x, vector.y);
  return length > 1e-9 ? { x: vector.x / length, y: vector.y / length } : fallback;
}

export function localAxisVector(svgRoot, el, axis) {
  const fallback = axis === "y" ? { x: 0, y: 1 } : { x: 1, y: 0 };
  const box = elementBox(el);
  if (!box) return fallback;
  const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const end = axis === "y" ? { x: center.x, y: center.y + 1 } : { x: center.x + 1, y: center.y };
  const rootCenter = elementPointToRootPoint(svgRoot, el, center);
  const rootEnd = elementPointToRootPoint(svgRoot, el, end);
  return unitVector({ x: rootEnd.x - rootCenter.x, y: rootEnd.y - rootCenter.y }, fallback);
}

// Selected element transform preparation and application.
export function makeScaleItem(svgRoot, el) {
  const box = elementBox(el);
  return {
    el,
    hadTransform: el.hasAttribute("transform"),
    baseTransform: el.getAttribute("transform") || "",
    localCenter: box ? { x: box.x + box.width / 2, y: box.y + box.height / 2 } : null,
    space: elementSpace(svgRoot, el),
  };
}

export function restoreScaleItem(item) {
  if (item.hadTransform) item.el.setAttribute("transform", item.baseTransform);
  else item.el.removeAttribute("transform");
}

function setTransform(item, operation, local) {
  const base = String(item.baseTransform || "").trim();
  const next = local ? [base, operation].filter(Boolean).join(" ") : [operation, base].filter(Boolean).join(" ");
  item.el.setAttribute("transform", next);
}

export function applyScaleToItems(session, factor) {
  const factors = scaleFactorsForMode(session.mode, factor);
  session.items.forEach((item) => {
    if (!item?.el) return;
    const center = factors.local && item.localCenter
      ? item.localCenter
      : rootPointToElementPoint(session.svgRoot, item.space, session.centerRoot);
    setTransform(item, transformAround(center, factors.sx, factors.sy), factors.local);
  });
  session.factor = boundedScale(factor);
  session.applied = true;
}

// Pointer distance and projection factor calculation.
export function pointerScaleFactor(session, point) {
  if (!point) return session.factor || 1;
  const dx = point.x - session.centerRoot.x;
  const dy = point.y - session.centerRoot.y;
  if (session.mode === "uniform") {
    return Math.hypot(dx, dy) / Math.max(1e-6, Math.hypot(session.startRoot.x - session.centerRoot.x, session.startRoot.y - session.centerRoot.y));
  }
  const axis = session.mode.endsWith("y") ? session.axisY : session.axisX;
  const start = (session.startRoot.x - session.centerRoot.x) * axis.x + (session.startRoot.y - session.centerRoot.y) * axis.y;
  const next = dx * axis.x + dy * axis.y;
  if (Math.abs(start) > 1e-6) return next / start;
  const startDistance = Math.hypot(session.startRoot.x - session.centerRoot.x, session.startRoot.y - session.centerRoot.y);
  return Math.hypot(dx, dy) / Math.max(1e-6, startDistance);
}
