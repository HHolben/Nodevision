// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditorParts/UpdateGraphicalEditor.mjs
// This module implements update Graphical Editor behavior for the GraphicalEditor feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { getGraphicalEditorHost } from "./GetGraphicalEditorHost.mjs";
import { cleanupGraphicalEditorAttention } from "./CleanupGraphicalEditorAttention.mjs";
import { GraphicalEditorModuleState, resolveEditorModule, shouldShowWordCount } from "./LoadModuleMap.mjs";
import { setWordCountVisibility } from "/StatusBar.mjs";
import { updateToolbarState } from "/panels/createToolbar.mjs";
import { cleanupEditorHost, registerGraphicalEditorLiveProvider } from "./ReadGraphicalLiveContent.mjs";
import { setBusyOperation, setEditorContext } from "../../../EditorAttentionState.mjs";

// Update Graphical Editor operations.
export async function updateGraphicalEditor(filePath, {
  force = false,
  host = null,
  selectFile = true
} = {}) {
  const editorDiv = getGraphicalEditorHost(host);
  if (!editorDiv) {
    console.error("Graphical editor element not found.");
    return;
  }
  if (!filePath) {
    cleanupGraphicalEditorAttention(GraphicalEditorModuleState.lastEditedPath || window.currentActiveFilePath || null);
    setWordCountVisibility(false);
    window.NodevisionState = window.NodevisionState || {};
    window.NodevisionState.activePanelType = "GraphicalEditor";
    window.NodevisionState.currentMode = "GraphicalEditing";
    window.NodevisionState.activeActionHandler = null;
    window.NodevisionState.selectedFile = null;
    window.NodevisionState.activeEditorFilePath = null;
    updateToolbarState({
      currentMode: "GraphicalEditing",
      activeActionHandler: null
    });
    window.currentActiveFilePath = null;
    window.filePath = null;
    const {
      renderEditor
    } = await import("/PanelInstances/EditorPanels/GraphicalEditors/EditorFallback.mjs");
    cleanupEditorHost(editorDiv);
    editorDiv.innerHTML = "";
    renderEditor("(no file selected)", editorDiv);
    return;
  }
  if (!force && filePath === GraphicalEditorModuleState.lastEditedPath) {
    console.log("🔁 Editor already active for:", filePath);
    return;
  }
  GraphicalEditorModuleState.lastEditedPath = filePath;
  cleanupEditorHost(editorDiv);
  editorDiv.dataset.currentFilePath = filePath;
  editorDiv.dataset.nvGraphicalEditorPath = filePath;
  editorDiv.closest(".nv-panel-tab-content")?.setAttribute("data-current-file-path", filePath);
  editorDiv.closest(".panel-cell")?.setAttribute("data-current-file-path", filePath);
  editorDiv.innerHTML = "";

  // Keep global "active file" state aligned with the file shown in the graphical editor.
  window.currentActiveFilePath = filePath;
  window.filePath = filePath;
  if (selectFile) window.selectedFilePath = filePath;
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.activePanelType = "GraphicalEditor";
  window.NodevisionState.currentMode = "GraphicalEditing";
  window.NodevisionState.activeActionHandler = null;
  window.NodevisionState.selectedFile = filePath;
  window.NodevisionState.selectedFileIsDirectory = false;
  window.NodevisionState.activeEditorFilePath = filePath;
  window.NodevisionState.fileIsDirty = false;
  updateToolbarState({
    currentMode: "GraphicalEditing",
    activeActionHandler: null
  });
  console.log("🧭 Loading graphical editor for:", filePath);
  try {
    setBusyOperation({
      id: "editor-loading",
      label: "Loading editor",
      detail: filePath,
      cancellable: false
    });
    const resolution = await resolveEditorModule(filePath);
    const {
      modulePath,
      family,
      ext
    } = resolution;
    const attentionFamily = (family || ext || "graphical").toLowerCase();
    setEditorContext({
      filePath,
      fileFamily: attentionFamily,
      fileFamilyLabel: family || ext?.toUpperCase?.() || "Graphical",
      editorMode: `${ext || attentionFamily}-graphical`,
      editorModeLabel: family ? `${family} Editing` : `${(ext || "Graphical").toUpperCase()} Editing`
    });
    setWordCountVisibility(shouldShowWordCount({
      family,
      ext
    }));
    const editorFile = modulePath.split("/").pop();
    window.__nodevisionGraphicalEditorLastError = null;
    window.__nodevisionGraphicalEditorLastAttempt = {
      filePath,
      extension: ext,
      editorFile,
      modulePath,
      timestamp: Date.now()
    };
    if (!window.__nvModuleCacheBust) {
      window.__nvModuleCacheBust = Date.now();
    }
    const editorImportPath = `${modulePath}${modulePath.includes("?") ? "&" : "?"}v=${window.__nvModuleCacheBust}`;
    const editor = await import(editorImportPath);
    if (typeof editor.renderEditor === "function") {
      const cleanup = await editor.renderEditor(filePath, editorDiv);
      if (typeof cleanup === "function") {
        GraphicalEditorModuleState.currentGraphicalEditorCleanup = cleanup;
        editorDiv.__nvActiveEditorCleanup = cleanup;
      } else if (cleanup && typeof cleanup.destroy === "function") {
        GraphicalEditorModuleState.currentGraphicalEditorCleanup = () => cleanup.destroy();
        editorDiv.__nvActiveEditorCleanup = GraphicalEditorModuleState.currentGraphicalEditorCleanup;
      }
      registerGraphicalEditorLiveProvider(filePath, editorDiv);
      editorDiv.__nvGraphicalEditorMode = window.NodevisionState?.currentMode || "GraphicalEditing";
      setBusyOperation(null);
      console.log("✅ Editor rendered:", modulePath);
    } else {
      throw new Error("renderEditor() not found");
    }
  } catch (err) {
    setBusyOperation(null);
    setWordCountVisibility(false);
    console.error("❌ Failed to load editor:", err);
    const attempt = window.__nodevisionGraphicalEditorLastAttempt || {};
    window.__nodevisionGraphicalEditorLastError = {
      ...attempt,
      message: err?.message || String(err),
      stack: err?.stack || null,
      timestamp: Date.now()
    };
    const {
      renderEditor
    } = await import("/PanelInstances/EditorPanels/GraphicalEditors/EditorFallback.mjs");
    cleanupEditorHost(editorDiv);
    renderEditor(filePath, editorDiv, {
      error: window.__nodevisionGraphicalEditorLastError
    });
  }
}
