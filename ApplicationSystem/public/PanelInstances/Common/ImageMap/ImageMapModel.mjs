// Nodevision/ApplicationSystem/public/PanelInstances/Common/ImageMap/ImageMapModel.mjs
// This module defines the reusable data model and validation rules for ordinary HTML image maps.

export const IMAGE_MAP_TARGETS = Object.freeze(["", "_self", "_blank", "_parent", "_top"]);
export const IMAGE_MAP_SHAPES = Object.freeze(["rect", "circle", "poly"]);

// ------------------------------
// Coordinate normalization
// ------------------------------
function finiteInteger(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : null;
}

export function coordsFromString(value = "") {
  return String(value || "")
    .split(",")
    .map((part) => finiteInteger(part.trim()))
    .filter((part) => part !== null);
}

export function coordsToString(coords = []) {
  return (coords || [])
    .map(finiteInteger)
    .filter((part) => part !== null)
    .join(",");
}

export function normalizeShape(shape = "rect") {
  const clean = String(shape || "rect").trim().toLowerCase();
  return IMAGE_MAP_SHAPES.includes(clean) ? clean : "rect";
}

function normalizeRectCoords(coords = []) {
  const values = coords.slice(0, 4).map(finiteInteger);
  if (values.some((value) => value === null)) return [];
  const [x1, y1, x2, y2] = values;
  return [Math.min(x1, x2), Math.min(y1, y2), Math.max(x1, x2), Math.max(y1, y2)];
}

function normalizeCircleCoords(coords = []) {
  const values = coords.slice(0, 3).map(finiteInteger);
  return values.some((value) => value === null) ? [] : values;
}

function normalizePolyCoords(coords = []) {
  return coords.map(finiteInteger).filter((value) => value !== null);
}

export function normalizeCoords(shape = "rect", coords = []) {
  const cleanShape = normalizeShape(shape);
  if (cleanShape === "circle") return normalizeCircleCoords(coords);
  if (cleanShape === "poly") return normalizePolyCoords(coords);
  return normalizeRectCoords(coords);
}

// ------------------------------
// Area validation
// ------------------------------
export function validateAreaGeometry(area = {}) {
  const shape = normalizeShape(area.shape);
  const coords = Array.isArray(area.coords) ? area.coords.map(finiteInteger) : coordsFromString(area.coords);
  if (coords.some((value) => value === null)) return false;

  if (shape === "rect") {
    if (coords.length !== 4) return false;
    return coords[0] !== coords[2] && coords[1] !== coords[3];
  }
  if (shape === "circle") {
    return coords.length === 3 && coords[2] > 0;
  }
  return coords.length >= 6 && coords.length % 2 === 0;
}

export function validateImageMapModel(model = {}) {
  const errors = [];
  if (!String(model.image?.src || "").trim()) errors.push("Choose an image source.");
  if (!String(model.map?.name || "").trim()) errors.push("Enter a map name.");
  (model.areas || []).forEach((area, index) => {
    if (!validateAreaGeometry(area)) errors.push(`Area ${index + 1} has invalid coordinates.`);
  });
  return { ok: errors.length === 0, errors };
}

// ------------------------------
// Model creation
// ------------------------------
export function normalizeArea(area = {}, index = 0) {
  const shape = normalizeShape(area.shape);
  const coords = normalizeCoords(shape, Array.isArray(area.coords) ? area.coords : coordsFromString(area.coords));
  return {
    id: area.id || `area-${Date.now()}-${index}`,
    shape,
    coords,
    href: String(area.href || ""),
    alt: String(area.alt || ""),
    title: String(area.title || ""),
    target: String(area.target || ""),
    attrs: { ...(area.attrs || {}) },
  };
}

export function normalizeImageMapModel(model = {}) {
  return {
    image: {
      src: String(model.image?.src || ""),
      previewSrc: String(model.image?.previewSrc || ""),
      linkedNotebookPath: String(model.image?.linkedNotebookPath || ""),
      alt: String(model.image?.alt || ""),
      title: String(model.image?.title || ""),
      attrs: { ...(model.image?.attrs || {}) },
    },
    map: {
      name: String(model.map?.name || "image-map"),
      attrs: { ...(model.map?.attrs || {}) },
    },
    areas: (model.areas || []).map((area, index) => normalizeArea(area, index)),
  };
}

export function createBlankImageMapModel(options = {}) {
  return normalizeImageMapModel({
    image: { src: options.src || "", alt: options.alt || "", title: options.title || "" },
    map: { name: options.name || "image-map" },
    areas: [],
  });
}

export function createImageMapArea(shape, coords, attrs = {}) {
  return normalizeArea({
    shape,
    coords,
    href: attrs.href || "",
    alt: attrs.alt || "",
    title: attrs.title || "",
    target: attrs.target || "",
    attrs: attrs.attrs || {},
  });
}

export function uniqueImageMapName(existingNames = [], preferred = "image-map") {
  const taken = new Set((existingNames || []).map((name) => String(name || "").toLowerCase()));
  const base = String(preferred || "image-map").trim().replace(/[^\w-]+/g, "-") || "image-map";
  let candidate = base;
  let index = 2;
  while (taken.has(candidate.toLowerCase())) {
    candidate = `${base}-${index}`;
    index += 1;
  }
  return candidate;
}
