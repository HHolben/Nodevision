// Nodevision/ApplicationSystem/public/CursorFamilies/ContextualCursorFamilyRegistry.mjs
// Shared registry and resolver for contextual editor cursor families.

import { loadModuleMap } from "../PanelInstances/ModuleMapLoader.mjs";

export const SELECTION_CURSOR_FAMILY_ID = "selection";

export const CONTEXTUAL_TOOL_CATALOG = Object.freeze({
  "object-select": Object.freeze({ id: "object-select", label: "Object Select", glyph: "P", kind: "selection" }),
  "text-select": Object.freeze({ id: "text-select", label: "Text Select", glyph: "T", kind: "selection" }),
  "cell-select": Object.freeze({ id: "cell-select", label: "Cell Select", glyph: "CELL", kind: "selection" }),
  "rectangle-select": Object.freeze({ id: "rectangle-select", label: "Rectangle Select", glyph: "RECT", kind: "selection" }),
  "ellipse-select": Object.freeze({ id: "ellipse-select", label: "Circle/Ellipse Select", glyph: "CIRC", kind: "selection" }),
  "lasso-select": Object.freeze({ id: "lasso-select", label: "Lasso Select", glyph: "LASSO", kind: "selection" }),
  "freehand-draw": Object.freeze({ id: "freehand-draw", label: "Freehand Draw", glyph: "DRAW", kind: "drawing" }),
  "brush-draw": Object.freeze({ id: "brush-draw", label: "Brush", glyph: "DRAW", kind: "drawing" }),
  "eraser": Object.freeze({ id: "eraser", label: "Eraser", glyph: "ERASE", kind: "drawing" }),
  "fill": Object.freeze({ id: "fill", label: "Fill", glyph: "FILL", kind: "drawing" }),
  "eyedropper": Object.freeze({ id: "eyedropper", label: "Eyedropper", glyph: "PICK", kind: "drawing" }),
  "line-draw": Object.freeze({ id: "line-draw", label: "Line", glyph: "LINE", kind: "drawing" }),
  "rectangle-draw": Object.freeze({ id: "rectangle-draw", label: "Rectangle", glyph: "RECT", kind: "drawing" }),
  "circle-draw": Object.freeze({ id: "circle-draw", label: "Circle", glyph: "CIRC", kind: "drawing" }),
  "arc-draw": Object.freeze({ id: "arc-draw", label: "Arc", glyph: "ARC", kind: "drawing" }),
  "ellipse-draw": Object.freeze({ id: "ellipse-draw", label: "Circle/Ellipse", glyph: "CIRC", kind: "drawing" }),
  "bezier-draw": Object.freeze({ id: "bezier-draw", label: "Bezier Path", glyph: "PATH", kind: "drawing" }),
  "sketch-draw": Object.freeze({ id: "sketch-draw", label: "Pencil Sketch", glyph: "PEN", kind: "drawing" }),
});

const providerModuleCache = new Map();
const providerInstanceCache = new Map();
let cursorProviderResolutionCount = 0;

function normalizePath(path = "") {
  return String(path || "").trim().replace(/\\/g, "/").replace(/[?#].*$/, "");
}

export function extensionFromPath(path = "") {
  const clean = normalizePath(path).toLowerCase();
  const last = clean.split("/").pop() || clean;
  if (!last.includes(".")) return "";
  return (last.split(".").pop() || "").replace(/[^a-z0-9_+-]/g, "");
}

function currentContext(overrides = {}) {
  const state = globalThis.window?.NodevisionState || {};
  const filePath = overrides.filePath || state.activeEditorFilePath || state.selectedFile || globalThis.window?.currentActiveFilePath || "";
  return {
    familyId: overrides.familyId || SELECTION_CURSOR_FAMILY_ID,
    currentMode: overrides.currentMode || state.currentMode || "",
    filePath,
    extension: overrides.extension || extensionFromPath(filePath),
    state,
    window: globalThis.window || null,
  };
}

function providerUrl(providerFile) {
  return new URL(`./providers/${providerFile}`, import.meta.url).href;
}

function defaultProviderPathForContext(context) {
  const mode = String(context.currentMode || "");
  if (mode === "SVG Editing") return providerUrl("SVGCursorProvider.mjs");
  if (mode === "HTMLediting") return providerUrl("HTMLCursorProvider.mjs");
  if (mode === "CSVediting") return providerUrl("CSVCursorProvider.mjs");
  if (["PNGediting", "JPGediting", "JPEGediting"].includes(mode)) return providerUrl("RasterCursorProvider.mjs");
  return null;
}

function providerPathFromModuleMapEntry(entry, context) {
  const raw = entry?.cursorProvider || entry?.cursorProviderModule || "";
  if (raw) {
    if (/^[a-z]+:/i.test(raw)) return raw;
    if (raw.startsWith("/")) {
      return globalThis.location?.origin ? new URL(raw, globalThis.location.origin).href : raw;
    }
    return providerUrl(raw);
  }
  return defaultProviderPathForContext(context);
}

export async function resolveCursorProvider(options = {}) {
  cursorProviderResolutionCount += 1;
  const context = currentContext(options);
  let entry = null;
  try {
    const map = await loadModuleMap();
    entry = map?.[context.extension] || null;
  } catch {
    entry = null;
  }
  const modulePath = options.providerPath || providerPathFromModuleMapEntry(entry, context);
  if (!modulePath) return null;

  const cacheKey = `${context.familyId}:${modulePath}`;
  let provider = providerInstanceCache.get(cacheKey) || null;
  if (!provider) {
    let mod = providerModuleCache.get(modulePath);
    if (!mod) {
      mod = await import(modulePath);
      providerModuleCache.set(modulePath, mod);
    }
    const factory = mod.createCursorFamilyProvider || mod.createCursorProvider || mod.default;
    if (typeof factory !== "function") return null;
    provider = factory({ familyId: context.familyId, moduleMapEntry: entry, modulePath });
    providerInstanceCache.set(cacheKey, provider);
  }
  return typeof provider?.withContext === "function" ? provider.withContext(context) : provider;
}

export function normalizeToolList(tools = []) {
  return Array.from(tools || [])
    .map((tool) => {
      const id = String(tool?.id || "").trim();
      if (!id) return null;
      return { ...(CONTEXTUAL_TOOL_CATALOG[id] || {}), ...tool, id };
    })
    .filter(Boolean);
}

export function chooseFallbackTool(provider, tools = []) {
  const validTools = normalizeToolList(tools.length ? tools : provider?.getTools?.() || []);
  if (!validTools.length) return null;
  const activeId = provider?.getActiveToolId?.();
  if (validTools.some((tool) => tool.id === activeId)) return activeId;
  const fallback = provider?.getFallbackToolId?.();
  if (validTools.some((tool) => tool.id === fallback)) return fallback;
  return validTools[0].id;
}

export async function snapshotCursorFamily(options = {}) {
  const provider = await resolveCursorProvider(options);
  if (!provider) return { provider: null, tools: [], activeToolId: null };
  const tools = normalizeToolList(provider.getTools?.() || []);
  const activeToolId = chooseFallbackTool(provider, tools);
  return { provider, tools, activeToolId };
}

export function notifyContextualCursorFamilyChanged(detail = {}) {
  const target = globalThis.window;
  if (!target?.dispatchEvent || typeof CustomEvent !== "function") return;
  target.dispatchEvent(new CustomEvent("nv-contextual-cursor-family-changed", { detail }));
}

export function getCursorProviderResolverStats() {
  return {
    cursorProviderResolutionCount,
    moduleCacheSize: providerModuleCache.size,
    providerCacheSize: providerInstanceCache.size,
  };
}

export function resetCursorProviderResolverForTests() {
  providerModuleCache.clear();
  providerInstanceCache.clear();
  cursorProviderResolutionCount = 0;
}

if (typeof window !== "undefined") {
  window.NodevisionContextualCursorFamilies = {
    resolveCursorProvider,
    snapshotCursorFamily,
    stats: getCursorProviderResolverStats,
  };
}
