// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/MountHtmlEditorShell.mjs
// This module implements mount Html Editor Shell behavior for the HTMLeditorImpl feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { ensureHTMLLayoutStyles } from "./EnsureHTMLLayoutStyles.mjs";
import { updateToolbarState } from "../../../../../panels/createToolbar.mjs";
import { installNodevisionMediaFallbackRuntime } from "/utils/mediaFallbackRuntime.mjs";

import { installEditorHorizontalScroll } from "../../../../../panels/editorHorizontalScroll.mjs";
import { installHtmlEditorZoom } from "../HtmlEditorZoom.mjs";

// Mount Html Editor Shell operations.
export function mountHtmlEditorShell(scope) {
  if (!scope.container) throw new Error("Container required");
  if (typeof scope.container.__cleanupHTMLHotkeys === "function") {
    scope.container.__cleanupHTMLHotkeys();
    scope.container.__cleanupHTMLHotkeys = null;
  }
  if (typeof scope.container.__cleanupHTMLCanvasDeletion === "function") {
    scope.container.__cleanupHTMLCanvasDeletion();
    scope.container.__cleanupHTMLCanvasDeletion = null;
  }
  if (typeof scope.container.__cleanupHTMLImageTools === "function") {
    scope.container.__cleanupHTMLImageTools();
    scope.container.__cleanupHTMLImageTools = null;
  }
  if (typeof scope.container.__cleanupHTMLImageTextTools === "function") {
    scope.container.__cleanupHTMLImageTextTools();
    scope.container.__cleanupHTMLImageTextTools = null;
  }
  if (typeof scope.container.__cleanupHTMLCaretTracking === "function") {
    scope.container.__cleanupHTMLCaretTracking();
    scope.container.__cleanupHTMLCaretTracking = null;
  }
  if (typeof scope.container.__cleanupHTMLTypingDiagnostics === "function") {
    scope.container.__cleanupHTMLTypingDiagnostics();
    scope.container.__cleanupHTMLTypingDiagnostics = null;
  }
  if (typeof scope.container.__cleanupHTMLTextWrapping === "function") {
    scope.container.__cleanupHTMLTextWrapping();
    scope.container.__cleanupHTMLTextWrapping = null;
  }
  if (typeof scope.container.__cleanupHTMLActiveContext === "function") {
    scope.container.__cleanupHTMLActiveContext();
    scope.container.__cleanupHTMLActiveContext = null;
  }
  if (typeof scope.container.__cleanupHTMLAttention === "function") {
    scope.container.__cleanupHTMLAttention();
    scope.container.__cleanupHTMLAttention = null;
  }
  if (typeof scope.container.__cleanupHTMLPoetry === "function") {
    scope.container.__cleanupHTMLPoetry();
    scope.container.__cleanupHTMLPoetry = null;
  }
  if (typeof scope.container.__cleanupHTMLTableToolbar === "function") {
    scope.container.__cleanupHTMLTableToolbar();
    scope.container.__cleanupHTMLTableToolbar = null;
  }
  if (typeof scope.container.__cleanupHTMLTableDividerResizing === "function") {
    scope.container.__cleanupHTMLTableDividerResizing();
    scope.container.__cleanupHTMLTableDividerResizing = null;
  }
  if (typeof scope.container.__cleanupHTMLTableDragSelection === "function") {
    scope.container.__cleanupHTMLTableDragSelection();
    scope.container.__cleanupHTMLTableDragSelection = null;
  }
  if (typeof scope.container.__cleanupHTMLCartoonToolbar === "function") {
    scope.container.__cleanupHTMLCartoonToolbar();
    scope.container.__cleanupHTMLCartoonToolbar = null;
  }
  if (typeof scope.container.__cleanupHTMLCircuits === "function") {
    scope.container.__cleanupHTMLCircuits();
    scope.container.__cleanupHTMLCircuits = null;
  }
  scope.htmlSession.renderToken = Symbol("html-editor:" + scope.filePath);
  scope.container.__nvEditorRenderToken = scope.htmlSession.renderToken;
  scope.container.__nvHtmlZoomCleanup?.();
  scope.container.innerHTML = "";
  ensureHTMLLayoutStyles();

  // Set mode
  scope.htmlSession.editorMode = scope.options?.mode || "HTMLediting";
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.currentMode = scope.htmlSession.editorMode;
  window.NodevisionState.selectedFile = scope.filePath;
  window.NodevisionState.activeEditorFilePath = scope.filePath;
  window.currentActiveFilePath = scope.filePath;
  window.filePath = scope.filePath;
  window.selectedFilePath = scope.filePath;
  window.__nvSvgEditorActivePath = null;
  // Reset any previous layer context before creating a fresh one for this document.
  window.HTMLLayersContext = null;
  updateToolbarState({
    currentMode: scope.htmlSession.editorMode,
    htmlImageSelected: false,
    htmlAudioSelected: false,
    htmlTextSelected: false,
    htmlTextSelectionActive: false,
    htmlImageTextSelected: false,
    htmlImageTextPath: null,
    htmlImagePath: null,
    htmlAudioPath: null,
    htmlCircuitSelected: false,
    htmlCircuitPath: null,
    htmlTableSelected: false,
    htmlCartoonSelected: false,
    htmlCartoonGap: 12
  });

  // Root container
  scope.htmlSession.wrapper = document.createElement("div");
  scope.htmlSession.wrapper.id = "editor-root";
  scope.htmlSession.wrapper.style.display = "flex";
  scope.htmlSession.wrapper.style.flexDirection = "column";
  scope.htmlSession.wrapper.style.height = "100%";
  scope.htmlSession.wrapper.style.minHeight = "0";
  scope.htmlSession.wrapper.style.width = "100%";
  scope.container.appendChild(scope.htmlSession.wrapper);
  scope.htmlSession.isCurrentRender = () => scope.container.__nvEditorRenderToken === scope.htmlSession.renderToken && scope.htmlSession.wrapper.isConnected; // WYSIWYG editable area
  scope.htmlSession.wysiwyg = document.createElement("div");
  scope.htmlSession.wysiwyg.id = "wysiwyg";
  scope.htmlSession.wysiwyg.contentEditable = "true";
  scope.htmlSession.wysiwyg.style.flex = "1 1 0";
  scope.htmlSession.wysiwyg.style.minHeight = "0";
  scope.htmlSession.wysiwyg.style.overflow = "auto";
  scope.htmlSession.wysiwyg.style.padding = "12px";
  scope.htmlSession.wysiwyg.style.overflowWrap = "anywhere";
  scope.htmlSession.wysiwyg.style.wordBreak = "break-word";
  scope.htmlSession.wrapper.appendChild(scope.htmlSession.wysiwyg);
  const presentation = document.createElement("div");
  presentation.style.cssText = "flex:1;min-height:0;overflow:auto;scrollbar-gutter:stable";
  scope.htmlSession.wysiwyg.replaceWith(presentation);
  presentation.append(scope.htmlSession.wysiwyg);
  const releaseZoom = installHtmlEditorZoom(scope.htmlSession.wrapper, presentation, scope.htmlSession.wysiwyg);
  const releaseScroll = installEditorHorizontalScroll(scope.htmlSession.wrapper);
  scope.container.__nvHtmlZoomCleanup = () => { releaseScroll(); releaseZoom(); };
  installNodevisionMediaFallbackRuntime(scope.htmlSession.wysiwyg);
}
