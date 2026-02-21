// Nodevision/public/PanelInstances/EditorPanels/GraphicalEditor.mjs
// Displays the appropriate Nodevision graphical editor for the selected file,
// using ModuleMap.csv as the single source of truth.
import { updateToolbarState } from "/panels/createToolbar.mjs";

let lastEditedPath = null;
let moduleMapCache = null;

/* ---------------------------------------------------------
 * ModuleMap loader (mirrors FileView.mjs behavior)
 * --------------------------------------------------------- */
async function loadModuleMap() {
  if (moduleMapCache) return moduleMapCache;

  const res = await fetch("/PanelInstances/ModuleMap.csv");
  if (!res.ok) {
    console.error("❌ Failed to load ModuleMap.csv");
    moduleMapCache = {};
    return moduleMapCache;
  }

  const text = await res.text();
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean);

  const header = lines.shift().split(",").map(h => h.trim());
  const idx = {
    ext: header.indexOf("Extension"),
    editor: header.indexOf("GraphicalEditorModule"),
  };

  const map = {};

  for (const line of lines) {
    const cols = line.split(",").map(c => c.trim());
    const ext = (cols[idx.ext] || "").toLowerCase();

    map[ext] = {
      editor: cols[idx.editor] || null,
    };
  }

  moduleMapCache = map;
  console.log("📦 ModuleMap loaded for editors:", map);
  return map;
}

/* ---------------------------------------------------------
 * Editor resolution
 * --------------------------------------------------------- */
async function resolveEditorModule(filePath) {
  const basePath = "/PanelInstances/EditorPanels/GraphicalEditors";
  const ext = filePath.split(".").pop().toLowerCase();
  const moduleMap = await loadModuleMap();

  const editorFile =
    moduleMap[ext]?.editor ||
    moduleMap[""]?.editor ||
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
    const modulePath = await resolveEditorModule(filePath);
    console.log("🔍 Editor module:", modulePath);

    const editor = await import(modulePath);

    if (typeof editor.renderEditor === "function") {
      await editor.renderEditor(filePath, editorDiv);
      console.log("✅ Editor rendered:", modulePath);
    } else {
      throw new Error("renderEditor() not found");
    }
  } catch (err) {
    console.error("❌ Failed to load editor:", err);

    const { renderEditor } = await import(
      "/PanelInstances/EditorPanels/GraphicalEditors/EditorFallback.mjs"
    );
    renderEditor(filePath, editorDiv);
  }
}

// Expose globally
window.updateGraphicalEditor = updateGraphicalEditor;
