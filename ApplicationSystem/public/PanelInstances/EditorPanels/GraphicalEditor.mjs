// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditor.mjs
// This file defines browser-side Graphical Editor logic for the Nodevision UI. It renders interface components and handles user interactions.
// using ModuleMap.csv as the single source of truth.
import { updateToolbarState } from "/panels/createToolbar.mjs";

let lastEditedPath = null;
let moduleMapCache = null;
const FALLBACK_EDITOR_BY_EXT = {
  png: "PNGeditor.mjs",
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
    };

    if (idx.ext < 0 || idx.editor < 0) {
      console.error("❌ ModuleMap.csv header missing required columns:", header);
      return {};
    }

    const map = {};
    for (const line of lines) {
      const cols = line.split(",").map((c) => c.trim());
      const ext = (cols[idx.ext] || "").toLowerCase();
      map[ext] = { editor: cols[idx.editor] || null };
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

  const withoutHashQuery = raw.replace(/[?#].*$/, "");
  const pathname = withoutHashQuery.startsWith("http://") ||
      withoutHashQuery.startsWith("https://")
    ? (() => {
      try {
        return new URL(withoutHashQuery).pathname || "";
      } catch {
        return withoutHashQuery;
      }
    })()
    : withoutHashQuery;

  const lower = pathname.toLowerCase();
  if (lower.endsWith(".alto.xml")) return "alto";
  if (lower.endsWith(".musicxml.xml")) return "musicxml";
  if (lower.endsWith(".tar.gz")) return "tar.gz";
  if (lower.endsWith(".nvcircuit.json")) return "nvcircuit.json";

  const lastSegment = lower.split("/").pop() || lower;
  if (!lastSegment.includes(".")) return "";
  return lastSegment.split(".").pop();
}

async function resolveEditorModule(filePath) {
  const basePath = "/PanelInstances/EditorPanels/GraphicalEditors";
  const ext = resolveExtension(filePath);
  const moduleMap = await loadModuleMap();

  const moduleMapEmpty = !moduleMap || Object.keys(moduleMap).length === 0;
  const editorFile =
    moduleMap[ext]?.editor ||
    moduleMap[""]?.editor ||
    (moduleMapEmpty ? FALLBACK_EDITOR_BY_EXT[ext] : null) ||
    "EditorFallback.mjs";

  // Safety check
  if (!/^[\w.-]+\.mjs$/.test(editorFile)) {
    console.warn("⚠️ Invalid editor module name:", editorFile);
    return `${basePath}/EditorFallback.mjs`;
  }

  return `${basePath}/${editorFile}`;
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
          internalPath = value;
          updateGraphicalEditor(value);
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
    window.NodevisionState = window.NodevisionState || {};
    window.NodevisionState.activePanelType = "GraphicalEditor";
    window.NodevisionState.currentMode = "GraphicalEditing";
    window.NodevisionState.selectedFile = null;
    window.NodevisionState.activeEditorFilePath = null;
    updateToolbarState({ currentMode: "GraphicalEditing" });
    window.currentActiveFilePath = null;
    window.filePath = null;

    const { renderEditor } = await import(
      "/PanelInstances/EditorPanels/GraphicalEditors/EditorFallback.mjs"
    );
    editorDiv.innerHTML = "";
    renderEditor("(no file selected)", editorDiv);
    return;
  }

  if (!force && filePath === lastEditedPath) {
    console.log("🔁 Editor already active for:", filePath);
    return;
  }

  lastEditedPath = filePath;
  editorDiv.innerHTML = "";

  // Keep global "active file" state aligned with the file shown in the graphical editor.
  window.currentActiveFilePath = filePath;
  window.filePath = filePath;
  window.selectedFilePath = filePath;
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.activePanelType = "GraphicalEditor";
  window.NodevisionState.currentMode = "GraphicalEditing";
  window.NodevisionState.selectedFile = filePath;
  window.NodevisionState.activeEditorFilePath = filePath;
  updateToolbarState({ currentMode: "GraphicalEditing" });

  console.log("🧭 Loading graphical editor for:", filePath);

  try {
    const ext = resolveExtension(filePath);
    const modulePath = await resolveEditorModule(filePath);
    const editorFile = modulePath.split("/").pop();
    window.__nodevisionGraphicalEditorLastError = null;
    window.__nodevisionGraphicalEditorLastAttempt = {
      filePath,
      extension: ext,
      editorFile,
      modulePath,
      timestamp: Date.now(),
    };

    const editor = await import(modulePath);

    if (typeof editor.renderEditor === "function") {
      await editor.renderEditor(filePath, editorDiv);
      console.log("✅ Editor rendered:", modulePath);
    } else {
      throw new Error("renderEditor() not found");
    }
  } catch (err) {
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
    renderEditor(filePath, editorDiv, { error: window.__nodevisionGraphicalEditorLastError });
  }
}

// Expose globally
window.updateGraphicalEditor = updateGraphicalEditor;
