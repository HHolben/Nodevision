// Nodevision/public/PanelInstances/EditorPanels/CodeEditor.mjs
// Purpose: Replace the active panel cell with a Monaco-based Code Editor for the selected file.

let editorInstance = null;
let editorContainer = null;
let lastEditedPath = null;

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

  if (editorInstance) {
    editorInstance.dispose();
    editorInstance = null;
  }

  if (typeof require === "undefined") {
    editorContainer.innerHTML = "<p style='color:red;'>Monaco Editor not loaded.</p>";
    return;
  }

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
    editorInstance = monaco.editor.create(editorContainer, {
      value: content || "",
      language: detectLanguage(filePath),
      theme: "vs-dark",
      automaticLayout: true,
    });

    // ✅ Add these lines:
    window.monacoEditor = editorInstance;
    window.currentActiveFilePath = filePath;
    console.log("🧠 Monaco editor registered globally for saving:", filePath);
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
 * Saves file from editor content back to disk.
 */
async function saveFile(filePath) {
  if (!editorInstance || !filePath) return;
  const content = editorInstance.getValue();

  try {
    const res = await fetch("/api/fileSave", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: filePath, content }),
    });
    if (!res.ok) throw new Error(`Save failed: ${res.status}`);
    console.log(`💾 Saved ${filePath}`);
  } catch (err) {
    console.error("[CodeEditor] Error saving file:", err);
  }
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
