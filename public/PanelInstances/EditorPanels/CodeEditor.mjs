// Nodevision/public/PanelInstances/EditorPanels/CodeEditor.mjs
// Purpose: Editor panel for editing code files using Monaco Editor.
// Reacts to window.selectedFilePath like View Panels.

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
function initializeMonaco(filePath, content) {
  // Dispose previous editor
  if (editorInstance) {
    editorInstance.dispose();
    editorInstance = null;
  }

  // Ensure RequireJS (loader.js) is present
  if (typeof require === "undefined") {
    console.error("[CodeEditor] RequireJS not found. Cannot initialize Monaco.");
    editorContainer.innerHTML = "<p style='color:red;'>Monaco Editor could not be loaded.</p>";
    return;
  }

  // Configure Monaco paths
  require.config({ paths: { vs: "/lib/monaco/vs" } });

  // Configure Monaco workers
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

  // ✅ Wait one animation frame to ensure the container is attached
  requestAnimationFrame(() => {
    require(["vs/editor/editor.main"], function () {
      if (!editorContainer) {
        console.error("[CodeEditor] editorContainer not found!");
        return;
      }

      // Create Monaco instance in the correct container
      editorInstance = monaco.editor.create(editorContainer, {
        value: content || "",
        language: detectLanguage(filePath),
        theme: "vs-dark",
        automaticLayout: true,
      });
    });
  });
}


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

// Expose globally for debugging or hot reloads
window.updateEditorPanel = updateEditorPanel;
