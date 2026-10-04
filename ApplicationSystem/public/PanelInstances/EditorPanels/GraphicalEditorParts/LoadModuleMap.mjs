// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditorParts/LoadModuleMap.mjs
// This module implements load Module Map behavior for the GraphicalEditor feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { loadModuleMap as loadSharedModuleMap } from "/PanelInstances/ModuleMapLoader.mjs";

// Load Module Map operations.
export const GraphicalEditorModuleState = {};

export const FALLBACK_EDITOR_BY_EXT = {
  png: "PNGeditor.mjs",
  ico: "PNGeditor.mjs"
};

/* ---------------------------------------------------------
 * ModuleMap loader (mirrors FileView.mjs behavior)
 * --------------------------------------------------------- */

export
/* ---------------------------------------------------------
 * ModuleMap loader (mirrors FileView.mjs behavior)
 * --------------------------------------------------------- */
async function loadModuleMap() {
  try {
    return await loadSharedModuleMap();
  } catch (err) {
    console.error("❌ Error loading ModuleMap.csv:", err);
    return {};
  }
}

/* ---------------------------------------------------------
 * Editor resolution
 * --------------------------------------------------------- */

export
/* ---------------------------------------------------------
 * Editor resolution
 * --------------------------------------------------------- */
function resolveExtension(filePath) {
  const raw = String(filePath || "").trim();
  if (!raw) return "";
  const readExtensionFromPathLike = (pathLike = "") => {
    const clean = String(pathLike || "").trim().replace(/\\/g, "/").replace(/[?#].*$/, "");
    if (!clean) return "";
    const lower = clean.toLowerCase().replace(/%2e/gi, ".");
    if (lower.endsWith(".alto.xml")) return "alto";
    if (lower.endsWith(".musicxml.xml")) return "musicxml";
    if (lower.endsWith(".tar.gz")) return "tar.gz";
    if (lower.endsWith(".nvcircuit.json")) return "nvcircuit.json";
    if (lower.endsWith(".td.json")) return "td.json";
    if (lower.endsWith(".terrain.json")) return "terrain.json";
    const lastSegment = lower.split("/").pop() || lower;
    if (lastSegment.includes(".")) {
      const token = (lastSegment.split(".").pop() || "").trim().toLowerCase();
      const sanitized = token.replace(/[^a-z0-9_+-]/g, "");
      if (sanitized) return sanitized;
    }

    // Last-resort compatibility path: if path wrappers obscure the final segment,
    // still honor explicit ".ico" occurrences so icon files mount the raster editor.
    if (/\.ico(?=$|[^a-z0-9_+-])/i.test(lower)) return "ico";
    return "";
  };
  const candidates = [];
  const pushCandidate = value => {
    if (!value) return;
    const text = String(value).trim();
    if (!text) return;
    candidates.push(text);
    try {
      const decoded = decodeURIComponent(text);
      if (decoded && decoded !== text) candidates.push(decoded);
    } catch {
      // Keep undecoded candidate only.
    }
  };
  pushCandidate(raw);
  try {
    const parsed = new URL(raw, window.location.origin);
    pushCandidate(parsed.pathname || "");
    ["path", "file", "filename", "filepath", "selectedFilePath"].forEach(key => pushCandidate(parsed.searchParams.get(key) || ""));
    for (const value of parsed.searchParams.values()) {
      pushCandidate(value);
    }
  } catch {
    const [withoutHash] = raw.split("#");
    const [pathPart, queryPart = ""] = withoutHash.split("?");
    pushCandidate(pathPart);
    if (queryPart) {
      const params = new URLSearchParams(queryPart);
      ["path", "file", "filename", "filepath", "selectedFilePath"].forEach(key => pushCandidate(params.get(key) || ""));
      for (const value of params.values()) {
        pushCandidate(value);
      }
    }
  }
  for (const candidate of [...new Set(candidates)]) {
    const ext = readExtensionFromPathLike(candidate);
    if (ext) return ext;
  }
  return "";
}

export async function resolveEditorModule(filePath) {
  const basePath = "/PanelInstances/EditorPanels/GraphicalEditors";
  const ext = resolveExtension(filePath);
  const rawLower = String(filePath || "").toLowerCase().replace(/%2e/gi, ".");
  const isIcoPath = ext === "ico" || /\.ico(?=$|[^a-z0-9_+-])/i.test(rawLower);
  const normalizedExt = isIcoPath ? "ico" : ext;
  const moduleMap = await loadModuleMap();
  const moduleMapEmpty = !moduleMap || Object.keys(moduleMap).length === 0;
  const entry = moduleMap[normalizedExt] || moduleMap[""] || {};
  const forcedEditorFile = isIcoPath ? "PNGeditor.mjs" : null;
  const editorFile = forcedEditorFile || entry?.editor || (moduleMapEmpty ? FALLBACK_EDITOR_BY_EXT[normalizedExt] : null) || "EditorFallback.mjs";

  // Safety check
  if (!/^[\w.-]+\.mjs$/.test(editorFile)) {
    console.warn("⚠️ Invalid editor module name:", editorFile);
    return {
      modulePath: `${basePath}/EditorFallback.mjs`,
      family: entry?.family || null,
      ext: normalizedExt
    };
  }
  return {
    modulePath: `${basePath}/${editorFile}`,
    family: entry?.family || null,
    ext: normalizedExt
  };
}

export function shouldShowWordCount({
  family = null,
  ext = ""
} = {}) {
  const lowerExt = String(ext || "").toLowerCase();
  if (family === "Publication") return true;
  // Equation family includes LaTeX-style files where word count is helpful.
  if (family === "Equation") return true;
  return new Set(["html", "htm", "md", "markdown", "tex", "latex"]).has(lowerExt);
}

export function liveContentMimeTypeForPath(filePath = "") {
  const ext = resolveExtension(filePath);
  if (ext === "html" || ext === "htm") return "text/html";
  if (ext === "svg") return "image/svg+xml";
  if (ext === "md" || ext === "markdown") return "text/markdown";
  if (ext === "csv") return "text/csv";
  if (ext === "tsv") return "text/tab-separated-values";
  if (ext === "json" || ext.endsWith(".json")) return "application/json";
  return "text/plain";
}
