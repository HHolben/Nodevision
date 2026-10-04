// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/CreateSaveHtmlForPathHandler.mjs
// This module implements create Save Html For Path Handler behavior for the HTMLeditorImpl feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { resolveEditorHookSavePath, isSvgEditorSavePath } from "./IsSvgEditorSavePath.mjs";
import { updateToolbarState } from "../../../../../panels/createToolbar.mjs";
import { activateHtmlPropertiesContext, removeHtmlPropertiesContext } from "/PanelInstances/Common/HtmlProperties/HtmlPropertiesContexts.mjs";

// Create Save Html For Path Handler operations.
export function createSaveHtmlForPathHandler(owner) {
  return async path => {
    const targetPath = resolveEditorHookSavePath("HTML/WYSIWYG Editor", owner.filePath, path);
    if (isSvgEditorSavePath(targetPath)) {
      throw new Error("HTML/WYSIWYG Editor cannot save HTML content into SVG files.");
    }
    const content = owner.htmlSession.getHtmlForSave();
    const savedRevision = owner.htmlSession.htmlEditorContext.revision;
    const response = await fetch("/api/save", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        path: targetPath,
        sourcePath: owner.filePath,
        content,
        editorKind: "html-wysiwyg"
      })
    });
    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }
    if (!response.ok || !data?.success) {
      const detail = data?.error || response.statusText || `HTTP ${response.status}`;
      throw new Error(detail);
    }
    if (owner.htmlSession.htmlEditorDisposed || savedRevision !== owner.htmlSession.htmlEditorContext.revision) return;
    owner.htmlSession.wysiwyg.__nvHtmlDirty = false;
    if (window.__nvActiveHtmlEditorContext === owner.htmlSession.htmlEditorContext) {
      window.NodevisionState.fileIsDirty = false;
      updateToolbarState({
        fileIsDirty: false
      });
    }
    console.log("Saved WYSIWYG file:", targetPath);
  };
}

export function createActivateHtmlEditorContextHandler(owner) {
  return () => {
    if (owner.htmlSession.htmlEditorDisposed || !owner.htmlSession.isCurrentRender() || !owner.container.isConnected || !owner.htmlSession.wysiwyg.isConnected) return false;
    if (window.__nvActiveHtmlEditorContext !== owner.htmlSession.htmlEditorContext) window.__nvActiveHtmlEditorContext?.editorElement?.__nvProgrammaticHistory?.flush?.();
    const alreadyActive = window.__nvActiveHtmlEditorContext === owner.htmlSession.htmlEditorContext && window.NodevisionState?.currentMode === owner.htmlSession.editorMode;
    window.NodevisionState = window.NodevisionState || {};
    window.NodevisionState.fileIsDirty = Boolean(owner.htmlSession.wysiwyg.__nvHtmlDirty);
    window.NodevisionState.currentMode = owner.htmlSession.editorMode;
    window.NodevisionState.selectedFile = owner.filePath;
    window.NodevisionState.activeEditorFilePath = owner.filePath;
    window.currentActiveFilePath = owner.filePath;
    window.filePath = owner.filePath;
    window.selectedFilePath = owner.filePath;
    window.__nvWysiwygActivePath = owner.filePath;
    window.__nvHtmlEditorActivePath = owner.filePath;
    window.__nvActiveHtmlEditorContext = owner.htmlSession.htmlEditorContext;
    const owningCell = owner.container.closest?.(".panel-cell");
    if (owningCell) owningCell.__nvHtmlEditorContext = owner.htmlSession.htmlEditorContext;
    window.__nvTableEditorRoot = owner.htmlSession.wysiwyg;
    window.HTMLWysiwygTools = owner.htmlSession.ownedTools;
    window.HTMLLayersContext = owner.htmlSession.layersContext;
    if (owner.htmlSession.setEditorHtmlForPath) window.setEditorHTML = owner.htmlSession.setEditorHtmlForPath;
    window.getEditorHTML = owner.htmlSession.getHtmlForSave;
    window.saveWYSIWYGFile = owner.htmlSession.saveHtmlForPath;
    activateHtmlPropertiesContext(owner.htmlSession.htmlEditorContext);
    if (!alreadyActive) updateToolbarState({
      currentMode: owner.htmlSession.editorMode,
      selectedFile: owner.filePath,
      activeEditorFilePath: owner.filePath
    });
    return true;
  };
}

export function createCleanupHTMLActiveContextHandler(owner) {
  return () => {
    owner.htmlSession.htmlEditorDisposed = true;
    removeHtmlPropertiesContext(owner.htmlSession.htmlEditorContext);
    owner.htmlSession.transactions.dispose();
    owner.htmlSession.sourceDocument.provenance.dispose();
    owner.htmlSession.selection.dispose();
    if (window.HTMLLayersContext === owner.htmlSession.layersContext) window.HTMLLayersContext = null;
    owner.htmlSession.wysiwyg.__nvHtmlTransactions = null;
    owner.htmlSession.wysiwyg.__nvHtmlSelection = null;
    owner.htmlSession.wysiwyg.__nvHtmlEditorContext = null;
    owner.htmlSession.wrapper.removeEventListener("pointerdown", owner.htmlSession.activateHtmlEditorContext, true);
    owner.htmlSession.wrapper.removeEventListener("focusin", owner.htmlSession.activateHtmlEditorContext, true);
    const ownsGlobalHooks = window.__nvActiveHtmlEditorContext === owner.htmlSession.htmlEditorContext || window.getEditorHTML === owner.htmlSession.getHtmlForSave || window.saveWYSIWYGFile === owner.htmlSession.saveHtmlForPath || window.setEditorHTML === owner.htmlSession.setEditorHtmlForPath;
    if (owner.container.__nvHtmlEditorContext === owner.htmlSession.htmlEditorContext) owner.container.__nvHtmlEditorContext = null;
    if (owner.htmlSession.htmlEditorCell?.__nvHtmlEditorContext === owner.htmlSession.htmlEditorContext) owner.htmlSession.htmlEditorCell.__nvHtmlEditorContext = null;
    const currentCell = owner.container.closest?.(".panel-cell");
    if (currentCell?.__nvHtmlEditorContext === owner.htmlSession.htmlEditorContext) currentCell.__nvHtmlEditorContext = null;
    if (window.__nvActiveHtmlEditorContext === owner.htmlSession.htmlEditorContext) window.__nvActiveHtmlEditorContext = null;
    if (window.getEditorHTML === owner.htmlSession.getHtmlForSave) window.getEditorHTML = undefined;
    if (window.saveWYSIWYGFile === owner.htmlSession.saveHtmlForPath) window.saveWYSIWYGFile = undefined;
    if (window.setEditorHTML === owner.htmlSession.setEditorHtmlForPath) window.setEditorHTML = undefined;
    if (ownsGlobalHooks && window.__nvWysiwygActivePath === owner.filePath) window.__nvWysiwygActivePath = null;
    if (ownsGlobalHooks && window.__nvHtmlEditorActivePath === owner.filePath) window.__nvHtmlEditorActivePath = null;
    if (window.NodevisionMetadataTools?.owner === owner.htmlSession.wysiwyg) window.NodevisionMetadataTools = null;
    try {
      if (window.HTMLWysiwygTools?.getEditorElement?.() === owner.htmlSession.wysiwyg) window.HTMLWysiwygTools = {};
    } catch {
      window.HTMLWysiwygTools = {};
    }
  };
}
