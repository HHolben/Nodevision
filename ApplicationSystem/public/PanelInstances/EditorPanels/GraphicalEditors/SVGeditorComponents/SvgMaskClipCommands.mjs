// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SvgMaskClipCommands.mjs
// Native SVG mask and clipping-path commands for the graphical SVG editor.

const SVG_NS = "http://www.w3.org/2000/svg";

function cssId(id) {
  const raw = String(id || "");
  if (globalThis.CSS && typeof globalThis.CSS.escape === "function") return globalThis.CSS.escape(raw);
  return raw.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}

function createSvgEl(tag, attrs = {}) {
  const el = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs || {}).forEach(([key, value]) => {
    if (value === null || value === undefined) return;
    el.setAttribute(key, String(value));
  });
  return el;
}

function safeIdPart(value) {
  return String(value || "").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48);
}

export function ensureSvgDefs(svgRoot) {
  if (!svgRoot) return null;
  let defs = svgRoot.querySelector(":scope > defs");
  if (!defs) {
    defs = createSvgEl("defs");
    svgRoot.insertBefore(defs, svgRoot.firstChild || null);
  }
  return defs;
}

export function makeUniqueSvgId(svgRoot, prefix = "nv-def") {
  const existing = new Set(Array.from(svgRoot?.querySelectorAll?.("[id]") || []).map((node) => node.id));
  const clean = safeIdPart(prefix) || "nv-def";
  let id = "";
  do {
    id = `${clean}-${Math.random().toString(36).slice(2, 10)}`;
  } while (existing.has(id));
  return id;
}

function bboxOrViewBox(svgRoot, elements = []) {
  for (const el of elements) {
    try {
      const b = el.getBBox?.();
      if (b && b.width > 0 && b.height > 0) return b;
    } catch {
      // Try next.
    }
  }
  const vb = svgRoot?.viewBox?.baseVal;
  if (vb && vb.width > 0 && vb.height > 0) return vb;
  return { x: 0, y: 0, width: Number(svgRoot?.getAttribute?.("width")) || 800, height: Number(svgRoot?.getAttribute?.("height")) || 600 };
}

function applyReference(elements = [], attr, id) {
  elements.forEach((el) => {
    el.setAttribute(attr, `url(#${id})`);
    el.setAttribute(`data-nv-${attr}-id`, id);
  });
}

export function addMask(svgRoot, artworkElements = [], options = {}) {
  if (!svgRoot || !artworkElements.length) return null;
  const defs = ensureSvgDefs(svgRoot);
  const id = makeUniqueSvgId(svgRoot, "nv-mask");
  const b = bboxOrViewBox(svgRoot, artworkElements);
  const mask = createSvgEl("mask", {
    id,
    maskUnits: "userSpaceOnUse",
    x: b.x,
    y: b.y,
    width: Math.max(1, b.width),
    height: Math.max(1, b.height),
    "data-nv-mask": "true",
  });
  const rect = createSvgEl("rect", {
    x: b.x,
    y: b.y,
    width: Math.max(1, b.width),
    height: Math.max(1, b.height),
    fill: options.invert ? "black" : "white",
  });
  mask.appendChild(rect);
  defs.appendChild(mask);
  applyReference(artworkElements, "mask", id);
  return { id, element: mask, appliedTo: artworkElements };
}

export function addClipPath(svgRoot, artworkElements = []) {
  if (!svgRoot || !artworkElements.length) return null;
  const defs = ensureSvgDefs(svgRoot);
  const id = makeUniqueSvgId(svgRoot, "nv-clip");
  const b = bboxOrViewBox(svgRoot, artworkElements);
  const clip = createSvgEl("clipPath", { id, clipPathUnits: "userSpaceOnUse", "data-nv-clip-path": "true" });
  clip.appendChild(createSvgEl("rect", {
    x: b.x,
    y: b.y,
    width: Math.max(1, b.width),
    height: Math.max(1, b.height),
  }));
  defs.appendChild(clip);
  applyReference(artworkElements, "clip-path", id);
  return { id, element: clip, appliedTo: artworkElements };
}

export function useSelectedObjectAsMask(svgRoot, selected = [], options = {}) {
  if (!svgRoot || selected.length < 2) return null;
  const [maskSource, ...artwork] = selected;
  const defs = ensureSvgDefs(svgRoot);
  const id = makeUniqueSvgId(svgRoot, "nv-mask");
  const mask = createSvgEl("mask", { id, maskUnits: "userSpaceOnUse", "data-nv-mask": "true" });
  const source = options.cloneSource === false ? maskSource : maskSource.cloneNode(true);
  source.removeAttribute("id");
  source.setAttribute("data-nv-mask-content", "true");
  if (options.invert) {
    source.setAttribute("fill", "black");
    source.setAttribute("stroke", "black");
  }
  mask.appendChild(source);
  defs.appendChild(mask);
  if (options.cloneSource === false) maskSource.remove();
  applyReference(artwork, "mask", id);
  return { id, element: mask, source, appliedTo: artwork };
}

export function useSelectedObjectAsClipPath(svgRoot, selected = [], options = {}) {
  if (!svgRoot || selected.length < 2) return null;
  const [clipSource, ...artwork] = selected;
  const defs = ensureSvgDefs(svgRoot);
  const id = makeUniqueSvgId(svgRoot, "nv-clip");
  const clip = createSvgEl("clipPath", { id, clipPathUnits: "userSpaceOnUse", "data-nv-clip-path": "true" });
  const source = options.cloneSource === false ? clipSource : clipSource.cloneNode(true);
  source.removeAttribute("id");
  source.setAttribute("data-nv-clip-content", "true");
  clip.appendChild(source);
  defs.appendChild(clip);
  if (options.cloneSource === false) clipSource.remove();
  applyReference(artwork, "clip-path", id);
  return { id, element: clip, source, appliedTo: artwork };
}

function referencedId(el, attr) {
  const raw = String(el?.getAttribute?.(attr) || "");
  const match = raw.match(/^url\(#([^)]+)\)$/);
  return match ? match[1] : "";
}

export function setMaskOrClipEnabled(elements = [], attr = "mask", enabled = true) {
  elements.forEach((el) => {
    if (!el) return;
    const disabledAttr = `data-nv-disabled-${attr}`;
    if (enabled) {
      const stored = el.getAttribute(disabledAttr);
      if (stored) {
        el.setAttribute(attr, stored);
        el.removeAttribute(disabledAttr);
      }
    } else {
      const current = el.getAttribute(attr);
      if (current) {
        el.setAttribute(disabledAttr, current);
        el.removeAttribute(attr);
      }
    }
  });
  return true;
}

export function detachMaskOrClip(svgRoot, elements = [], attr = "mask") {
  const detached = [];
  elements.forEach((el) => {
    const id = referencedId(el, attr);
    if (!id) return;
    el.removeAttribute(attr);
    el.removeAttribute(`data-nv-${attr}-id`);
    detached.push(id);
  });
  return detached.map((id) => svgRoot?.querySelector?.(`#${cssId(id)}`)).filter(Boolean);
}

export function releaseClipPath(svgRoot, elements = []) {
  const released = [];
  elements.forEach((el) => {
    const id = referencedId(el, "clip-path");
    if (!id) return;
    const clip = svgRoot?.querySelector?.(`#${cssId(id)}`);
    if (clip) {
      Array.from(clip.children || []).forEach((child) => {
        const clone = child.cloneNode(true);
        clone.removeAttribute("data-nv-clip-content");
        el.parentNode?.insertBefore(clone, el);
        released.push(clone);
      });
    }
    el.removeAttribute("clip-path");
  });
  return released;
}

