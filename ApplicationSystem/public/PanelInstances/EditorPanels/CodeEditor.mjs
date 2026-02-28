// Nodevision/public/PanelInstances/EditorPanels/CodeEditor.mjs
// Replaces the active panel cell with a Monaco-based Code Editor for the selected file.
import saveCurrentFile from "/ToolbarCallbacks/file/saveFile.mjs";

let editorInstance = null;
let editorContainer = null;
let lastEditedPath = null;
let currentLoadedEncoding = "utf8";
let currentLoadedBom = false;
let currentLoadedIsBinary = false;

/**
 * Opens or replaces a Code Editor panel in the active cell.
 */
export async function openCodeEditor(filePath) {
  if (!filePath) {
    alert("No file selected to open in Code Editor.");
    return;
  }

  const workspace = document.getElementById("workspace");
  if (!workspace) {
    console.error("[CodeEditor] Workspace not found!");
    return;
  }

  let targetCell = window.activeCell;

  // 🟥 No active cell selected
  if (!targetCell || !workspace.contains(targetCell)) {
    alert("Please click a panel before opening the Code Editor.");
    return;
  }

  console.log("[CodeEditor] Replacing active cell with Code Editor:", filePath);

  // 🧹 Clear existing content of the selected cell (but keep the element itself)
  targetCell.innerHTML = "";
  targetCell.dataset.id = "CodeEditorPanel";

  // 🧩 Create header + editor container
  const header = document.createElement("div");
  header.className = "panel-header";
  header.textContent = `Code Editor — ${filePath}`;
  Object.assign(header.style, {
    padding: "4px",
    background: "#e0e0e0",
    borderBottom: "1px solid #ccc",
    fontWeight: "bold",
  });

  editorContainer = document.createElement("div");
  editorContainer.className = "monaco-editor-container";
  Object.assign(editorContainer.style, {
    flex: "1",
    position: "relative",
    width: "100%",
    height: "100%",
  });

  // 🧩 Assemble cell
  targetCell.appendChild(header);
  targetCell.appendChild(editorContainer);
  targetCell.style.display = "flex";
  targetCell.style.flexDirection = "column";

  // 🪄 Load file content
  await updateEditorPanel(filePath);
}

/**
 * Loads the file into the Monaco editor.
 */
export async function updateEditorPanel(filePath) {
  if (!filePath || filePath === lastEditedPath) return;
  lastEditedPath = filePath;

  console.log("📝 Loading file in editor:", filePath);

  try {
    const res = await fetch(`/api/fileCodeContent?path=${encodeURIComponent(filePath)}`);
    if (!res.ok) throw new Error(`Failed to load file: ${res.status}`);
    const data = await res.json();
    currentLoadedEncoding = data.encoding || "utf8";
    currentLoadedBom = Boolean(data.bom);
    currentLoadedIsBinary = Boolean(data.isBinary);
    window.currentFileEncoding = currentLoadedEncoding;
    window.currentFileBom = currentLoadedBom;
    initializeMonaco(filePath, data.content);
  } catch (err) {
    console.error("[CodeEditor] Error loading file:", err);
    if (editorContainer)
      editorContainer.innerHTML = `<pre style="color:red;">${err.message}</pre>`;
  }
}

/**
 * Initializes Monaco Editor inside the existing editorContainer.
 */
function initializeMonaco(filePath, content) {
  if (!editorContainer) {
    console.error("[CodeEditor] Editor container not found.");
    return;
  }

  // 1. Clean up existing editor instance
  if (editorInstance) {
    editorInstance.dispose();
    editorInstance = null;
  }

  if (typeof require === "undefined") {
    editorContainer.innerHTML = "<p style='color:red;'>Monaco Editor not loaded.</p>";
    return;
  }

  // 2. Configure and load Monaco
  require.config({ paths: { vs: "/lib/monaco/vs" } });

  window.MonacoEnvironment = {
    getWorker(moduleId, label) {
      const base = window.location.origin + "/lib/monaco/vs/";
      const paths = {
        json: base + "language/json/json.worker.js",
        css: base + "language/css/css.worker.js",
        html: base + "language/html/html.worker.js",
        typescript: base + "language/typescript/ts.worker.js",
        javascript: base + "language/typescript/ts.worker.js",
      };
      return new Worker(paths[label] || base + "editor/editor.worker.js", { type: "module" });
    },
  };

  require(["vs/editor/editor.main"], function () {
    // 3. Create the editor instance
    editorInstance = monaco.editor.create(editorContainer, {
      value: content || "",
      language: detectLanguage(filePath),
      theme: "vs-dark",
      automaticLayout: true,
    });

    // 4. Register globals for the SaveFile.mjs router
    // These variables are critical for the main save function to recognize the active editor.
    window.monacoEditor = editorInstance;
    window.currentActiveFilePath = filePath;
    window.currentFileEncoding = currentLoadedEncoding;
    window.currentFileBom = currentLoadedBom;
    console.log("🧠 Monaco editor registered globally for saving:", filePath);

    if (currentLoadedIsBinary) {
      console.warn(`[CodeEditor] "${filePath}" looks binary; text rendering may be lossy.`);
    }

    // 5. Add Keyboard Shortcut Listener (The Fix!)
    // We use Monaco's built-in command system to listen for Ctrl+S / Cmd+S.
    editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, function() {
        // Monaco handles preventing browser default when command is registered.
        saveCurrentFile({ path: filePath });
    });

  });
}

/**
 * Detects language from file extension.
 */
function detectLanguage(filePath) {
  const ext = filePath.split(".").pop().toLowerCase();
  return (
    {
      js: "javascript",
      mjs: "javascript",
      ts: "typescript",
      html: "html",
      css: "css",
      json: "json",
      py: "python",
      cpp: "cpp",
      cc: "cpp",
      h: "cpp",
      hpp: "cpp",
    }[ext] || "plaintext"
  );
}

/**
 * Integrates with panelManager.mjs to allow the Code Editor to be loaded as a panel.
 */
export async function setupPanel(panelElem, panelVars = {}) {
  console.log("[CodeEditor] setupPanel() invoked from panelManager.");

  // Determine file to open (if passed)
  const filePath = panelVars.filePath || panelVars.path || window.selectedFilePath || null;

  // Treat this panelElem as the active cell
  window.activeCell = panelElem;

  // Now reuse your existing logic
  await openCodeEditor(filePath || "Untitled");
}

// Expose globally
window.openCodeEditor = openCodeEditor;
window.updateEditorPanel = updateEditorPanel;
