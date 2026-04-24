// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditor.mjs
// This file defines browser-side Graphical Editor logic for the Nodevision UI. It renders interface components and handles user interactions.
// using ModuleMap.csv as the single source of truth.
import { updateToolbarState } from "/panels/createToolbar.mjs";
import { setWordCountVisibility } from "/StatusBar.mjs";

let lastEditedPath = null;
let moduleMapCache = null;
const FALLBACK_EDITOR_BY_EXT = {
  png: "PNGeditor.mjs",
  ico: "PNGeditor.mjs",
};

/* ---------------------------------------------------------
 * ModuleMap loader (mirrors FileView.mjs behavior)
 * --------------------------------------------------------- */
async function loadModuleMap() {
  // Only use cache if it has actual entries (avoid caching failed/empty loads).
  if (moduleMapCache && Object.keys(moduleMapCache).length > 0) return moduleMapCache;

  try {
    const csvUrl = "/PanelInstances/ModuleMap.csv";
    const res = await fetch(csvUrl, { cache: "no-store" });
    if (!res.ok) {
      console.error("❌ Failed to load ModuleMap.csv, status:", res.status);
      return {};
    }

    const text = await res.text();
    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    const header = lines.shift()?.split(",").map((h) => h.trim()) || [];
    const idx = {
      ext: header.indexOf("Extension"),
      editor: header.indexOf("GraphicalEditorModule"),
      family: header.indexOf("Family"),
    };

    if (idx.ext < 0 || idx.editor < 0) {
      console.error("❌ ModuleMap.csv header missing required columns:", header);
      return {};
    }

    const map = {};
    for (const line of lines) {
      const cols = line.split(",").map((c) => c.trim());
      const ext = (cols[idx.ext] || "").toLowerCase();
      map[ext] = {
        editor: cols[idx.editor] || null,
        family: idx.family >= 0 ? cols[idx.family] || null : null,
      };
    }

    moduleMapCache = map;
    return map;
  } catch (err) {
    console.error("❌ Error loading ModuleMap.csv:", err);
    return {};
  }
}

/* ---------------------------------------------------------
 * Editor resolution
 * --------------------------------------------------------- */
function resolveExtension(filePath) {
  const raw = String(filePath || "").trim();
  if (!raw) return "";

  const readExtensionFromPathLike = (pathLike = "") => {
    const clean = String(pathLike || "")
      .trim()
      .replace(/\\/g, "/")
      .replace(/[?#].*$/, "");
    if (!clean) return "";

    const lower = clean.toLowerCase().replace(/%2e/gi, ".");
    if (lower.endsWith(".alto.xml")) return "alto";
    if (lower.endsWith(".musicxml.xml")) return "musicxml";
    if (lower.endsWith(".tar.gz")) return "tar.gz";
    if (lower.endsWith(".nvcircuit.json")) return "nvcircuit.json";

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
  const pushCandidate = (value) => {
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
    ["path", "file", "filename", "filepath", "selectedFilePath"].forEach((key) =>
      pushCandidate(parsed.searchParams.get(key) || "")
    );
    for (const value of parsed.searchParams.values()) {
      pushCandidate(value);
    }
  } catch {
    const [withoutHash] = raw.split("#");
    const [pathPart, queryPart = ""] = withoutHash.split("?");
    pushCandidate(pathPart);
    if (queryPart) {
      const params = new URLSearchParams(queryPart);
      ["path", "file", "filename", "filepath", "selectedFilePath"].forEach((key) =>
        pushCandidate(params.get(key) || "")
      );
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

async function resolveEditorModule(filePath) {
  const basePath = "/PanelInstances/EditorPanels/GraphicalEditors";
  const ext = resolveExtension(filePath);
  const rawLower = String(filePath || "").toLowerCase().replace(/%2e/gi, ".");
  const isIcoPath =
    ext === "ico" ||
    /\.ico(?=$|[^a-z0-9_+-])/i.test(rawLower);
  const normalizedExt = isIcoPath ? "ico" : ext;
  const moduleMap = await loadModuleMap();

  const moduleMapEmpty = !moduleMap || Object.keys(moduleMap).length === 0;
  const entry = moduleMap[normalizedExt] || moduleMap[""] || {};
  const forcedEditorFile = isIcoPath ? "PNGeditor.mjs" : null;
  const editorFile =
    forcedEditorFile ||
    entry?.editor ||
    (moduleMapEmpty ? FALLBACK_EDITOR_BY_EXT[normalizedExt] : null) ||
    "EditorFallback.mjs";

  // Safety check
  if (!/^[\w.-]+\.mjs$/.test(editorFile)) {
    console.warn("⚠️ Invalid editor module name:", editorFile);
    return { modulePath: `${basePath}/EditorFallback.mjs`, family: entry?.family || null, ext: normalizedExt };
  }

  return { modulePath: `${basePath}/${editorFile}`, family: entry?.family || null, ext: normalizedExt };
}

function shouldShowWordCount({ family = null, ext = "" } = {}) {
  const lowerExt = String(ext || "").toLowerCase();
  if (family === "Publication") return true;
  // Equation family includes LaTeX-style files where word count is helpful.
  if (family === "Equation") return true;
  return new Set(["html", "htm", "md", "markdown", "tex", "latex"]).has(lowerExt);
}

function cleanupEditorHost(editorDiv) {
  if (!editorDiv) return;
  const cleanup = editorDiv.__nvActiveEditorCleanup;
  if (typeof cleanup !== "function") return;
  try {
    cleanup();
  } catch (err) {
    console.warn("Graphical editor cleanup hook failed:", err);
  }
  editorDiv.__nvActiveEditorCleanup = null;
}

/* ---------------------------------------------------------
 * Panel setup
 * --------------------------------------------------------- */
export async function setupPanel(cell, instanceVars = {}) {
  const container = document.createElement("div");
  container.id = "graphical-editor";
  container.style.width = "100%";
  container.style.height = "100%";
  container.style.display = "flex";
  container.style.alignItems = "center";
  container.style.justifyContent = "center";
  cell.appendChild(container);

  // Reactive watcher for selectedFilePath
  if (!window._graphicalEditorProxyInstalled) {
    let internalPath = window.selectedFilePath || null;

    Object.defineProperty(window, "selectedFilePath", {
      get() {
        return internalPath;
      },
      set(value) {
        if (value !== internalPath) {
          const applyChange = () => {
            internalPath = value;
            updateGraphicalEditor(value);
          };
          if (typeof window.__nvGuardFileSwitch === "function") {
            window.__nvGuardFileSwitch(value, applyChange);
          } else {
            applyChange();
          }
        }
      },
      configurable: true,
    });

    window._graphicalEditorProxyInstalled = true;
    console.log("✅ GraphicalEditor reactive watcher installed.");
  }

  // Initial render
  const initialPath = instanceVars.filePath || window.selectedFilePath;
  await updateGraphicalEditor(initialPath, { force: true });
}

/* ---------------------------------------------------------
 * Editor update
 * --------------------------------------------------------- */
export async function updateGraphicalEditor(
  filePath,
  { force = false } = {}
) {
  const editorDiv = document.getElementById("graphical-editor");
  if (!editorDiv) {
    console.error("Graphical editor element not found.");
    return;
  }

  if (!filePath) {
    setWordCountVisibility(false);
    window.NodevisionState = window.NodevisionState || {};
    window.NodevisionState.activePanelType = "GraphicalEditor";
    window.NodevisionState.currentMode = "GraphicalEditing";
    window.NodevisionState.activeActionHandler = null;
    window.NodevisionState.selectedFile = null;
    window.NodevisionState.activeEditorFilePath = null;
    updateToolbarState({
      currentMode: "GraphicalEditing",
      activeActionHandler: null,
    });
    window.currentActiveFilePath = null;
    window.filePath = null;

    const { renderEditor } = await import(
      "/PanelInstances/EditorPanels/GraphicalEditors/EditorFallback.mjs"
    );
    cleanupEditorHost(editorDiv);
    editorDiv.innerHTML = "";
    renderEditor("(no file selected)", editorDiv);
    return;
  }

  if (!force && filePath === lastEditedPath) {
    console.log("🔁 Editor already active for:", filePath);
    return;
  }

  lastEditedPath = filePath;
  cleanupEditorHost(editorDiv);
  editorDiv.innerHTML = "";

  // Keep global "active file" state aligned with the file shown in the graphical editor.
  window.currentActiveFilePath = filePath;
  window.filePath = filePath;
  window.selectedFilePath = filePath;
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.activePanelType = "GraphicalEditor";
  window.NodevisionState.currentMode = "GraphicalEditing";
  window.NodevisionState.activeActionHandler = null;
  window.NodevisionState.selectedFile = filePath;
  window.NodevisionState.activeEditorFilePath = filePath;
  updateToolbarState({
    currentMode: "GraphicalEditing",
    activeActionHandler: null,
  });

  console.log("🧭 Loading graphical editor for:", filePath);

  try {
    const resolution = await resolveEditorModule(filePath);
    const { modulePath, family, ext } = resolution;
    setWordCountVisibility(shouldShowWordCount({ family, ext }));
    const editorFile = modulePath.split("/").pop();
    window.__nodevisionGraphicalEditorLastError = null;
    window.__nodevisionGraphicalEditorLastAttempt = {
      filePath,
      extension: ext,
      editorFile,
      modulePath,
      timestamp: Date.now(),
    };

    if (!window.__nvModuleCacheBust) {
      window.__nvModuleCacheBust = Date.now();
    }
    const editorImportPath = `${modulePath}${modulePath.includes("?") ? "&" : "?"}v=${window.__nvModuleCacheBust}`;
    const editor = await import(editorImportPath);

    if (typeof editor.renderEditor === "function") {
      await editor.renderEditor(filePath, editorDiv);
      console.log("✅ Editor rendered:", modulePath);
    } else {
      throw new Error("renderEditor() not found");
    }
  } catch (err) {
    setWordCountVisibility(false);
    console.error("❌ Failed to load editor:", err);
    const attempt = window.__nodevisionGraphicalEditorLastAttempt || {};
    window.__nodevisionGraphicalEditorLastError = {
      ...attempt,
      message: err?.message || String(err),
      stack: err?.stack || null,
      timestamp: Date.now(),
    };

    const { renderEditor } = await import(
      "/PanelInstances/EditorPanels/GraphicalEditors/EditorFallback.mjs"
    );
    cleanupEditorHost(editorDiv);
    renderEditor(filePath, editorDiv, { error: window.__nodevisionGraphicalEditorLastError });
  }
}

// Expose globally
window.updateGraphicalEditor = updateGraphicalEditor;
