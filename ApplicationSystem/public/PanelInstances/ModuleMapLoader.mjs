// Nodevision/ApplicationSystem/public/PanelInstances/ModuleMapLoader.mjs
// Shared browser-side loader for the application ModuleMap.csv.

import { createPerformanceOperation } from "../PerformanceDiagnostics.mjs";

const MODULE_MAP_URL = "/PanelInstances/ModuleMap.csv";

let moduleMapCache = null;
let moduleMapPromise = null;
let moduleMapLoadCount = 0;
let moduleMapFetchCount = 0;

export function parseModuleMapCsv(text = "") {
  const lines = String(text || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const header = lines.shift()?.split(",").map((value) => value.trim()) || [];
  const indexes = {
    ext: header.indexOf("Extension"),
    viewer: header.indexOf("ViewerModule"),
    editor: header.indexOf("GraphicalEditorModule"),
    family: header.indexOf("Family"),
  };

  if (indexes.ext < 0) {
    throw new Error("ModuleMap.csv header missing Extension column.");
  }

  const map = {};
  for (const line of lines) {
    const cols = line.split(",").map((value) => value.trim());
    const ext = String(cols[indexes.ext] || "").toLowerCase();
    map[ext] = {
      viewer: indexes.viewer >= 0 ? cols[indexes.viewer] || null : null,
      editor: indexes.editor >= 0 ? cols[indexes.editor] || null : null,
      family: indexes.family >= 0 ? cols[indexes.family] || null : null,
    };
  }
  return map;
}

export function invalidateModuleMapCache() {
  moduleMapCache = null;
  moduleMapPromise = null;
}

export function getModuleMapLoaderStats() {
  return {
    loadCount: moduleMapLoadCount,
    fetchCount: moduleMapFetchCount,
    cached: Boolean(moduleMapCache && Object.keys(moduleMapCache).length > 0),
  };
}

export async function loadModuleMap(options = {}) {
  const force = options.force === true;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (!force && moduleMapCache && Object.keys(moduleMapCache).length > 0) return moduleMapCache;
  if (!force && moduleMapPromise) return moduleMapPromise;
  if (typeof fetchImpl !== "function") throw new Error("fetch is not available for ModuleMap loading.");

  const op = createPerformanceOperation("ModuleMap load", { force });
  moduleMapPromise = (async () => {
    moduleMapLoadCount += 1;
    moduleMapFetchCount += 1;
    const res = await fetchImpl(MODULE_MAP_URL, { cache: "no-store" });
    op.mark("fetch", { status: res.status });
    if (!res.ok) {
      throw new Error("Failed to load ModuleMap.csv, status: " + res.status);
    }
    const text = await res.text();
    const map = parseModuleMapCsv(text);
    moduleMapCache = map;
    op.end({ entries: Object.keys(map).length });
    return map;
  })();

  try {
    return await moduleMapPromise;
  } catch (err) {
    moduleMapPromise = null;
    op.end({ error: err?.message || String(err) });
    throw err;
  } finally {
    if (moduleMapCache) moduleMapPromise = null;
  }
}

if (typeof window !== "undefined") {
  window.__nvInvalidateModuleMapCache = invalidateModuleMapCache;
  window.__nvModuleMapLoaderStats = getModuleMapLoaderStats;
}
