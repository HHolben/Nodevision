// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SymmetryGenerator.mjs
// SVG-native symmetry output generation.

const XLINK_NS = "http://www.w3.org/1999/xlink";

function cssId(id) {
  const raw = String(id || "");
  if (globalThis.CSS && typeof globalThis.CSS.escape === "function") return globalThis.CSS.escape(raw);
  return raw.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}

function makeId(prefix = "nv-symmetry-source") {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function ensureElementId(svgRoot, el, prefix = "nv-symmetry-source") {
  if (!el) return "";
  let id = String(el.getAttribute("id") || "").trim();
  if (id && !svgRoot?.querySelector?.(`#${cssId(id)}`)) return id;
  if (id) return id;
  const existing = new Set(Array.from(svgRoot?.querySelectorAll?.("[id]") || []).map((node) => node.id));
  do {
    id = makeId(prefix);
  } while (existing.has(id));
  el.setAttribute("id", id);
  return id;
}

function centerFromSettings(settings = {}, getViewBox) {
  const vb = typeof getViewBox === "function" ? getViewBox() : { x: 0, y: 0, width: 800, height: 600 };
  const axis = settings.symmetryAxis || settings.guideOrigin || {};
  return {
    x: Number.isFinite(Number(axis.x)) ? Number(axis.x) : vb.x + vb.width / 2,
    y: Number.isFinite(Number(axis.y)) ? Number(axis.y) : vb.y + vb.height / 2,
  };
}

function transformsFor(settings = {}, getViewBox) {
  const mode = String(settings.symmetryMode || "none");
  if (mode === "none") return [];
  const c = centerFromSettings(settings, getViewBox);
  if (mode === "horizontal") return [`translate(0 ${2 * c.y}) scale(1 -1)`];
  if (mode === "vertical") return [`translate(${2 * c.x} 0) scale(-1 1)`];
  if (mode === "quadrant") {
    return [
      `translate(0 ${2 * c.y}) scale(1 -1)`,
      `translate(${2 * c.x} 0) scale(-1 1)`,
      `translate(${2 * c.x} ${2 * c.y}) scale(-1 -1)`,
    ];
  }
  if (mode === "radial") {
    const count = Math.max(2, Math.min(64, Math.round(Number(settings.radialSegmentCount) || 8)));
    const out = [];
    for (let i = 1; i < count; i += 1) {
      out.push(`rotate(${(360 * i) / count} ${c.x} ${c.y})`);
      if (settings.radialMirrored) {
        out.push(`rotate(${(360 * i) / count} ${c.x} ${c.y}) translate(${2 * c.x} 0) scale(-1 1)`);
      }
    }
    return out;
  }
  return [];
}

export function createSymmetryOutputs(sourceElement, deps = {}) {
  const { svgRoot, createSvgEl, settings = {}, getViewBox } = deps;
  if (!sourceElement?.parentNode || !createSvgEl || !svgRoot) return [];
  const transforms = transformsFor(settings, getViewBox);
  if (!transforms.length) return [];
  const strategy = String(settings.symmetryOutputStrategy || "linked-use");
  const parent = sourceElement.parentNode;
  const created = [];
  if (strategy === "linked-use") {
    const id = ensureElementId(svgRoot, sourceElement);
    transforms.forEach((transform) => {
      const use = createSvgEl("use", {
        href: `#${id}`,
        transform,
        "data-nv-symmetry-clone": "true",
        "data-nv-symmetry-source": id,
      });
      try {
        use.setAttributeNS(XLINK_NS, "xlink:href", `#${id}`);
      } catch {
        // href is enough in modern SVG.
      }
      parent.appendChild(use);
      created.push(use);
    });
    return created;
  }
  transforms.forEach((transform) => {
    const clone = sourceElement.cloneNode(true);
    clone.removeAttribute("id");
    const existing = String(clone.getAttribute("transform") || "").trim();
    clone.setAttribute("transform", existing ? `${transform} ${existing}` : transform);
    clone.setAttribute("data-nv-symmetry-clone", "true");
    parent.appendChild(clone);
    created.push(clone);
  });
  return created;
}

export function expandSymmetryClones(selection = []) {
  const expanded = [];
  selection.forEach((el) => {
    if (String(el?.tagName || "").toLowerCase() !== "use") return;
    const href = el.getAttribute("href") || el.getAttributeNS?.(XLINK_NS, "href") || "";
    const id = href.startsWith("#") ? href.slice(1) : "";
    const source = id ? el.ownerSVGElement?.querySelector?.(`#${cssId(id)}`) : null;
    if (!source) return;
    const clone = source.cloneNode(true);
    clone.removeAttribute("id");
    const sourceTransform = String(source.getAttribute("transform") || "").trim();
    const useTransform = String(el.getAttribute("transform") || "").trim();
    clone.setAttribute("transform", [useTransform, sourceTransform].filter(Boolean).join(" "));
    clone.removeAttribute("data-nv-symmetry-source");
    el.parentNode?.insertBefore(clone, el);
    el.remove();
    expanded.push(clone);
  });
  return expanded;
}

