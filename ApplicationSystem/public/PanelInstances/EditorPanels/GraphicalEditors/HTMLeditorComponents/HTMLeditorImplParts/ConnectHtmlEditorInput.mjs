// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/ConnectHtmlEditorInput.mjs
// This module implements connect Html Editor Input behavior for the HTMLeditorImpl feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { installHtmlTypingLatencyProbe, recordHtmlTypingOperation } from "../HTMLTypingLatencyDiagnostics.mjs";
import { installHtmlAttentionReporting } from "../HtmlAttentionReporting.mjs";
import { registerTableDividerResizing } from "./StartTableDividerResize.mjs";
import { registerTableDragSelection } from "./GetTableCellAtPoint.mjs";
import { countWords } from "../../FamilyEditorCommon.mjs";
import { setWordCount } from "/StatusBar.mjs";
import { recordEditedFile } from "/RecentFiles.mjs";
import { markHtmlEditorNativeInputDirty, getTableCellFromEditorTarget } from "./MarkHtmlEditorNativeInputDirty.mjs";
import { updateToolbarState } from "../../../../../panels/createToolbar.mjs";
import { setActiveTableCell, clearTableCellSelection } from "/ToolbarCallbacks/insert/tableTools.mjs";
import { createHandleHtmlTableCopyHandler } from "./CreateHtmlPresentationRestoreHandler.mjs";

// Connect Html Editor Input operations.
export function connectHtmlEditorInput(scope) {
  scope.container.__cleanupHTMLTypingDiagnostics = installHtmlTypingLatencyProbe(scope.htmlSession.wysiwyg, {
    filePath: scope.filePath
  });
  window.__nvTableEditorRoot = scope.htmlSession.wysiwyg;
  scope.htmlSession.htmlAttentionCleanup = installHtmlAttentionReporting(scope.filePath, scope.htmlSession.wysiwyg);
  scope.container.__cleanupHTMLTableDividerResizing = registerTableDividerResizing(scope.htmlSession.wysiwyg, scope.filePath);
  scope.container.__cleanupHTMLTableDragSelection = registerTableDragSelection(scope.htmlSession.wysiwyg);

  // Hidden script container
  scope.htmlSession.hidden = document.createElement("div");
  scope.htmlSession.hidden.id = "hidden-elements";
  scope.htmlSession.hidden.style.display = "none";
  scope.htmlSession.wrapper.appendChild(scope.htmlSession.hidden);
  scope.htmlSession.pendingWordCountTimer = 0;
  scope.htmlSession.pendingRecentEditTimer = 0;
  scope.htmlSession.updateWordCount = () => {
    const text = scope.htmlSession.wysiwyg.textContent || "";
    const currentWordCount = countWords(text);
    setWordCount(currentWordCount);
    recordHtmlTypingOperation("word-count", {
      characters: Number(text.length || 0)
    });
  };
  scope.htmlSession.updateWordCountLegacy = () => {
    const text = scope.htmlSession.wysiwyg.innerText || "";
    const currentWordCount = countWords(text);
    setWordCount(currentWordCount);
    recordHtmlTypingOperation("word-count-legacy", {
      characters: Number(text.length || 0)
    });
  };
  scope.htmlSession.scheduleWordCountUpdate = () => {
    if (scope.htmlSession.pendingWordCountTimer) window.clearTimeout(scope.htmlSession.pendingWordCountTimer);
    scope.htmlSession.pendingWordCountTimer = window.setTimeout(() => {
      scope.htmlSession.pendingWordCountTimer = 0;
      scope.htmlSession.updateWordCount();
    }, 160);
  };
  scope.htmlSession.flushRecentHtmlEdit = () => {
    scope.htmlSession.pendingRecentEditTimer = 0;
    recordEditedFile(scope.filePath);
    recordHtmlTypingOperation("recent-file-recorded", {
      filePath: scope.filePath
    });
  };
  scope.htmlSession.scheduleRecentHtmlEdit = () => {
    if (scope.htmlSession.pendingRecentEditTimer) window.clearTimeout(scope.htmlSession.pendingRecentEditTimer);
    scope.htmlSession.pendingRecentEditTimer = window.setTimeout(scope.htmlSession.flushRecentHtmlEdit, 600);
  };
  scope.htmlSession.handleNativeHtmlInput = () => {
    markHtmlEditorNativeInputDirty(scope.filePath, scope.htmlSession.wysiwyg);
    if (window.__nvHtmlTypingLegacyInputWork === true) {
      scope.htmlSession.updateWordCountLegacy();
      recordEditedFile(scope.filePath);
      recordHtmlTypingOperation("recent-file-recorded-legacy", {
        filePath: scope.filePath
      });
      return;
    }
    scope.htmlSession.scheduleWordCountUpdate();
    scope.htmlSession.scheduleRecentHtmlEdit();
  };
  scope.htmlSession.updateWordCount();
  scope.htmlSession.wysiwyg.addEventListener("input", scope.htmlSession.handleNativeHtmlInput);
  scope.htmlSession.findTableCellFromNode = node => getTableCellFromEditorTarget(scope.htmlSession.wysiwyg, node);
  scope.htmlSession.lastPublishedTableToolbarState = null;
  scope.htmlSession.pendingTableToolbarState = null;
  scope.htmlSession.pendingTableToolbarFrame = 0;
  scope.htmlSession.flushTableToolbarState = () => {
    scope.htmlSession.pendingTableToolbarFrame = 0;
    if (window.__nvTableEditorRoot !== scope.htmlSession.wysiwyg) return;
    if (scope.htmlSession.pendingTableToolbarState === scope.htmlSession.lastPublishedTableToolbarState) return;
    scope.htmlSession.lastPublishedTableToolbarState = scope.htmlSession.pendingTableToolbarState;
    updateToolbarState({
      htmlTableSelected: scope.htmlSession.pendingTableToolbarState
    });
  };
  scope.htmlSession.requestTableToolbarState = selected => {
    scope.htmlSession.pendingTableToolbarState = Boolean(selected);
    if (scope.htmlSession.pendingTableToolbarState === scope.htmlSession.lastPublishedTableToolbarState) return;
    if (scope.htmlSession.pendingTableToolbarFrame) return;
    scope.htmlSession.pendingTableToolbarFrame = requestAnimationFrame(scope.htmlSession.flushTableToolbarState);
  };
  scope.htmlSession.publishTableSelection = cell => {
    const activeCell = setActiveTableCell(cell);
    scope.htmlSession.requestTableToolbarState(Boolean(activeCell));
  };
  scope.htmlSession.updateTableSelectionFromSelection = () => {
    if (window.__nvHtmlTableDragSelecting) return;
    const selection = window.getSelection?.();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    if (!range || !scope.htmlSession.wysiwyg.contains(range.commonAncestorContainer)) return;
    clearTableCellSelection({
      keepActive: true
    });
    scope.htmlSession.publishTableSelection(scope.htmlSession.findTableCellFromNode(range.startContainer));
  };
  scope.htmlSession.updateTableSelectionFromEvent = event => {
    if (event.type === "click" && scope.htmlSession.wysiwyg.__nvSuppressNextTableClickSelection) {
      scope.htmlSession.wysiwyg.__nvSuppressNextTableClickSelection = false;
      return;
    }
    const cell = scope.htmlSession.findTableCellFromNode(event.target);
    if (event.type === "click" || !cell) {
      clearTableCellSelection({
        keepActive: Boolean(cell)
      });
    }
    scope.htmlSession.publishTableSelection(cell);
  };
  scope.htmlSession.handleHtmlTableCopy = createHandleHtmlTableCopyHandler({
    get htmlSession() {
      return scope.htmlSession;
    }
  });
}
