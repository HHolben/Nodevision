// Nodevision/ApplicationSystem/public/PanelInstances/Common/Appearance/AppearanceModel.mjs
// This module defines editor-neutral appearance values and capability helpers so fill and outline panels can be reused without depending on a particular graphical editor implementation.

export const DEFAULT_APPEARANCE = Object.freeze({
  fill: {
    type: "none",
    color: "#ffffff",
    opacity: 1,
    gradient: { kind: "linear", from: "#ffffff", to: "#d7e8ff", angle: 0 },
    pattern: { key: "diagonal-lines", foreground: "#4b5563", background: "#ffffff", opacity: 1 },
  },
  outline: {
    enabled: false,
    type: "solid",
    color: "#111827",
    opacity: 1,
    width: 1,
    dasharray: "",
    linecap: "butt",
    linejoin: "miter",
    miterlimit: 4,
  },
});

export const DEFAULT_APPEARANCE_CAPABILITIES = Object.freeze({
  fill: {
    none: true,
    solid: true,
    gradient: false,
    pattern: false,
    opacity: true,
    eyedropper: false,
    swatches: false,
  },
  outline: {
    enabled: true,
    solid: true,
    opacity: true,
    width: true,
    dasharray: true,
    linecap: true,
    linejoin: true,
    miterlimit: true,
  },
});

export const DEFAULT_PATTERNS = Object.freeze([
  { key: "diagonal-lines", label: "Diagonal" },
  { key: "grid", label: "Grid" },
  { key: "dots", label: "Dots" },
]);

function clamp01(value, fallback = 1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(1, numeric));
}

function positiveNumber(value, fallback = 1) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, numeric);
}

function cleanPaint(value, fallback) {
  const raw = String(value || "").trim();
  if (!raw) return fallback;
  if (raw === "none" || raw === "transparent") return raw;
  if (/^#[0-9a-fA-F]{3,8}$/.test(raw)) return raw;
  if (/^(rgb|rgba|hsl|hsla)\(/i.test(raw)) return raw;
  if (/^[a-zA-Z]+$/.test(raw)) return raw;
  return fallback;
}

export function normalizeAppearanceCapabilities(value = {}) {
  return {
    fill: { ...DEFAULT_APPEARANCE_CAPABILITIES.fill, ...(value.fill || {}) },
    outline: { ...DEFAULT_APPEARANCE_CAPABILITIES.outline, ...(value.outline || {}) },
    patterns: Array.isArray(value.patterns) ? value.patterns : DEFAULT_PATTERNS,
  };
}

export function normalizeAppearance(value = {}) {
  const fill = { ...DEFAULT_APPEARANCE.fill, ...(value.fill || {}) };
  const outline = { ...DEFAULT_APPEARANCE.outline, ...(value.outline || {}) };
  const gradient = { ...DEFAULT_APPEARANCE.fill.gradient, ...(fill.gradient || {}) };
  const pattern = { ...DEFAULT_APPEARANCE.fill.pattern, ...(fill.pattern || {}) };

  return {
    fill: {
      type: ["none", "solid", "gradient", "pattern"].includes(fill.type) ? fill.type : "none",
      color: cleanPaint(fill.color, DEFAULT_APPEARANCE.fill.color),
      opacity: clamp01(fill.opacity, 1),
      gradient: {
        kind: gradient.kind === "radial" ? "radial" : "linear",
        from: cleanPaint(gradient.from, DEFAULT_APPEARANCE.fill.gradient.from),
        to: cleanPaint(gradient.to, DEFAULT_APPEARANCE.fill.gradient.to),
        angle: Number.isFinite(Number(gradient.angle)) ? Number(gradient.angle) : 0,
      },
      pattern: {
        key: String(pattern.key || DEFAULT_APPEARANCE.fill.pattern.key),
        foreground: cleanPaint(pattern.foreground, DEFAULT_APPEARANCE.fill.pattern.foreground),
        background: cleanPaint(pattern.background, DEFAULT_APPEARANCE.fill.pattern.background),
        opacity: clamp01(pattern.opacity, 1),
      },
    },
    outline: {
      enabled: Boolean(outline.enabled),
      type: outline.type === "none" ? "none" : "solid",
      color: cleanPaint(outline.color, DEFAULT_APPEARANCE.outline.color),
      opacity: clamp01(outline.opacity, 1),
      width: positiveNumber(outline.width, 1),
      dasharray: String(outline.dasharray || "").trim(),
      linecap: ["butt", "round", "square"].includes(outline.linecap) ? outline.linecap : "butt",
      linejoin: ["miter", "round", "bevel"].includes(outline.linejoin) ? outline.linejoin : "miter",
      miterlimit: positiveNumber(outline.miterlimit, 4) || 4,
    },
  };
}

export function appearanceEquals(a, b) {
  return JSON.stringify(normalizeAppearance(a)) === JSON.stringify(normalizeAppearance(b));
}
