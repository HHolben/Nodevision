// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/DrawingGuideRenderers.mjs
// This module renders SVG rectangular, isometric, symmetry, and perspective drawing guide overlays for the graphical editor.

function fmt(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  return String(Number(n.toFixed(3)));
}

function line(createSvgEl, a, b, attrs = {}) {
  return createSvgEl("line", {
    x1: fmt(a.x),
    y1: fmt(a.y),
    x2: fmt(b.x),
    y2: fmt(b.y),
    ...attrs,
  });
}

function guideAttrs(settings, uiAttrName) {
  return {
    [uiAttrName]: "drawing-guide",
    "data-nv-drawing-guide": "true",
    stroke: "#2563eb",
    "stroke-width": "0.6",
    "stroke-opacity": fmt(settings.guideOpacity ?? 0.35),
    "stroke-dasharray": "4 4",
    fill: "none",
    "pointer-events": "none",
  };
}

function viewRect(getViewBox) {
  const vb = typeof getViewBox === "function" ? getViewBox() : null;
  return vb && Number.isFinite(vb.x) && Number.isFinite(vb.width)
    ? vb
    : { x: 0, y: 0, width: 800, height: 600 };
}

export function appendRectGrid(group, createSvgEl, settings, getViewBox, uiAttrName) {
  const vb = viewRect(getViewBox);
  const spacing = Math.max(0.001, Number(settings.guideSpacing) || 24);
  const attrs = guideAttrs(settings, uiAttrName);
  const startX = Math.floor(vb.x / spacing) * spacing;
  const endX = vb.x + vb.width;
  const startY = Math.floor(vb.y / spacing) * spacing;
  const endY = vb.y + vb.height;
  for (let x = startX; x <= endX; x += spacing) {
    group.appendChild(line(createSvgEl, { x, y: vb.y }, { x, y: endY }, attrs));
  }
  for (let y = startY; y <= endY; y += spacing) {
    group.appendChild(line(createSvgEl, { x: vb.x, y }, { x: endX, y }, attrs));
  }
}

export function appendIsometricGrid(group, createSvgEl, settings, getViewBox, uiAttrName) {
  appendRectGrid(group, createSvgEl, settings, getViewBox, uiAttrName);
  const vb = viewRect(getViewBox);
  const spacing = Math.max(0.001, Number(settings.guideSpacing) || 24);
  const attrs = guideAttrs(settings, uiAttrName);
  const angle = ((Number(settings.guideAngle) || 30) * Math.PI) / 180;
  const slope = Math.tan(angle);
  const span = Math.max(vb.width, vb.height) * 2;
  for (let x = vb.x - span; x <= vb.x + vb.width + span; x += spacing) {
    group.appendChild(line(createSvgEl, { x, y: vb.y }, { x: x + vb.height / Math.max(slope, 0.001), y: vb.y + vb.height }, attrs));
    group.appendChild(line(createSvgEl, { x, y: vb.y + vb.height }, { x: x + vb.height / Math.max(slope, 0.001), y: vb.y }, attrs));
  }
}

export function appendSymmetry(group, createSvgEl, settings, getViewBox, uiAttrName) {
  const vb = viewRect(getViewBox);
  const origin = settings.guideOrigin || { x: vb.x + vb.width / 2, y: vb.y + vb.height / 2 };
  const attrs = {
    ...guideAttrs(settings, uiAttrName),
    stroke: "#d97706",
    "stroke-width": "1",
    "stroke-dasharray": "8 5",
  };
  const type = settings.guideType;
  if (type === "horizontal-symmetry" || type === "quadrant-symmetry" || type === "radial-symmetry") {
    group.appendChild(line(createSvgEl, { x: vb.x, y: origin.y }, { x: vb.x + vb.width, y: origin.y }, attrs));
  }
  if (type === "vertical-symmetry" || type === "quadrant-symmetry" || type === "radial-symmetry") {
    group.appendChild(line(createSvgEl, { x: origin.x, y: vb.y }, { x: origin.x, y: vb.y + vb.height }, attrs));
  }
  if (type === "radial-symmetry") {
    const count = Math.max(2, Math.min(64, Math.round(Number(settings.radialSegmentCount) || 8)));
    const radius = Math.hypot(vb.width, vb.height);
    for (let i = 0; i < count; i += 1) {
      const theta = (Math.PI * 2 * i) / count;
      group.appendChild(line(createSvgEl, origin, {
        x: origin.x + Math.cos(theta) * radius,
        y: origin.y + Math.sin(theta) * radius,
      }, attrs));
    }
  }
}

export function appendPerspective(group, createSvgEl, settings, getViewBox, uiAttrName) {
  const vb = viewRect(getViewBox);
  const attrs = guideAttrs(settings, uiAttrName);
  const points = [settings.vanishingPoint1 || { x: vb.x + vb.width / 2, y: vb.y + vb.height * 0.3 }];
  if (settings.guideType === "two-point-perspective") {
    points.push(settings.vanishingPoint2 || { x: vb.x + vb.width * 0.85, y: vb.y + vb.height * 0.3 });
  }
  const anchors = [];
  const step = Math.max(24, Math.min(vb.width, vb.height) / 5);
  for (let x = vb.x; x <= vb.x + vb.width; x += step) {
    anchors.push({ x, y: vb.y }, { x, y: vb.y + vb.height });
  }
  for (let y = vb.y; y <= vb.y + vb.height; y += step) {
    anchors.push({ x: vb.x, y }, { x: vb.x + vb.width, y });
  }
  points.forEach((vp) => {
    anchors.forEach((anchor) => group.appendChild(line(createSvgEl, vp, anchor, attrs)));
    const dot = createSvgEl("circle", {
      ...attrs,
      cx: fmt(vp.x),
      cy: fmt(vp.y),
      r: fmt(Math.max(2, Math.min(vb.width, vb.height) * 0.006)),
      fill: "#d97706",
      stroke: "#7c2d12",
      "stroke-dasharray": "",
    });
    group.appendChild(dot);
  });
}
