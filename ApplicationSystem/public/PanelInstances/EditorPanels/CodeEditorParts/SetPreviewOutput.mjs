// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/CodeEditorParts/SetPreviewOutput.mjs
// This module implements set preview output operations for CodeEditor, preserving the existing document and instance ownership contracts.

import { moduleState } from "./ModuleState.mjs";
import { inferPreviewLanguage, installNbtTagEditorContext, clearNbtTagEditorContext } from "./ApplyNbtTagEditorPatch.mjs";
import { saveNbtCodeFile } from "./SaveNbtCodeFile.mjs";
import { setWordCountVisibility } from "/StatusBar.mjs";
import { updateToolbarState } from "/panels/createToolbar.mjs";
import { reportCodeEditorAttention } from "./IsCodeEditorActive.mjs";
import { registerCodeEditorLiveProvider } from "./RegisterCodeEditorLiveProvider.mjs";
import { updateDirtyState } from "./ShowCommonVarOverlay.mjs";

export function setPreviewOutput(text) {
  if (!moduleState.previewOutputEl) return;
  moduleState.previewOutputEl.textContent = text;
}

export function setPreviewStatus(text) {
  if (!moduleState.previewStatusEl) return;
  moduleState.previewStatusEl.textContent = text;
}

export async function runPreview(filePath) {
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

export function cleanupCellBeforeCodeEditor(cell) {
  if (!cell) return;
  if (typeof cell.cleanup === "function") {
    try {
      cell.cleanup();
    } catch (err) {
      console.warn("[CodeEditor] Previous panel cleanup failed:", err);
    }
    cell.cleanup = null;
  }

  const graphicalHost = cell.querySelector?.("#graphical-editor");
  const graphicalCleanup = graphicalHost?.__nvActiveEditorCleanup;
  if (typeof graphicalCleanup === "function") {
    try {
      graphicalCleanup();
    } catch (err) {
      console.warn("[CodeEditor] Graphical editor cleanup failed:", err);
    }
    graphicalHost.__nvActiveEditorCleanup = null;
  }
}

export function codeEditorSessionFromHost(host) {
  if (!host) return null;
  if (host.__nvCodeEditorSession) return host.__nvCodeEditorSession;
  return host.querySelector?.(".monaco-editor-container")?.__nvCodeEditorSession || null;
}

export function codeEditorSessionFromEvent(event) {
  const target = event?.target?.nodeType === 1 ? event.target : event?.target?.parentElement || null;
  const container = target?.closest?.(".monaco-editor-container");
  return container?.__nvCodeEditorSession || null;
}

export function eventTargetsCodeEditorContainer(event) {
  const target = event?.target?.nodeType === 1 ? event.target : event?.target?.parentElement || null;
  return Boolean(target?.closest?.(".monaco-editor-container"));
}

export function focusedCodeEditorSession() {
  const focused = document.activeElement?.nodeType === 1 ? document.activeElement : null;
  const focusedSession = focused?.closest?.(".monaco-editor-container")?.__nvCodeEditorSession || null;
  if (focusedSession?.editor?.hasTextFocus?.()) return focusedSession;

  const activeSession = moduleState.editorInstanceContainer?.__nvCodeEditorSession || moduleState.editorContainer?.__nvCodeEditorSession || null;
  if (activeSession?.editor?.hasTextFocus?.()) return activeSession;
  return null;
}

export function activateCodeEditorHost(host) {
  const session = codeEditorSessionFromHost(host);
  if (!session?.editor || !session.editorContainer?.isConnected) return false;
  moduleState.editorInstance = session.editor;
  moduleState.editorContainer = session.editorContainer;
  moduleState.editorInstanceContainer = session.editorContainer;
  moduleState.lastEditedPath = session.filePath;
  moduleState.currentLoadedEncoding = session.encoding || "utf8";
  moduleState.currentLoadedBom = Boolean(session.bom);
  moduleState.currentLoadedIsBinary = Boolean(session.isBinary);
  moduleState.currentLoadedFileFormat = session.fileFormat || "text";
  moduleState.currentLoadedNbtWasGzip = Boolean(session.nbtWasGzip);
  moduleState.savedVersionId = session.savedVersionId ?? session.editor.getModel?.()?.getAlternativeVersionId?.() ?? null;
  window.monacoEditor = moduleState.editorInstance;
  window.__nvCodeEditorActivePath = session.filePath;
  window.currentActiveFilePath = session.filePath;
  window.currentFileEncoding = moduleState.currentLoadedEncoding;
  window.currentFileBom = moduleState.currentLoadedBom;
  if (moduleState.currentLoadedFileFormat === "nbt") {
    window.saveCodeFile = saveNbtCodeFile;
    window.__nvCodeEditorSaveFormat = "nbt";
    installNbtTagEditorContext(session.filePath);
  } else if (window.__nvCodeEditorSaveFormat === "nbt") {
    window.saveCodeFile = null;
    window.__nvCodeEditorSaveFormat = null;
    clearNbtTagEditorContext();
  }
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.selectedFile = session.filePath;
  window.NodevisionState.selectedFileIsDirectory = false;
  window.NodevisionState.activeEditorFilePath = session.filePath;
  window.NodevisionState.currentMode = "CodeEditing";
  window.NodevisionState.activeActionHandler = null;
  setWordCountVisibility(false);
  updateToolbarState({ currentMode: "CodeEditing", selectedFile: session.filePath, activeEditorFilePath: session.filePath, activeActionHandler: null });
  reportCodeEditorAttention(session.filePath, moduleState.editorInstance, { restore: false });
  session.touchLive = registerCodeEditorLiveProvider(session.filePath, session.editorContainer);
  updateDirtyState();
  window.requestAnimationFrame?.(() => moduleState.editorInstance?.layout?.());
  return true;
}
