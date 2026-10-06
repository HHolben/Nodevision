// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/CodeEditorParts/InitializeMonaco.mjs
// This module implements initialize monaco operations for CodeEditor, preserving the existing document and instance ownership contracts.

import saveCurrentFile from "/ToolbarCallbacks/file/saveFile.mjs";
import { moduleState, isLatestEditorLoad, codeEditorFontSize, installCodeEditorFileSavedListener } from "./ModuleState.mjs";
import { createPerformanceOperation, incrementPerformanceCounter } from "/PerformanceDiagnostics.mjs";
import { persistCodeEditorAttention, reportCodeEditorAttention } from "./IsCodeEditorActive.mjs";
import { detectLanguage, configureFoldingMarkers, refreshCommonVarOverlay } from "./DetectLanguage.mjs";
import { setBusyOperation } from "../../../EditorAttentionState.mjs";
import { saveNbtCodeFile } from "./SaveNbtCodeFile.mjs";
import { installNbtTagEditorContext, clearNbtTagEditorContext } from "./ApplyNbtTagEditorPatch.mjs";
import { setStatus } from "/StatusBar.mjs";
import { toggleEditorWordWrap, registerCodeEditorLiveProvider } from "./RegisterCodeEditorLiveProvider.mjs";
import { showCommonVarOverlay, updateDirtyState } from "./ShowCommonVarOverlay.mjs";
import { notifyNbtTagContext } from "./ResolveEditableNbtTag.mjs";

export function initializeMonaco(filePath, content, loadRequestId = moduleState.editorLoadRequestId) {
  const perf = createPerformanceOperation("CodeEditor Monaco init", { path: filePath });
  incrementPerformanceCounter("CodeEditor.initializeMonacoCalls");
  const targetContainer = moduleState.editorContainer;
  if (!targetContainer) {
    console.error("[CodeEditor] Editor container not found.");
    perf.end({ success: false, error: "container-missing" });
    return;
  }
  if (!isLatestEditorLoad(loadRequestId, filePath)) {
    console.warn("[CodeEditor] Skipping stale Monaco initialization for:", filePath);
    perf.end({ success: false, stale: true });
    return;
  }

  // 1. Move any active editor into its tab session before creating another one.
  if (typeof moduleState.codeEditorLiveCleanup === "function") {
    moduleState.codeEditorLiveCleanup();
    moduleState.codeEditorLiveCleanup = null;
  }
  if (moduleState.editorInstance && moduleState.editorInstanceContainer && moduleState.editorInstanceContainer !== targetContainer) {
    const previousSession = moduleState.editorInstanceContainer.__nvCodeEditorSession;
    if (previousSession) {
      previousSession.savedVersionId = moduleState.savedVersionId;
      previousSession.dirty = Boolean(window.__nvCodeEditorDirty);
      previousSession.encoding = moduleState.currentLoadedEncoding;
      previousSession.bom = moduleState.currentLoadedBom;
      previousSession.isBinary = moduleState.currentLoadedIsBinary;
      previousSession.fileFormat = moduleState.currentLoadedFileFormat;
      previousSession.nbtWasGzip = moduleState.currentLoadedNbtWasGzip;
      previousSession.fontSize = codeEditorFontSize(moduleState.editorInstance, previousSession);
    }
    persistCodeEditorAttention(moduleState.lastEditedPath || window.__nvCodeEditorActivePath, moduleState.editorInstance);
  } else if (moduleState.editorInstance) {
    incrementPerformanceCounter("CodeEditor.monacoDisposeCalls");
    moduleState.editorInstance.dispose();
  }
  moduleState.editorInstance = null;
  moduleState.editorInstanceContainer = null;
  moduleState.commonVarOverlay = null;
  moduleState.savedVersionId = null;
  if (window.monacoEditor && window.monacoEditor !== moduleState.editorInstance) window.monacoEditor = null;

  if (typeof require === "undefined") {
    targetContainer.innerHTML = "<p style='color:red;'>Monaco Editor not loaded.</p>";
    perf.end({ success: false, error: "require-missing" });
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
    if (moduleState.editorContainer !== targetContainer || !targetContainer.isConnected || !isLatestEditorLoad(loadRequestId, filePath)) {
      console.warn("[CodeEditor] Ignoring stale Monaco initialization for:", filePath);
      perf.end({ success: false, stale: true, phase: "require-callback" });
      return;
    }

    // 3. Create the editor instance
    incrementPerformanceCounter("CodeEditor.monacoCreateCalls");
    perf.mark("monaco-loaded");
    moduleState.editorInstance = monaco.editor.create(targetContainer, {
      value: content || "",
      language: detectLanguage(filePath),
      theme: "vs-dark",
      automaticLayout: true,
      folding: true,
      foldingHighlight: true,
      wordWrap: "off",
    });
    setBusyOperation(null);
    reportCodeEditorAttention(filePath, moduleState.editorInstance, { restore: true });
    moduleState.editorInstance.onDidChangeCursorPosition?.(() => persistCodeEditorAttention(filePath, moduleState.editorInstance));
    moduleState.editorInstance.onDidScrollChange?.(() => persistCodeEditorAttention(filePath, moduleState.editorInstance));

    // 4. Register globals for the SaveFile.mjs router
    // These variables are critical for the main save function to recognize the active editor.
    moduleState.editorInstanceContainer = targetContainer;
    window.monacoEditor = moduleState.editorInstance;
    window.currentActiveFilePath = filePath;
    window.currentFileEncoding = moduleState.currentLoadedEncoding;
    window.currentFileBom = moduleState.currentLoadedBom;
    if (moduleState.currentLoadedFileFormat === "nbt") {
      window.saveCodeFile = saveNbtCodeFile;
      window.__nvCodeEditorSaveFormat = "nbt";
      installNbtTagEditorContext(filePath);
      setStatus("NBT", "Tags loaded as editable JSON");
    } else if (window.__nvCodeEditorSaveFormat === "nbt") {
      window.saveCodeFile = null;
      window.__nvCodeEditorSaveFormat = null;
      clearNbtTagEditorContext();
    }
    console.log("🧠 Monaco editor registered globally for saving:", filePath);

    if (moduleState.currentLoadedIsBinary) {
      console.warn(`[CodeEditor] "${filePath}" looks binary; text rendering may be lossy.`);
    }

    // 5. Add Keyboard Shortcut Listener (The Fix!)
    // We use Monaco's built-in command system to listen for Ctrl+S / Cmd+S.
    moduleState.editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, function() {
        // Monaco handles preventing browser default when command is registered.
        saveCurrentFile({ path: filePath });
    });

    // Folding markers (#region / #endregion) across common languages
    configureFoldingMarkers();

    // Quick fold/unfold actions for current region
    moduleState.editorInstance.addAction({
      id: "nv.foldHere",
      label: "Fold Region Here",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.BracketLeft],
      run: () => moduleState.editorInstance.getAction("editor.fold")?.run(),
    });
    moduleState.editorInstance.addAction({
      id: "nv.unfoldHere",
      label: "Unfold Region Here",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.BracketRight],
      run: () => moduleState.editorInstance.getAction("editor.unfold")?.run(),
    });
    moduleState.editorInstance.addAction({
      id: "nv.foldAllRegions",
      label: "Fold All Marker Regions",
      run: () => moduleState.editorInstance.getAction("editor.foldAllMarkerRegions")?.run(),
    });

    moduleState.editorInstance.addAction({
      id: "nv.toggleWordWrap",
      label: "Toggle Word Wrap",
      keybindings: [monaco.KeyMod.Alt | monaco.KeyCode.KeyZ],
      run: () => toggleEditorWordWrap(moduleState.editorInstance),
    });

    // Ctrl/Cmd+F: show common identifiers helper + default find
    moduleState.editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () => {
      showCommonVarOverlay();
      moduleState.editorInstance.getAction("actions.find")?.run();
    });

    let touchCodeEditorLive = () => {};

    // Keep overlay data fresh as user types
    moduleState.editorInstance.onDidChangeModelContent(() => {
      if (moduleState.commonVarOverlay?.style.display === "block") {
        refreshCommonVarOverlay();
      }
      updateDirtyState();
      touchCodeEditorLive("content");
      if (moduleState.currentLoadedFileFormat === "nbt") notifyNbtTagContext("content");
    });

    const model = moduleState.editorInstance.getModel();
    const initialFontSize = codeEditorFontSize(moduleState.editorInstance);
    const session = {
      editor: moduleState.editorInstance,
      editorContainer: targetContainer,
      filePath,
      encoding: moduleState.currentLoadedEncoding,
      bom: moduleState.currentLoadedBom,
      isBinary: moduleState.currentLoadedIsBinary,
      fileFormat: moduleState.currentLoadedFileFormat,
      nbtWasGzip: moduleState.currentLoadedNbtWasGzip,
      savedVersionId: model?.getAlternativeVersionId?.() || null,
      defaultFontSize: initialFontSize,
      fontSize: initialFontSize,
      dirty: false,
    };
    targetContainer.__nvCodeEditorSession = session;
    const host = targetContainer.closest(".nv-panel-tab-content") || targetContainer.parentElement;
    if (host) {
      host.__nvCodeEditorSession = session;
      host.dataset.currentFilePath = filePath;
      host.dataset.nvCodeEditorRoot = "true";
    }
    moduleState.savedVersionId = session.savedVersionId;
    window.__nvCodeEditorDirty = false;
    window.__nvCodeEditorActivePath = filePath;
    moduleState.lastEditedPath = filePath;
    touchCodeEditorLive = registerCodeEditorLiveProvider(filePath, targetContainer);
    session.touchLive = touchCodeEditorLive;
    installCodeEditorFileSavedListener();
    perf.end({
      success: true,
      modelCount: typeof monaco?.editor?.getModels === "function" ? monaco.editor.getModels().length : undefined,
    });

  });
}
