// Nodevision/public/PanelInstances/EditorPanels/CodeEditor.mjs
// Purpose: Editor panel for editing code files using Monaco Editor.
// Now supports adding or replacing panels depending on selection.

let lastEditedPath = null;
let editorInstance = null;
let editorContainer = null;

export async function setupPanel(panel, instanceVars = {}) {
  console.log("🧠 Initializing CodeEditor panel...");

  // 🧩 Clear and set up container
  panel.innerHTML = "";
  editorContainer = document.createElement("div");
  editorContainer.id = "monaco-editor";
  Object.assign(editorContainer.style, {
    position: "absolute",
    top: "0",
    left: "0",
    right: "0",
    bottom: "0",
  });
  panel.style.position = "relative";
  panel.appendChild(editorContainer);

  // 🪄 Reactive file watcher setup
  if (!window._selectedFileProxyInstalled_CodeEditor) {
    let internalPath = window.selectedFilePath || null;
    Object.defineProperty(window, "selectedFilePath", {
      get() { return internalPath; },
      set(value) {
        if (value !== internalPath) {
          console.log("✏️ selectedFilePath changed:", value);
          internalPath = value;
          updateEditorPanel(value);
        }
      },
      configurable: true,
    });
    window._selectedFileProxyInstalled_CodeEditor = true;
    console.log("✅ Reactive selectedFilePath watcher installed for CodeEditor.");
  }

  // Load file if available
  if (instanceVars.filePath) {
    window.selectedFilePath = instanceVars.filePath;
    await updateEditorPanel(instanceVars.filePath);
  } else if (window.selectedFilePath) {
    await updateEditorPanel(window.selectedFilePath);
  } else {
    editorContainer.innerHTML = "<em>No file selected.</em>";
  }
}

/**
 * Opens or replaces a CodeEditor panel for the given file.
 * If an active cell is selected, replaces it. Otherwise, adds a new one.
 */
export async function openCodeEditor(filePath) {
  if (!filePath) {
    alert("No file selected to open in Code Editor.");
    return;
  }

  // 🟦 Determine workspace behavior
  const workspace = document.getElementById("workspace");
  if (!workspace) {
    console.error("[CodeEditor] Workspace not found!");
    return;
  }

  let targetCell = window.activeCell;

  // 🟢 If no cell is active, add one
  if (!targetCell) {
    console.log("[CodeEditor] No active cell — creating new panel cell.");
    const row = workspace.querySelector(".panel-row") || workspace;
    targetCell = document.createElement("div");
    targetCell.className = "panel-cell";
    Object.assign(targetCell.style, {
      border: "1px solid #bbb",
      background: "#fafafa",
      overflow: "auto",
      flex: "1 1 0",
      position: "relative",
      display: "flex",
      flexDirection: "column",
    });
    row.appendChild(targetCell);
  }

  // 🟪 Replace or fill the target cell
  targetCell.innerHTML = `<div class="panel-header">Code Editor</div>`;
  await setupPanel(targetCell, { filePath });
  console.log(`🧩 Code editor opened for ${filePath}`);
}

/**
 * Updates the Monaco editor when the file changes.
 */
export async function updateEditorPanel(filePath) {
  if (!filePath) {
    if (editorContainer) editorContainer.innerHTML = "<em>No file selected.</em>";
    return;
  }

  if (filePath === lastEditedPath) {
    console.log("🔁 File already open in editor:", filePath);
    return;
  }
  lastEditedPath = filePath;

  console.log("📝 Opening file in editor:", filePath);
  await loadFileIntoMonaco(filePath);
}

/**
 * Loads a file into the Monaco editor.
 */
async function loadFileIntoMonaco(filePath) {
  try {
    const res = await fetch(`/api/fileCodeContent?path=${encodeURIComponent(filePath)}`);
    if (!res.ok) throw new Error(`Failed to load file: ${res.status}`);
    const data = await res.json();
    initializeMonaco(filePath, data.content);
  } catch (err) {
    console.error("[CodeEditor] Error loading file:", err);
    editorContainer.innerHTML = `<pre style="color:red;">Error loading file: ${err.message}</pre>`;
  }
}

/**
 * Initializes or replaces the Monaco editor instance.
 */
function initializeMonaco(filePath, content) {
  if (editorInstance) {
    editorInstance.dispose();
    editorInstance = null;
  }

  if (typeof require === "undefined") {
    console.error("[CodeEditor] RequireJS not found. Cannot initialize Monaco.");
    editorContainer.innerHTML = "<p style='color:red;'>Monaco Editor could not be loaded.</p>";
    return;
  }

  require.config({ paths: { vs: "/lib/monaco/vs" } });

  window.MonacoEnvironment = {
    getWorker: function (moduleId, label) {
      const base = window.location.origin + "/lib/monaco/vs/";
      let workerPath = base + "editor/editor.worker.js";

      if (label === "json") workerPath = base + "language/json/json.worker.js";
      if (label === "css") workerPath = base + "language/css/css.worker.js";
      if (label === "html") workerPath = base + "language/html/htmlWorker.js";
      if (label === "typescript" || label === "javascript")
        workerPath = base + "language/typescript/ts.worker.js";

      return new Worker(workerPath, { type: "module" });
    },
  };

  requestAnimationFrame(() => {
    require(["vs/editor/editor.main"], function () {
      if (!editorContainer) {
        console.error("[CodeEditor] editorContainer not found!");
        return;
      }

      editorInstance = monaco.editor.create(editorContainer, {
        value: content || "",
        language: detectLanguage(filePath),
        theme: "vs-dark",
        automaticLayout: true,
      });
    });
  });
}

/**
 * Detects language for Monaco syntax highlighting.
 */
function detectLanguage(filePath) {
  const ext = filePath.split(".").pop().toLowerCase();
  switch (ext) {
    case "js":
    case "mjs": return "javascript";
    case "ts": return "typescript";
    case "html": return "html";
    case "css": return "css";
    case "json": return "json";
    case "py": return "python";
    case "cpp":
    case "cc":
    case "h":
    case "hpp": return "cpp";
    default: return "plaintext";
  }
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

// Expose globally for convenience
window.updateEditorPanel = updateEditorPanel;
window.openCodeEditor = openCodeEditor;
