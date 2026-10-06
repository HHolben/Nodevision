// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/CodeEditorParts/IsCodeEditorActive.mjs
// This module implements is code editor active operations for CodeEditor, preserving the existing document and instance ownership contracts.

import saveCurrentFile from "/ToolbarCallbacks/file/saveFile.mjs";
import { ensureUnsavedPrompt, markEditorClean } from "./ShowCommonVarOverlay.mjs";
import { openCodeEditor } from "./OpenCodeEditor.mjs";
import { activateCodeEditorHost, codeEditorSessionFromHost } from "./SetPreviewOutput.mjs";
import { setEditorContext, setSelectionContext, getEditingContext, saveEditingContext } from "../../../EditorAttentionState.mjs";

export function isCodeEditorActive() {
  const activeCell = window.activeCell?.closest?.(".panel-cell") || window.activeCell;
  const activeTabState = activeCell?.__nvPanelTabs || null;
  const activeTab = activeTabState?.tabs?.find?.((tab) => tab.tabId === activeTabState.activeTabId) || null;
  const panelNames = [
    activeTab?.panelType,
    activeCell?.dataset?.id,
    activeCell?.dataset?.panelId,
    window.activePanel,
  ].map((value) => String(value || "").toLowerCase());
  if (panelNames.some((value) => value === "codeeditor" || value === "codeeditorpanel")) return true;

  const editorDom = window.monacoEditor?.getDomNode?.();
  return Boolean(editorDom && activeCell?.contains?.(editorDom) && window.NodevisionState?.currentMode === "CodeEditing");
}

export function guardFileSwitch(nextPath, proceed) {
  if (!isCodeEditorActive()) {
    proceed();
    return;
  }
  if (!window.__nvCodeEditorDirty) {
    proceed();
    return;
  }

  const prompt = ensureUnsavedPrompt();
  prompt._setMessage(`Save changes to ${window.__nvCodeEditorActivePath || "current file"}?`);
  prompt._setHandlers({
    onCancel: () => prompt._hide(),
    onDiscard: () => {
      prompt._hide();
      proceed();
    },
    onSave: async () => {
      try {
        await saveCurrentFile({ path: window.__nvCodeEditorActivePath });
        markEditorClean();
        prompt._hide();
        proceed();
      } catch (err) {
        alert(`Save failed: ${err?.message || err}`);
      }
    },
  });
  prompt._show();
}

export async function setupPanel(panelElem, panelVars = {}) {
  console.log("[CodeEditor] setupPanel() invoked from panelManager.");

  // Determine file to open (if passed)
  const filePath = panelVars.filePath || panelVars.path || window.selectedFilePath || null;

  // Treat this panelElem as the active cell
  window.activeCell = panelElem;

  // Now reuse your existing logic
  await openCodeEditor(filePath || "Untitled", { targetElement: panelElem, bypassTabs: true });
  return {
    activate: () => activateCodeEditorHost(panelElem),
    deactivate: () => {
      const session = codeEditorSessionFromHost(panelElem);
      if (session?.editor) persistCodeEditorAttention(session.filePath, session.editor);
      const cleanup = session?.editorContainer?.__nvCodeEditorLiveCleanup;
      if (typeof cleanup === "function") cleanup();
    },
    destroy: panelElem.cleanup,
  };
}

export function reportCodeEditorAttention(filePath, editor = null, options = {}) {
  setEditorContext({
    filePath,
    fileFamily: filePath?.split(".").pop()?.toLowerCase() || "code",
    fileFamilyLabel: "Code",
    editorMode: "code",
    editorModeLabel: "Code Editing",
    activeTool: "text-cursor",
    activeToolLabel: "Text Cursor",
  });
  setSelectionContext({ selectedObjectType: null, selectedObjectId: null, hasEditableSelection: false });
  const saved = getEditingContext(filePath);
  if (editor && saved && options.restore === true) {
    try {
      if (saved.selection && typeof editor.setSelection === "function") editor.setSelection(saved.selection);
      else if (saved.cursorPosition && typeof editor.setPosition === "function") editor.setPosition(saved.cursorPosition);
      if (saved.scroll && typeof editor.setScrollTop === "function") {
        editor.setScrollTop(saved.scroll.top || 0);
        if (typeof editor.setScrollLeft === "function") editor.setScrollLeft(saved.scroll.left || 0);
      }
    } catch (error) {
      console.warn("Unable to restore code editor context", error);
    }
  }
}

export function persistCodeEditorAttention(filePath, editor) {
  if (!filePath || !editor) return;
  try {
    saveEditingContext(filePath, {
      editorMode: "code",
      activeTool: "text-cursor",
      cursorPosition: typeof editor.getPosition === "function" ? editor.getPosition() : null,
      selection: typeof editor.getSelection === "function" ? editor.getSelection() : null,
      scroll: {
        top: typeof editor.getScrollTop === "function" ? editor.getScrollTop() : 0,
        left: typeof editor.getScrollLeft === "function" ? editor.getScrollLeft() : 0,
      },
    });
  } catch (error) {
    console.warn("Unable to persist code editor context", error);
  }
}
