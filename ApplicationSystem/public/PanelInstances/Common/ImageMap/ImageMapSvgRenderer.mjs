// Nodevision/ApplicationSystem/public/PanelInstances/Common/ImageMap/ImageMapSvgRenderer.mjs
// This module draws image-map areas and edit handles inside an intrinsic-coordinate SVG overlay.

import { areaBounds, normalizeImageSize } from "./ImageMapGeometry.mjs";
import { normalizeArea, validateAreaGeometry } from "./ImageMapModel.mjs";

const SVG_NS = "http://www.w3.org/2000/svg";
const HANDLE_SIZE = 8;

// ------------------------------
// SVG helpers
// ------------------------------
function svgElement(tag, attrs = {}) {
  const element = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([name, value]) => element.setAttribute(name, String(value)));
  return element;
}

function pointPairs(coords = []) {
  const pairs = [];
  for (let index = 0; index + 1 < coords.length; index += 2) {
    pairs.push(`${coords[index]},${coords[index + 1]}`);
  }
  return pairs.join(" ");
}

function appendHandle(group, areaId, x, y, handle, vertexIndex = null) {
  const rect = svgElement("rect", {
    class: "nv-image-map-handle",
    x: x - (HANDLE_SIZE / 2),
    y: y - (HANDLE_SIZE / 2),
    width: HANDLE_SIZE,
    height: HANDLE_SIZE,
    "data-area-id": areaId,
    "data-handle": handle,
  });
  if (vertexIndex !== null) rect.dataset.vertexIndex = String(vertexIndex);
  group.appendChild(rect);
}

// ------------------------------
// Region drawing
// ------------------------------
function appendRegionShape(group, area, selected) {
  const attrs = { class: "nv-image-map-region", "data-area-id": area.id, "data-selected": String(Boolean(selected)) };
  if (area.shape === "circle") {
    const [cx, cy, r] = area.coords;
    group.appendChild(svgElement("circle", { ...attrs, cx, cy, r }));
    return;
  }
  if (area.shape === "poly") {
    group.appendChild(svgElement("polygon", { ...attrs, points: pointPairs(area.coords) }));
    return;
  }
  const [x1, y1, x2, y2] = area.coords;
  group.appendChild(svgElement("rect", { ...attrs, x: x1, y: y1, width: x2 - x1, height: y2 - y1 }));
}

function appendHandles(group, area) {
  if (area.shape === "circle") {
    const [cx, cy, r] = area.coords;
    appendHandle(group, area.id, cx, cy, "center");
    appendHandle(group, area.id, cx + r, cy, "radius");
    return;
  }
  if (area.shape === "poly") {
    for (let index = 0; index + 1 < area.coords.length; index += 2) {
      appendHandle(group, area.id, area.coords[index], area.coords[index + 1], "vertex", index / 2);
    }
    return;
  }
  const { x1, y1, x2, y2 } = areaBounds(area);
  appendHandle(group, area.id, x1, y1, "nw");
  appendHandle(group, area.id, x2, y1, "ne");
  appendHandle(group, area.id, x1, y2, "sw");
  appendHandle(group, area.id, x2, y2, "se");
}

function appendAreaGroup(svg, area, selected) {
  if (!validateAreaGeometry(area)) return;
  const normalized = normalizeArea(area);
  const group = svgElement("g", { "data-area-id": normalized.id });
  appendRegionShape(group, normalized, selected);
  if (selected) appendHandles(group, normalized);
  svg.appendChild(group);
}

// ------------------------------
// Public rendering
// ------------------------------
export function renderImageMapSvg(svg, model = {}, selectedAreaId = "", draftArea = null, imageSize = {}) {
  if (!svg) return;
  const size = normalizeImageSize(imageSize);
  svg.setAttribute("viewBox", `0 0 ${size.width} ${size.height}`);
  svg.replaceChildren?.();
  if (!svg.replaceChildren) svg.innerHTML = "";
  (model.areas || []).forEach((area) => appendAreaGroup(svg, area, area.id === selectedAreaId));
  if (draftArea) {
    const draft = normalizeArea({ ...draftArea, id: "draft-area" });
    appendAreaGroup(svg, draft, true);
  }
}
