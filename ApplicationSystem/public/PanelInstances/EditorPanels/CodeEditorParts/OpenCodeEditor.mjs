// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/CodeEditorParts/OpenCodeEditor.mjs
// This module implements open code editor operations for CodeEditor, preserving the existing document and instance ownership contracts.

import { setWordCountVisibility } from "/StatusBar.mjs";
import { normalizeEditorPath, moduleState, codeEditorFontSize, applyCodeEditorFontSize } from "./ModuleState.mjs";
import { cleanupCellBeforeCodeEditor, runPreview, setPreviewStatus, setPreviewOutput } from "./SetPreviewOutput.mjs";
import { updateToolbarState } from "/panels/createToolbar.mjs";
import { installCodeEditorZoom } from "../CodeEditorZoom.mjs";
import { persistCodeEditorAttention } from "./IsCodeEditorActive.mjs";
import { clearEditorContext } from "../../../EditorAttentionState.mjs";
import { incrementPerformanceCounter } from "/PerformanceDiagnostics.mjs";
import { updateEditorPanel } from "./RegisterCodeEditorLiveProvider.mjs";

export async function openCodeEditor(filePath, options = {}) {
  if (!filePath) {
    alert("No file selected to open in Code Editor.");
    return;
  }

  // Code editor is not a publication-focused editor; hide word counter.
  setWordCountVisibility(false);

  const workspace = document.getElementById("workspace");
  if (!workspace) {
    console.error("[CodeEditor] Workspace not found!");
    return;
  }

  if (!options.__nvGuardedEditorSwitch && !options.bypassTabs && window.__nvCodeEditorDirty && typeof window.__nvGuardEditorSwitch === "function" && normalizeEditorPath(filePath) !== normalizeEditorPath(window.__nvCodeEditorActivePath || moduleState.lastEditedPath)) {
    window.__nvGuardEditorSwitch(filePath, () => openCodeEditor(filePath, { ...options, __nvGuardedEditorSwitch: true }));
    return;
  }

  if (!options.bypassTabs && typeof window.__nvOpenPanelTab === "function") {
    const activeCell = window.activeCell?.closest?.(".panel-cell") || window.activeCell;
    if (activeCell?.classList?.contains("panel-cell") && workspace.contains(activeCell)) {
      return window.__nvOpenPanelTab(activeCell, "CodeEditor", "EditorPanel", { filePath });
    }
  }

  let targetCell = options.targetElement || window.activeCell;

  // 🟥 No active cell selected
  if (!targetCell || !workspace.contains(targetCell)) {
    alert("Please click a panel before opening the Code Editor.");
    return;
  }

  cleanupCellBeforeCodeEditor(targetCell);

  console.log("[CodeEditor] Replacing active cell with Code Editor:", filePath);
  targetCell.dataset.currentFilePath = filePath;
  targetCell.dataset.nvCodeEditorRoot = "true";

  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.selectedFile = filePath;
  window.NodevisionState.selectedFileIsDirectory = false;
  window.NodevisionState.activeEditorFilePath = filePath;
  window.NodevisionState.currentMode = "CodeEditing";
  window.NodevisionState.activeActionHandler = null;
  updateToolbarState({ currentMode: "CodeEditing", selectedFile: filePath, activeEditorFilePath: filePath, activeActionHandler: null });

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

  moduleState.previewStatusEl = document.createElement("span");
  moduleState.previewStatusEl.style.fontWeight = "normal";
  moduleState.previewStatusEl.style.opacity = "0.8";
  header.appendChild(moduleState.previewStatusEl);

  moduleState.editorContainer = document.createElement("div");
  moduleState.editorContainer.className = "monaco-editor-container";
  Object.assign(moduleState.editorContainer.style, {
    flex: "1",
    position: "relative",
    width: "100%",
    height: "100%",
  });
  installCodeEditorZoom(moduleState.editorContainer, codeEditorFontSize, applyCodeEditorFontSize);

  // 🧩 Assemble cell
  targetCell.appendChild(header);
  targetCell.appendChild(moduleState.editorContainer);
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
  moduleState.previewOutputEl = outputWrap;
  targetCell.appendChild(outputWrap);
  targetCell.style.display = "flex";
  targetCell.style.flexDirection = "column";
  targetCell.cleanup = () => {
    const session = targetCell.__nvCodeEditorSession || moduleState.editorContainer?.__nvCodeEditorSession;
    const ownedEditor = session?.editor || (moduleState.editorInstanceContainer && targetCell.contains(moduleState.editorInstanceContainer) ? moduleState.editorInstance : null);
    persistCodeEditorAttention(filePath, ownedEditor || moduleState.editorInstance);
    const liveCleanup = session?.editorContainer?.__nvCodeEditorLiveCleanup || (session?.editor === moduleState.editorInstance ? moduleState.codeEditorLiveCleanup : null);
    if (typeof liveCleanup === "function") {
      liveCleanup();
      if (moduleState.codeEditorLiveCleanup === liveCleanup) moduleState.codeEditorLiveCleanup = null;
    }
    clearEditorContext(filePath);
    if (ownedEditor) incrementPerformanceCounter("CodeEditor.monacoDisposeCalls");
    session?.editorContainer?.__nvCodeEditorZoomHandlersInstalled?.dispose();
    ownedEditor?.dispose?.();
    if (!ownedEditor || moduleState.editorInstance === ownedEditor) {
      moduleState.editorInstance = null;
      moduleState.editorInstanceContainer = null;
      moduleState.editorContainer = null;
      window.monacoEditor = null;
    }
    if (session?.editorContainer) session.editorContainer.__nvCodeEditorSession = null;
    targetCell.__nvCodeEditorSession = null;
    moduleState.commonVarOverlay = null;
  };

  // 🪄 Load file content
  await updateEditorPanel(filePath);
}

export function hasLiveEditorForPath(filePath) {
  const editorDom = moduleState.editorInstance?.getDomNode?.();
  const model = moduleState.editorInstance?.getModel?.();
  return Boolean(
    filePath &&
    moduleState.editorInstance &&
    model &&
    moduleState.editorContainer &&
    moduleState.editorContainer.isConnected &&
    moduleState.editorInstanceContainer === moduleState.editorContainer &&
    editorDom &&
    moduleState.editorContainer.contains(editorDom) &&
    normalizeEditorPath(moduleState.lastEditedPath) === normalizeEditorPath(filePath)
  );
}
