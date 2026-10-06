// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/CodeEditorParts/RegisterCodeEditorLiveProvider.mjs
// This module implements register code editor live provider operations for CodeEditor, preserving the existing document and instance ownership contracts.

import { moduleState, CODE_EDITOR_LIVE_PROVIDER_ID, normalizeEditorPath, isNbtFilePath, isLatestEditorLoad } from "./ModuleState.mjs";
import { registerLiveFileContentProvider, touchLiveFileContentProvider } from "/LiveFileContent.mjs";
import { hasLiveEditorForPath } from "./OpenCodeEditor.mjs";
import { incrementPerformanceCounter } from "/PerformanceDiagnostics.mjs";
import { setBusyOperation } from "../../../EditorAttentionState.mjs";
import { loadNbtCodeContent } from "./TagIdFromName.mjs";
import { initializeMonaco } from "./InitializeMonaco.mjs";
import { clearNbtTagEditorContext } from "./ApplyNbtTagEditorPatch.mjs";
import { setStatus } from "/StatusBar.mjs";

export function registerCodeEditorLiveProvider(filePath, targetContainer) {
  if (typeof moduleState.codeEditorLiveCleanup === "function") {
    moduleState.codeEditorLiveCleanup();
    moduleState.codeEditorLiveCleanup = null;
  }
  targetContainer?.__nvCodeEditorLiveCleanup?.();

  const cleanupProvider = registerLiveFileContentProvider({
    id: CODE_EDITOR_LIVE_PROVIDER_ID,
    filePath,
    editorKind: "code",
    panelKind: "CodeEditor",
    sourceLabel: "Code Editor",
    encoding: moduleState.currentLoadedEncoding,
    isBinary: moduleState.currentLoadedIsBinary,
    dirty: () => Boolean(window.__nvCodeEditorDirty),
    getContent: () => {
      if (!hasLiveEditorForPath(filePath)) return undefined;
      return moduleState.editorInstance?.getValue?.() ?? moduleState.editorInstance?.getModel?.()?.getValue?.() ?? "";
    },
  });

  const touch = (reason = "attention") => {
    touchLiveFileContentProvider(CODE_EDITOR_LIVE_PROVIDER_ID, {
      filePath,
      encoding: moduleState.currentLoadedEncoding,
      isBinary: moduleState.currentLoadedIsBinary,
      reason,
    });
  };

  const pointerHandler = () => touch("attention");
  const focusHandler = () => touch("attention");
  targetContainer?.addEventListener?.("pointerdown", pointerHandler, { capture: true });
  targetContainer?.addEventListener?.("focusin", focusHandler, { capture: true });
  incrementPerformanceCounter("CodeEditor.liveProviderRegistered");
  incrementPerformanceCounter("CodeEditor.liveListenersAdded", 2);

  moduleState.codeEditorLiveCleanup = () => {
    targetContainer?.removeEventListener?.("pointerdown", pointerHandler, { capture: true });
    targetContainer?.removeEventListener?.("focusin", focusHandler, { capture: true });
    cleanupProvider?.();
    incrementPerformanceCounter("CodeEditor.liveListenersRemoved", 2);
    incrementPerformanceCounter("CodeEditor.liveProviderRemoved");
    if (targetContainer?.__nvCodeEditorLiveCleanup === moduleState.codeEditorLiveCleanup) targetContainer.__nvCodeEditorLiveCleanup = null;
  };
  if (targetContainer) targetContainer.__nvCodeEditorLiveCleanup = moduleState.codeEditorLiveCleanup;
  return touch;
}

export async function updateEditorPanel(filePath) {
  if (!filePath) return;
  if (normalizeEditorPath(filePath) === normalizeEditorPath(moduleState.lastEditedPath) && hasLiveEditorForPath(filePath)) return;
  const loadRequestId = ++moduleState.editorLoadRequestId;
  moduleState.pendingEditedPath = filePath;

  console.log("📝 Loading file in editor:", filePath);
  setBusyOperation({ id: "code-editor-loading", label: "Loading code editor", detail: filePath, cancellable: false });

  try {
    if (isNbtFilePath(filePath)) {
      const nbtData = await loadNbtCodeContent(filePath);
      if (!isLatestEditorLoad(loadRequestId, filePath)) {
        setBusyOperation(null);
        console.warn("[CodeEditor] Ignoring stale NBT load for:", filePath);
        return;
      }
      moduleState.currentLoadedEncoding = "utf8";
      moduleState.currentLoadedBom = false;
      moduleState.currentLoadedIsBinary = false;
      moduleState.currentLoadedFileFormat = "nbt";
      moduleState.currentLoadedNbtWasGzip = nbtData.gzip;
      window.currentFileEncoding = moduleState.currentLoadedEncoding;
      window.currentFileBom = moduleState.currentLoadedBom;
      initializeMonaco(filePath, nbtData.content, loadRequestId);
      return;
    }

    moduleState.currentLoadedFileFormat = "text";
    moduleState.currentLoadedNbtWasGzip = false;
    clearNbtTagEditorContext();

    const res = await fetch(`/api/fileCodeContent?path=${encodeURIComponent(filePath)}`);
    if (!res.ok) throw new Error(`Failed to load file: ${res.status}`);
    const data = await res.json();
    if (!isLatestEditorLoad(loadRequestId, filePath)) {
      setBusyOperation(null);
      console.warn("[CodeEditor] Ignoring stale file load for:", filePath);
      return;
    }
    moduleState.currentLoadedEncoding = data.encoding || "utf8";
    moduleState.currentLoadedBom = Boolean(data.bom);
    moduleState.currentLoadedIsBinary = Boolean(data.isBinary);
    window.currentFileEncoding = moduleState.currentLoadedEncoding;
    window.currentFileBom = moduleState.currentLoadedBom;
    initializeMonaco(filePath, data.content, loadRequestId);
  } catch (err) {
    if (!isLatestEditorLoad(loadRequestId, filePath)) {
      setBusyOperation(null);
      console.warn("[CodeEditor] Ignoring stale load error for:", filePath, err);
      return;
    }
    setBusyOperation(null);
    console.error("[CodeEditor] Error loading file:", err);
    if (moduleState.editorContainer)
      moduleState.editorContainer.innerHTML = `<pre style="color:red;">${err.message}</pre>`;
  }
}

export function toggleEditorWordWrap(editor = moduleState.editorInstance) {
  if (!editor?.getOption || !editor?.updateOptions) return;
  const isWrapped = editor.getOption(monaco.editor.EditorOption.wordWrap) === "on";
  const nextWordWrap = isWrapped ? "off" : "on";
  editor.updateOptions({ wordWrap: nextWordWrap });
  setStatus(nextWordWrap === "on" ? "Code editor word wrap on." : "Code editor word wrap off.");
}
