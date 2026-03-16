// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/svgDom.mjs
// This module provides SVG DOM utilities for the Nodevision SVG editor. This module converts pointer coordinates into SVG coordinates so tools can operate in document space. This module creates and edits SVG elements so other editor components can remain declarative.

const SVG_NS = "http://www.w3.org/2000/svg";

export function createSvgEl(tag, attrs = {}) {
  const node = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, String(v)));
  return node;
}

export function toSvgPoint(svgRoot, clientX, clientY) {
  if (svgRoot && typeof svgRoot.createSVGPoint === "function") {
    const pt = svgRoot.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = typeof svgRoot.getScreenCTM === "function" ? svgRoot.getScreenCTM() : null;
    return ctm ? pt.matrixTransform(ctm.inverse()) : { x: 0, y: 0 };
  }

  const rect = svgRoot?.getBoundingClientRect?.();
  if (rect && Number.isFinite(rect.left) && Number.isFinite(rect.top)) {
    return { x: clientX - rect.left, y: clientY - rect.top };
  }

  return { x: 0, y: 0 };
}

export function ensureSvgSizeAttrs(svgRoot) {
  if (!svgRoot.getAttribute("width")) svgRoot.setAttribute("width", "800");
  if (!svgRoot.getAttribute("height")) svgRoot.setAttribute("height", "600");
  if (!svgRoot.getAttribute("viewBox")) {
    const w = Number.parseFloat(svgRoot.getAttribute("width")) || 800;
    const h = Number.parseFloat(svgRoot.getAttribute("height")) || 600;
    svgRoot.setAttribute("viewBox", `0 0 ${w} ${h}`);
  }
}

export function parsePoints(points = "") {
  return String(points)
    .trim()
    .split(/\s+/)
    .map((pair) => pair.split(",").map((n) => Number.parseFloat(n)))
    .filter((pair) => pair.length === 2 && Number.isFinite(pair[0]) && Number.isFinite(pair[1]));
}

export function formatPoints(points = []) {
  return points.map(([x, y]) => `${x},${y}`).join(" ");
}

export function getAttrNumber(el, name, fallback = 0) {
  const value = Number.parseFloat(el.getAttribute(name));
  return Number.isFinite(value) ? value : fallback;
}

export function setAttrNumber(el, name, value) {
  el.setAttribute(name, String(value));
}

export function distancePointToSegment(point, a, b) {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const apx = point.x - a.x;
  const apy = point.y - a.y;
  const abLenSq = (abx * abx) + (aby * aby);
  if (abLenSq <= 1e-9) {
    const dx = point.x - a.x;
    const dy = point.y - a.y;
    return Math.hypot(dx, dy);
  }
  const t = Math.max(0, Math.min(1, ((apx * abx) + (apy * aby)) / abLenSq));
  const closestX = a.x + (abx * t);
  const closestY = a.y + (aby * t);
  return Math.hypot(point.x - closestX, point.y - closestY);
}

