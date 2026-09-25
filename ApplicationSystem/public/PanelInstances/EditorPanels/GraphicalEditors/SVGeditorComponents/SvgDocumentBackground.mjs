// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SvgDocumentBackground.mjs
// This module owns Nodevision's managed SVG document background representation, including geometry, paint-server definitions, ID collision avoidance, and conversion to the shared appearance model.

import { normalizeAppearance, DEFAULT_PATTERNS } from "../../../Common/Appearance/AppearanceModel.mjs";

const SVG_NS = "http://www.w3.org/2000/svg";
export const BACKGROUND_OWNER_ATTR = "data-nv-svg-background";
export const BACKGROUND_OWNER_VALUE = "document";
const BACKGROUND_ID_BASE = "nv-svg-document-background";
const FILL_RECT_ATTR = "data-nv-svg-background-fill";
const OUTLINE_RECT_ATTR = "data-nv-svg-background-outline";
const PAINT_SERVER_ATTR = "data-nv-svg-background-paint-server";

function svgEl(tag) {
  return document.createElementNS(SVG_NS, tag);
}

function cssEscape(value) {
  if (globalThis.CSS?.escape) return globalThis.CSS.escape(String(value));
  return String(value).split("").map((char) => /[a-zA-Z0-9_-]/.test(char) ? char : "\\" + char).join("");
}

function numeric(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function getSvgViewBox(svgRoot) {
  const parts = String(svgRoot?.getAttribute?.("viewBox") || "").trim().split(/\s+/).map(Number);
  const fallbackW = numeric(svgRoot?.getAttribute?.("width"), 800) || 800;
  const fallbackH = numeric(svgRoot?.getAttribute?.("height"), 600) || 600;
  return {
    x: Number.isFinite(parts[0]) ? parts[0] : 0,
    y: Number.isFinite(parts[1]) ? parts[1] : 0,
    width: Math.max(1, Number.isFinite(parts[2]) ? parts[2] : fallbackW),
    height: Math.max(1, Number.isFinite(parts[3]) ? parts[3] : fallbackH),
  };
}

function directChild(svgRoot, localName) {
  return Array.from(svgRoot?.children || []).find((child) => child.localName?.toLowerCase() === localName) || null;
}

function ensureDefs(svgRoot) {
  let defs = directChild(svgRoot, "defs");
  if (defs) return defs;
  defs = svgEl("defs");
  const firstGraphic = Array.from(svgRoot.childNodes || []).find((node) =>
    node.nodeType === Node.ELEMENT_NODE &&
    !["title", "desc", "metadata"].includes(node.localName?.toLowerCase())
  ) || null;
  svgRoot.insertBefore(defs, firstGraphic);
  return defs;
}

function uniqueId(svgRoot, base, current = "") {
  if (current && svgRoot.querySelector(`#${cssEscape(current)}`)) return current;
  if (!svgRoot.querySelector(`#${cssEscape(base)}`)) return base;
  let i = 2;
  while (svgRoot.querySelector(`#${cssEscape(`${base}-${i}`)}`)) i += 1;
  return `${base}-${i}`;
}

function backgroundOwnerNodes(svgRoot) {
  return Array.from(svgRoot?.children || []).filter((node) =>
    node.nodeType === Node.ELEMENT_NODE &&
    node.getAttribute?.(BACKGROUND_OWNER_ATTR) === BACKGROUND_OWNER_VALUE
  );
}

function findBackgroundGroup(svgRoot) {
  const managed = backgroundOwnerNodes(svgRoot).find((node) => node.localName?.toLowerCase() === "g") || null;
  return managed;
}

function removeDuplicateBackgroundOwners(svgRoot, keep = null) {
  backgroundOwnerNodes(svgRoot).forEach((node) => {
    if (node !== keep) node.remove();
  });
}

function insertionReference(svgRoot) {
  return Array.from(svgRoot.childNodes || []).find((node) => {
    if (node.nodeType !== Node.ELEMENT_NODE) return false;
    const name = node.localName?.toLowerCase();
    if (["title", "desc", "metadata", "defs"].includes(name)) return false;
    if (node.getAttribute?.(BACKGROUND_OWNER_ATTR) === BACKGROUND_OWNER_VALUE) return false;
    if (node.getAttribute?.("data-nv-editor-ui")) return false;
    return true;
  }) || null;
}

function ensureBackgroundGroup(svgRoot) {
  let group = findBackgroundGroup(svgRoot);
  if (!group) {
    group = svgEl("g");
    group.setAttribute(BACKGROUND_OWNER_ATTR, BACKGROUND_OWNER_VALUE);
    group.setAttribute("data-nv-locked", "true");
    group.setAttribute("pointer-events", "none");
    group.setAttribute("aria-label", "SVG document background");
    group.setAttribute("id", uniqueId(svgRoot, BACKGROUND_ID_BASE));
    svgRoot.insertBefore(group, insertionReference(svgRoot));
  }
  let fillRect = group.querySelector(`:scope > rect[${FILL_RECT_ATTR}]`);
  if (!fillRect) {
    fillRect = svgEl("rect");
    fillRect.setAttribute(FILL_RECT_ATTR, "true");
    group.insertBefore(fillRect, group.firstChild || null);
  }
  let outlineRect = group.querySelector(`:scope > rect[${OUTLINE_RECT_ATTR}]`);
  if (!outlineRect) {
    outlineRect = svgEl("rect");
    outlineRect.setAttribute(OUTLINE_RECT_ATTR, "true");
    group.appendChild(outlineRect);
  }
  removeDuplicateBackgroundOwners(svgRoot, group);
  group.setAttribute("pointer-events", "none");
  return { group, fillRect, outlineRect };
}

function removeBackgroundGroupIfTransparent(svgRoot, appearance) {
  if (appearance.fill.type !== "none" || appearance.outline.enabled) return false;
  removeDuplicateBackgroundOwners(svgRoot, null);
  removeOwnedPaintServers(svgRoot);
  return true;
}

function removeOwnedPaintServers(svgRoot) {
  Array.from(svgRoot?.querySelectorAll?.(`[${PAINT_SERVER_ATTR}]`) || []).forEach((node) => node.remove());
}

function ensureOwnedPaintServer(svgRoot, kind) {
  const defs = ensureDefs(svgRoot);
  const tag = kind === "pattern" ? "pattern" : "linearGradient";
  const base = kind === "pattern" ? "nv-svg-bg-pattern" : "nv-svg-bg-linear-gradient";
  let node = Array.from(defs.children).find((child) =>
    child.localName?.toLowerCase() === tag.toLowerCase() &&
    child.getAttribute(PAINT_SERVER_ATTR) === kind
  ) || null;
  if (!node) {
    node = svgEl(tag);
    node.setAttribute(PAINT_SERVER_ATTR, kind);
    node.setAttribute("id", uniqueId(svgRoot, base));
    defs.appendChild(node);
  }
  return node;
}

function writeGradient(svgRoot, appearance) {
  const gradient = ensureOwnedPaintServer(svgRoot, "gradient");
  gradient.innerHTML = "";
  gradient.setAttribute("gradientUnits", "objectBoundingBox");
  gradient.setAttribute("x1", "0%");
  gradient.setAttribute("y1", "0%");
  gradient.setAttribute("x2", "100%");
  gradient.setAttribute("y2", "0%");
  const stop1 = svgEl("stop");
  stop1.setAttribute("offset", "0%");
  stop1.setAttribute("stop-color", appearance.fill.gradient.from);
  const stop2 = svgEl("stop");
  stop2.setAttribute("offset", "100%");
  stop2.setAttribute("stop-color", appearance.fill.gradient.to);
  gradient.append(stop1, stop2);
  return `url(#${gradient.id})`;
}

function writePattern(svgRoot, appearance) {
  const pattern = ensureOwnedPaintServer(svgRoot, "pattern");
  pattern.innerHTML = "";
  pattern.setAttribute("patternUnits", "userSpaceOnUse");
  pattern.setAttribute("width", "12");
  pattern.setAttribute("height", "12");
  const bg = svgEl("rect");
  bg.setAttribute("width", "12");
  bg.setAttribute("height", "12");
  bg.setAttribute("fill", appearance.fill.pattern.background);
  pattern.appendChild(bg);
  if (appearance.fill.pattern.key === "dots") {
    const dot = svgEl("circle");
    dot.setAttribute("cx", "3");
    dot.setAttribute("cy", "3");
    dot.setAttribute("r", "1.4");
    dot.setAttribute("fill", appearance.fill.pattern.foreground);
    pattern.appendChild(dot);
  } else if (appearance.fill.pattern.key === "grid") {
    const path = svgEl("path");
    path.setAttribute("d", "M 12 0 L 0 0 0 12");
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", appearance.fill.pattern.foreground);
    path.setAttribute("stroke-width", "1");
    pattern.appendChild(path);
  } else {
    const path = svgEl("path");
    path.setAttribute("d", "M -3 12 L 12 -3 M 3 15 L 15 3");
    path.setAttribute("stroke", appearance.fill.pattern.foreground);
    path.setAttribute("stroke-width", "2");
    pattern.appendChild(path);
  }
  return `url(#${pattern.id})`;
}

function paintForFill(svgRoot, appearance) {
  if (appearance.fill.type === "solid") return appearance.fill.color;
  if (appearance.fill.type === "gradient") return writeGradient(svgRoot, appearance);
  if (appearance.fill.type === "pattern") return writePattern(svgRoot, appearance);
  return "none";
}

function readOwnedGradient(svgRoot) {
  const gradient = svgRoot.querySelector(`[${PAINT_SERVER_ATTR}="gradient"]`);
  const stops = Array.from(gradient?.querySelectorAll?.("stop") || []);
  return {
    from: stops[0]?.getAttribute("stop-color") || "#ffffff",
    to: stops[1]?.getAttribute("stop-color") || "#d7e8ff",
  };
}

function readOwnedPattern(svgRoot) {
  const pattern = svgRoot.querySelector(`[${PAINT_SERVER_ATTR}="pattern"]`);
  const foreground = pattern?.querySelector?.("path,circle")?.getAttribute("stroke") ||
    pattern?.querySelector?.("path,circle")?.getAttribute("fill") ||
    "#4b5563";
  const background = pattern?.querySelector?.("rect")?.getAttribute("fill") || "#ffffff";
  return { foreground, background };
}

function readFillType(fill = "") {
  if (!fill || fill === "none") return "none";
  if (/url\(#/.test(fill)) return "gradient";
  return "solid";
}

export function readSvgDocumentBackgroundAppearance(svgRoot) {
  const group = findBackgroundGroup(svgRoot);
  if (!group) return normalizeAppearance();
  const fillRect = group.querySelector(`:scope > rect[${FILL_RECT_ATTR}]`);
  const outlineRect = group.querySelector(`:scope > rect[${OUTLINE_RECT_ATTR}]`);
  const fill = fillRect?.getAttribute("fill") || "none";
  const type = readFillType(fill);
  const gradient = readOwnedGradient(svgRoot);
  const pattern = readOwnedPattern(svgRoot);
  const isPattern = fill && /url\(#/.test(fill) && svgRoot.querySelector(`[${PAINT_SERVER_ATTR}="pattern"]`);
  return normalizeAppearance({
    fill: {
      type: isPattern ? "pattern" : type,
      color: type === "solid" ? fill : "#ffffff",
      opacity: fillRect?.getAttribute("fill-opacity") || 1,
      gradient,
      pattern,
    },
    outline: {
      enabled: outlineRect?.getAttribute("stroke") && outlineRect.getAttribute("stroke") !== "none",
      color: outlineRect?.getAttribute("stroke") || "#111827",
      opacity: outlineRect?.getAttribute("stroke-opacity") || 1,
      width: outlineRect?.getAttribute("stroke-width") || 1,
      dasharray: outlineRect?.getAttribute("stroke-dasharray") || "",
      linecap: outlineRect?.getAttribute("stroke-linecap") || "butt",
      linejoin: outlineRect?.getAttribute("stroke-linejoin") || "miter",
      miterlimit: outlineRect?.getAttribute("stroke-miterlimit") || 4,
    },
  });
}

export function syncSvgDocumentBackgroundGeometry(svgRoot) {
  const group = findBackgroundGroup(svgRoot);
  if (!group) return false;
  const fillRect = group.querySelector(`:scope > rect[${FILL_RECT_ATTR}]`);
  const outlineRect = group.querySelector(`:scope > rect[${OUTLINE_RECT_ATTR}]`);
  const vb = getSvgViewBox(svgRoot);
  if (fillRect) {
    fillRect.setAttribute("x", String(vb.x));
    fillRect.setAttribute("y", String(vb.y));
    fillRect.setAttribute("width", String(vb.width));
    fillRect.setAttribute("height", String(vb.height));
  }
  if (outlineRect) {
    const strokeWidth = Math.max(0, numeric(outlineRect.getAttribute("stroke-width"), 1));
    const inset = strokeWidth / 2;
    outlineRect.setAttribute("x", String(vb.x + inset));
    outlineRect.setAttribute("y", String(vb.y + inset));
    outlineRect.setAttribute("width", String(Math.max(0, vb.width - strokeWidth)));
    outlineRect.setAttribute("height", String(Math.max(0, vb.height - strokeWidth)));
  }
  return true;
}

export function applySvgDocumentBackgroundAppearance(svgRoot, value) {
  const appearance = normalizeAppearance(value);
  if (removeBackgroundGroupIfTransparent(svgRoot, appearance)) return true;
  const { group, fillRect, outlineRect } = ensureBackgroundGroup(svgRoot);
  svgRoot.insertBefore(group, insertionReference(svgRoot));
  removeOwnedPaintServers(svgRoot);
  fillRect.setAttribute("fill", paintForFill(svgRoot, appearance));
  fillRect.setAttribute("fill-opacity", String(appearance.fill.type === "none" ? 0 : appearance.fill.opacity));
  fillRect.setAttribute("stroke", "none");
  outlineRect.setAttribute("fill", "none");
  if (appearance.outline.enabled && appearance.outline.width > 0) {
    outlineRect.setAttribute("stroke", appearance.outline.color);
    outlineRect.setAttribute("stroke-opacity", String(appearance.outline.opacity));
    outlineRect.setAttribute("stroke-width", String(appearance.outline.width));
    outlineRect.setAttribute("stroke-linecap", appearance.outline.linecap);
    outlineRect.setAttribute("stroke-linejoin", appearance.outline.linejoin);
    outlineRect.setAttribute("stroke-miterlimit", String(appearance.outline.miterlimit));
    if (appearance.outline.dasharray) outlineRect.setAttribute("stroke-dasharray", appearance.outline.dasharray);
    else outlineRect.removeAttribute("stroke-dasharray");
  } else {
    outlineRect.setAttribute("stroke", "none");
    outlineRect.removeAttribute("stroke-dasharray");
  }
  syncSvgDocumentBackgroundGeometry(svgRoot);
  return true;
}

export function svgBackgroundCapabilities() {
  return {
    fill: { none: true, solid: true, gradient: true, pattern: true, opacity: true, eyedropper: true, swatches: false },
    outline: { enabled: true, solid: true, opacity: true, width: true, dasharray: true, linecap: true, linejoin: true, miterlimit: true },
    patterns: DEFAULT_PATTERNS,
  };
}
