// Nodevision/ApplicationSystem/public/PanelInstances/Common/ImageMap/ImageMapSerialization.mjs
// This module parses, serializes, and applies standard img, map, and area elements for the reusable image map editor.

import {
  attrsFromElement,
  parseAttributesFromTag,
  serializeAttributes,
  withoutManagedAttributes,
} from "./ImageMapAttributes.mjs";
import {
  coordsFromString,
  coordsToString,
  normalizeArea,
  normalizeImageMapModel,
  validateAreaGeometry,
} from "./ImageMapModel.mjs";

const IMG_MANAGED = ["src", "usemap", "alt", "title", "data-nv-saved-src", "data-nv-blob-url", "data-nv-linked-path"];
const MAP_MANAGED = ["name"];
const AREA_MANAGED = ["shape", "coords", "href", "alt", "title", "target"];

// ------------------------------
// Parsing helpers
// ------------------------------
export function mapNameFromUsemap(usemap = "") {
  return String(usemap || "").trim().replace(/^#/, "");
}

function modelFromAttributeGroups(imgAttrs = {}, mapAttrs = {}, areaAttrsList = []) {
  const savedSrc = imgAttrs["data-nv-saved-src"] || "";
  const linkedNotebookPath = imgAttrs["data-nv-linked-path"] || "";
  return normalizeImageMapModel({
    image: {
      src: savedSrc || imgAttrs.src || "",
      previewSrc: savedSrc ? imgAttrs.src || "" : "",
      linkedNotebookPath,
      alt: imgAttrs.alt || "",
      title: imgAttrs.title || "",
      attrs: withoutManagedAttributes(imgAttrs, IMG_MANAGED),
    },
    map: {
      name: mapAttrs.name || mapNameFromUsemap(imgAttrs.usemap) || "image-map",
      attrs: withoutManagedAttributes(mapAttrs, MAP_MANAGED),
    },
    areas: areaAttrsList.map((attrs, index) => normalizeArea({
      id: attrs.id || `area-${index + 1}`,
      shape: attrs.shape || "rect",
      coords: coordsFromString(attrs.coords || ""),
      href: attrs.href || "",
      alt: attrs.alt || "",
      title: attrs.title || "",
      target: attrs.target || "",
      attrs: withoutManagedAttributes(attrs, AREA_MANAGED),
    }, index)),
  });
}

export function parseImageMapFromElements(imageEl, mapEl) {
  if (!imageEl || !mapEl) return null;
  const areaAttrs = Array.from(mapEl.querySelectorAll?.("area") || []).map(attrsFromElement);
  return modelFromAttributeGroups(attrsFromElement(imageEl), attrsFromElement(mapEl), areaAttrs);
}

export function findMapForImage(root, imageEl) {
  if (!root || !imageEl) return null;
  const name = mapNameFromUsemap(imageEl.getAttribute?.("usemap") || "");
  if (!name) return null;
  return Array.from(root.querySelectorAll?.("map[name]") || [])
    .find((map) => String(map.getAttribute("name") || "") === name) || null;
}

export function parseImageMapHtml(html = "") {
  const text = String(html || "");
  const imgTags = text.match(/<img\b[^>]*>/gi) || [];
  for (const imgTag of imgTags) {
    const imgAttrs = parseAttributesFromTag(imgTag);
    const mapName = mapNameFromUsemap(imgAttrs.usemap || "");
    if (!mapName) continue;
    const mapMatch = findMapTag(text, mapName);
    if (!mapMatch) continue;
    return modelFromAttributeGroups(imgAttrs, mapMatch.attrs, mapMatch.areaAttrs);
  }
  return null;
}

function findMapTag(html, expectedName) {
  const mapRegex = /<map\b([^>]*)>([\s\S]*?)<\/map>/gi;
  let match;
  while ((match = mapRegex.exec(html))) {
    const attrs = parseAttributesFromTag(`<map ${match[1] || ""}>`);
    if (String(attrs.name || "") !== expectedName) continue;
    const areaAttrs = (match[2].match(/<area\b[^>]*>/gi) || []).map(parseAttributesFromTag);
    return { attrs, areaAttrs };
  }
  return null;
}

// ------------------------------
// Serialization helpers
// ------------------------------
function editorImageManagedAttrs(model, options = {}) {
  const mapName = model.map.name || "image-map";
  const preview = options.editorPreview && model.image.previewSrc && model.image.previewSrc !== model.image.src;
  const attrs = {
    src: preview ? model.image.previewSrc : model.image.src,
    usemap: `#${mapName}`,
    alt: model.image.alt || "",
    title: model.image.title || "",
  };
  if (preview) attrs["data-nv-saved-src"] = model.image.src;
  return attrs;
}

function areaManagedAttrs(area) {
  return {
    shape: area.shape,
    coords: coordsToString(area.coords),
    href: area.href || "",
    alt: area.alt || "",
    title: area.title || "",
    target: area.target || "",
  };
}

export function serializeImageMap(model = {}, options = {}) {
  const normalized = normalizeImageMapModel(model);
  const imageAttrs = serializeAttributes(
    withoutManagedAttributes(normalized.image.attrs, IMG_MANAGED),
    editorImageManagedAttrs(normalized, options),
    { includeEmpty: ["alt"] },
  );
  const mapAttrs = serializeAttributes(
    withoutManagedAttributes(normalized.map.attrs, MAP_MANAGED),
    { name: normalized.map.name || "image-map" },
  );
  const areaHtml = normalized.areas
    .filter(validateAreaGeometry)
    .map((area) => {
      const attrs = serializeAttributes(
        withoutManagedAttributes(area.attrs, AREA_MANAGED),
        areaManagedAttrs(area),
        { includeEmpty: ["alt"] },
      );
      return `  <area ${attrs}>`;
    })
    .join("\n");
  return [`<img ${imageAttrs}>`, `<map ${mapAttrs}>`, areaHtml, "</map>"]
    .filter((line) => line !== "")
    .join("\n");
}

// ------------------------------
// DOM application
// ------------------------------
function replaceAttributes(element, attrs = {}, managed = {}, includeEmpty = []) {
  Array.from(element.attributes || []).forEach((attr) => element.removeAttribute(attr.name));
  const allowEmpty = new Set(includeEmpty);
  for (const [name, value] of Object.entries({ ...(attrs || {}), ...(managed || {}) })) {
    if (!name || value === null || value === undefined) continue;
    if (value === "" && !allowEmpty.has(name)) continue;
    element.setAttribute(name, String(value));
  }
}

export function applyImageMapModelToElements(model = {}, imageEl, mapEl, doc = globalThis.document) {
  if (!imageEl || !mapEl) return null;
  const normalized = normalizeImageMapModel(model);
  replaceAttributes(
    imageEl,
    withoutManagedAttributes(normalized.image.attrs, IMG_MANAGED),
    editorImageManagedAttrs(normalized, { editorPreview: true }),
    ["alt"],
  );
  replaceAttributes(mapEl, withoutManagedAttributes(normalized.map.attrs, MAP_MANAGED), { name: normalized.map.name });
  mapEl.replaceChildren?.();
  if (!mapEl.replaceChildren) mapEl.innerHTML = "";
  normalized.areas.filter(validateAreaGeometry).forEach((area) => {
    const areaEl = doc.createElement("area");
    replaceAttributes(areaEl, withoutManagedAttributes(area.attrs, AREA_MANAGED), areaManagedAttrs(area), ["alt"]);
    mapEl.appendChild(areaEl);
  });
  return { imageEl, mapEl, model: normalized };
}
