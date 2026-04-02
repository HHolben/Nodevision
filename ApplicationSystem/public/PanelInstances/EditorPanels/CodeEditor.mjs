// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/CodeEditor.mjs
// This file defines browser-side Code Editor logic for the Nodevision UI. It renders interface components and handles user interactions.
import saveCurrentFile from "/ToolbarCallbacks/file/saveFile.mjs";

let editorInstance = null;
let editorContainer = null;
let lastEditedPath = null;
let currentLoadedEncoding = "utf8";
let currentLoadedBom = false;
let currentLoadedIsBinary = false;
let previewOutputEl = null;
let previewStatusEl = null;
let commonVarOverlay = null;
let commonVarData = [];

function inferPreviewLanguage(filePath) {
  const lower = String(filePath || "").toLowerCase();
  if (lower.endsWith(".py")) return "python";
  if (lower.endsWith(".java")) return "java";
  if (lower.endsWith(".cpp")) return "cpp";
  return null;
}

function setPreviewOutput(text) {
  if (!previewOutputEl) return;
  previewOutputEl.textContent = text;
}

function setPreviewStatus(text) {
  if (!previewStatusEl) return;
  previewStatusEl.textContent = text;
}

async function runPreview(filePath) {
  const language = inferPreviewLanguage(filePath);
  if (!language) {
    alert("Preview Run supports .py, .java, .cpp files only.");
    return;
  }

  setPreviewStatus("Running preview...");
  setPreviewOutput("");

  try {
    const res = await fetch("/api/preview/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filePath,
        language,
        timeoutMs: 5000,
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) {
      setPreviewStatus("Preview failed");
      setPreviewOutput(JSON.stringify(data || { error: "Preview failed" }, null, 2));
      return;
    }

    const lines = [];
    lines.push(`runner: ${data.runner || "local-dev"}`);
    lines.push(`ok: ${Boolean(data.ok)} timedOut: ${Boolean(data.timedOut)} exitCode: ${data.exitCode}`);

    if (data.stdout) {
      lines.push("");
      lines.push("=== stdout ===");
      lines.push(String(data.stdout));
    }
    if (data.stderr) {
      lines.push("");
      lines.push("=== stderr ===");
      lines.push(String(data.stderr));
    }

    setPreviewStatus("Preview complete");
    setPreviewOutput(lines.join("\n"));
  } catch (err) {
    setPreviewStatus("Preview error");
    setPreviewOutput(String(err?.message || err));
  }
}

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

  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.selectedFile = filePath;
  window.NodevisionState.activeEditorFilePath = filePath;

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
    display: "flex",
    alignItems: "center",
    gap: "8px",
  });

  const headerSpacer = document.createElement("div");
  headerSpacer.style.flex = "1";
  header.appendChild(headerSpacer);

  const previewBtn = document.createElement("button");
  previewBtn.textContent = "Preview Run";
  previewBtn.onclick = () => runPreview(filePath);
  header.appendChild(previewBtn);

  const clearBtn = document.createElement("button");
  clearBtn.textContent = "Clear Output";
  clearBtn.onclick = () => {
    setPreviewStatus("");
    setPreviewOutput("");
  };
  header.appendChild(clearBtn);

  previewStatusEl = document.createElement("span");
  previewStatusEl.style.fontWeight = "normal";
  previewStatusEl.style.opacity = "0.8";
  header.appendChild(previewStatusEl);

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
  const outputWrap = document.createElement("div");
  Object.assign(outputWrap.style, {
    borderTop: "1px solid #ccc",
    background: "#0b1020",
    color: "#d6e2ff",
    fontFamily: "monospace",
    fontSize: "12px",
    padding: "8px",
    maxHeight: "180px",
    overflow: "auto",
    whiteSpace: "pre-wrap",
  });
  previewOutputEl = outputWrap;
  targetCell.appendChild(outputWrap);
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
      folding: true,
      foldingHighlight: true,
      wordWrap: "off",
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

    // Folding markers (#region / #endregion) across common languages
    configureFoldingMarkers();

    // Quick fold/unfold actions for current region
    editorInstance.addAction({
      id: "nv.foldHere",
      label: "Fold Region Here",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.BracketLeft],
      run: () => editorInstance.getAction("editor.fold")?.run(),
    });
    editorInstance.addAction({
      id: "nv.unfoldHere",
      label: "Unfold Region Here",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.BracketRight],
      run: () => editorInstance.getAction("editor.unfold")?.run(),
    });
    editorInstance.addAction({
      id: "nv.foldAllRegions",
      label: "Fold All Marker Regions",
      run: () => editorInstance.getAction("editor.foldAllMarkerRegions")?.run(),
    });

    // Alt+Z word wrap toggle (explicit binding for consistency)
    editorInstance.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.KeyZ, () => {
      editorInstance.getAction("editor.action.toggleWordWrap")?.run();
    });

    // Ctrl/Cmd+F: show common identifiers helper + default find
    editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () => {
      showCommonVarOverlay();
      editorInstance.getAction("actions.find")?.run();
    });

    // Keep overlay data fresh as user types
    editorInstance.onDidChangeModelContent(() => {
      if (commonVarOverlay?.style.display === "block") {
        refreshCommonVarOverlay();
      }
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

function configureFoldingMarkers() {
  const markers = {
    start: /^\s*#region\b/i,
    end: /^\s*#endregion\b/i,
  };
  ["javascript", "typescript", "html", "css", "python", "cpp", "json", "plaintext"].forEach((lang) => {
    try {
      monaco.languages.setLanguageConfiguration(lang, { folding: { markers } });
    } catch (err) {
      console.warn("Folding marker config failed for", lang, err);
    }
  });
}

function collectCommonIdentifiers(model, max = 8) {
  if (!model) return [];
  const text = model.getValue();
  const re = /\b[A-Za-z_][A-Za-z0-9_]*\b/g;
  const counts = new Map();
  const keywords = new Set([
    "function","return","const","let","var","if","else","for","while","switch","case","break","continue",
    "class","extends","import","from","export","default","try","catch","finally","throw","new","this",
    "true","false","null","undefined","async","await","def","lambda","pass","None","in","and","or","not",
    "int","float","double","char","void","public","private","protected","static","final","enum","struct"
  ]);
  let m;
  while ((m = re.exec(text)) !== null) {
    const word = m[0];
    if (keywords.has(word)) continue;
    counts.set(word, (counts.get(word) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([name, count]) => ({ name, count }));
}

function ensureCommonVarOverlay() {
  if (commonVarOverlay) return commonVarOverlay;
  const div = document.createElement("div");
  commonVarOverlay = div;
  Object.assign(div.style, {
    position: "absolute",
    top: "8px",
    right: "8px",
    background: "rgba(20,20,20,0.9)",
    color: "#fff",
    padding: "8px",
    borderRadius: "6px",
    boxShadow: "0 4px 14px rgba(0,0,0,0.35)",
    fontSize: "12px",
    display: "none",
    maxWidth: "260px",
    zIndex: 50,
  });
  const title = document.createElement("div");
  title.textContent = "Common identifiers (click to jump)";
  title.style.fontWeight = "700";
  title.style.marginBottom = "6px";
  div.appendChild(title);

  const list = document.createElement("div");
  list.id = "nv-common-var-list";
  list.style.display = "grid";
  list.style.gridTemplateColumns = "repeat(auto-fit, minmax(90px, 1fr))";
  list.style.gap = "6px";
  div.appendChild(list);

  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "×";
  Object.assign(close.style, {
    position: "absolute",
    top: "4px",
    right: "6px",
    background: "transparent",
    color: "#fff",
    border: "none",
    fontSize: "14px",
    cursor: "pointer",
  });
  close.addEventListener("click", () => {
    commonVarOverlay.style.display = "none";
  });
  div.appendChild(close);

  editorContainer.appendChild(div);
  return div;
}

function refreshCommonVarOverlay() {
  if (!editorInstance || !commonVarOverlay) return;
  const list = commonVarOverlay.querySelector("#nv-common-var-list");
  if (!list) return;
  commonVarData = collectCommonIdentifiers(editorInstance.getModel());
  list.innerHTML = "";
  if (!commonVarData.length) {
    const empty = document.createElement("div");
    empty.textContent = "No identifiers yet.";
    empty.style.opacity = "0.8";
    list.appendChild(empty);
    return;
  }
  commonVarData.forEach(({ name, count }) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = `${name} (${count})`;
    Object.assign(btn.style, {
      padding: "4px 6px",
      border: "1px solid #444",
      background: "#1e1e1e",
      color: "#fff",
      borderRadius: "4px",
      cursor: "pointer",
      textAlign: "left",
    });
    btn.addEventListener("click", () => jumpToIdentifier(name));
    list.appendChild(btn);
  });
}

function jumpToIdentifier(name) {
  if (!editorInstance || !name) return;
  const model = editorInstance.getModel();
  if (!model) return;
  const matches = model.findMatches(name, true, false, false, null, true);
  if (!matches.length) return;
  const pos = matches[0].range;
  editorInstance.setSelection(pos);
  editorInstance.revealRangeInCenter(pos);
  commonVarOverlay.style.display = "none";
}

function showCommonVarOverlay() {
  ensureCommonVarOverlay();
  refreshCommonVarOverlay();
  commonVarOverlay.style.display = "block";
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
