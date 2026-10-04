// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/CreateBlankSvgRoot.mjs
// This module implements create Blank Svg Root behavior for the SVGeditorRuntime feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { createSvgEl } from "../svgDom.mjs";
import { applyEditableSvgRootDefaults } from "../SvgPreservation.mjs";

// Create Blank Svg Root operations.
export const SVG_NS = "http://www.w3.org/2000/svg";

export const SVG_UI_ATTR = "data-nv-editor-ui";

export const SVG_DOCUMENT_METADATA_ID = "nv-document-metadata";

export const SVG_RULER_THICKNESS = 26;

export const SVG_RULER_SIDE = 34;

export const LINE_TOOL_AXIS_TYPES = new Set(["x", "y", "z"]);

export const SVG_ROTATION_ORIGIN_X_ATTR = "data-nv-rotation-origin-x";

export const SVG_ROTATION_ORIGIN_Y_ATTR = "data-nv-rotation-origin-y";

export const SVG_TOOL_MODES = new Set(["select", "rotate", "line", "circle", "arc", "freehand", "bezier", "sketch", "eyedropper", "eraser"]);

export const SVG_CANVAS_MIN_ZOOM = 0.1;

export const SVG_CANVAS_MAX_ZOOM = 8;

export const SVG_CANVAS_KEYBOARD_ZOOM_FACTOR = 1.1;

export function createBlankSvgRoot() {
  const root = createSvgEl("svg", {
    xmlns: SVG_NS,
    width: "800",
    height: "600",
    viewBox: "0 0 800 600"
  });
  return applyEditableSvgRootDefaults(root);
}

export function normalizeDocumentMetadataTags(value) {
  if (Array.isArray(value)) return value.map(item => String(item || "").trim()).filter(Boolean);
  return String(value || "").split(/[;,]/).map(item => item.trim()).filter(Boolean);
}

export function findDirectSvgChild(svgRoot, localName, create = false) {
  const wanted = String(localName || "").toLowerCase();
  let child = Array.from(svgRoot?.children || []).find(item => item.localName?.toLowerCase() === wanted) || null;
  if (!child && create && svgRoot) {
    child = createSvgEl(wanted);
    svgRoot.insertBefore(child, svgRoot.firstChild || null);
  }
  return child;
}

export function findSvgDocumentMetadataNode(svgRoot, create = false) {
  let node = svgRoot?.querySelector?.(`:scope > metadata#${SVG_DOCUMENT_METADATA_ID}`) || null;
  if (!node && create && svgRoot) {
    node = createSvgEl("metadata", {
      id: SVG_DOCUMENT_METADATA_ID,
      "data-nv-editor-metadata": "document",
      type: "application/json"
    });
    svgRoot.insertBefore(node, svgRoot.firstChild || null);
  }
  return node;
}

export function readSvgMetadataPayload(svgRoot) {
  const node = findSvgDocumentMetadataNode(svgRoot, false);
  if (!node) return {};
  try {
    const parsed = JSON.parse(node.textContent || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function setSvgTextChild(svgRoot, localName, value) {
  const text = String(value || "").trim();
  const child = findDirectSvgChild(svgRoot, localName, Boolean(text));
  if (!child) return;
  if (!text) {
    child.remove();
    return;
  }
  child.textContent = text;
}

export function writeSvgMetadataPayload(svgRoot, payload) {
  const clean = payload && typeof payload === "object" && !Array.isArray(payload) ? payload : {};
  const entries = Object.entries(clean).filter(([, value]) => {
    if (Array.isArray(value)) return value.length > 0;
    return String(value || "").trim() !== "";
  });
  const node = findSvgDocumentMetadataNode(svgRoot, entries.length > 0);
  if (!node) return;
  if (!entries.length) {
    node.remove();
    return;
  }
  node.textContent = JSON.stringify(Object.fromEntries(entries), null, 2);
}

export function readSvgDocumentMetadata(svgRoot) {
  const payload = readSvgMetadataPayload(svgRoot);
  return {
    formatLabel: "SVG document",
    fields: ["title", "description", "author", "tags"],
    title: (findDirectSvgChild(svgRoot, "title")?.textContent || "").trim(),
    description: (findDirectSvgChild(svgRoot, "desc")?.textContent || "").trim(),
    author: String(payload.author || "").trim(),
    tags: normalizeDocumentMetadataTags(payload.tags)
  };
}

export function applySvgDocumentMetadata(svgRoot, patch = {}) {
  const existing = readSvgMetadataPayload(svgRoot);
  setSvgTextChild(svgRoot, "title", patch.title);
  setSvgTextChild(svgRoot, "desc", patch.description);
  writeSvgMetadataPayload(svgRoot, {
    ...existing,
    author: String(patch.author || "").trim(),
    tags: normalizeDocumentMetadataTags(patch.tags)
  });
  return readSvgDocumentMetadata(svgRoot);
}
