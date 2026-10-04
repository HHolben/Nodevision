// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/PublishHtmlEditorContext.mjs
// This module implements publish Html Editor Context behavior for the HTMLeditorImpl feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { cloneHtmlBodyForSave } from "../HtmlBodySerialization.mjs";
import { INLINE_EQUATION_BROWSER_SUPPORT_SELECTOR, buildInlineEquationBrowserSupportHeadHtml } from "/Equation/HtmlInlineEquation.mjs";
import { validateGraphicalHtmlSave } from "../HtmlSaveSafety.mjs";
import { createSaveHtmlForPathHandler, createActivateHtmlEditorContextHandler, createCleanupHTMLActiveContextHandler } from "./CreateSaveHtmlForPathHandler.mjs";
import { createHtmlEditorSelection } from "../HtmlEditorSelection.mjs";
import { createHtmlEditorTransactions } from "../HtmlEditorTransactions.mjs";
import { markHtmlEditorDirty, insertNodeAtCaret } from "./EnsureHTMLLayoutStyles.mjs";

// Publish Html Editor Context operations.
export function publishHtmlEditorContext(scope) {
  // Saving function
  if (!scope.htmlSession.isCurrentRender()) {
    scope.htmlSession.wysiwyg.__nvProgrammaticHistory?.dispose();
    scope.htmlSession.wysiwyg.__nvProgrammaticHistory = null;
    return {
      value: void 0
    };
  }
  window.__nvWysiwygActivePath = scope.filePath;
  window.__nvHtmlEditorActivePath = scope.filePath;
  scope.htmlSession.getHtmlForSave = () => {
    if (scope.htmlSession.htmlEditorDisposed || !scope.container.isConnected || !scope.htmlSession.wysiwyg.isConnected) {
      throw new Error("HTML/WYSIWYG editor is no longer active; refusing to save stale editor content.");
    }
    scope.htmlSession.htmlEditorContext.transactions.assertSettled();
    const bodyClone = cloneHtmlBodyForSave(scope.htmlSession.wysiwyg);
    const needsEquationSupport = bodyClone.querySelector(".nv-inline-equation[data-nv-inline-equation]") && !scope.htmlSession.sourceDocument.has(INLINE_EQUATION_BROWSER_SUPPORT_SELECTOR);
    const serialized = scope.htmlSession.sourceDocument.serialize(bodyClone, {
      supportHeadHtml: needsEquationSupport ? buildInlineEquationBrowserSupportHeadHtml() : ""
    });
    const validation = validateGraphicalHtmlSave({
      path: scope.filePath,
      content: serialized,
      originalContent: scope.htmlSession.sourceDocument.originalContent
    });
    if (!validation.ok) throw new Error(validation.error || "Refusing to save unsafe graphical HTML output.");
    return serialized;
  };
  scope.htmlSession.saveHtmlForPath = createSaveHtmlForPathHandler({
    get filePath() {
      return scope.filePath;
    },
    get htmlSession() {
      return scope.htmlSession;
    }
  });
  scope.htmlSession.htmlEditorContext = null;
  scope.htmlSession.htmlEditorDisposed = false;
  scope.htmlSession.setEditorHtmlForPath = null;
  scope.htmlSession.selection = createHtmlEditorSelection(scope.htmlSession.wysiwyg);
  scope.htmlSession.wysiwyg.__nvHtmlSelection = scope.htmlSession.selection;
  scope.htmlSession.transactions = createHtmlEditorTransactions({
    root: scope.htmlSession.wysiwyg,
    selection: scope.htmlSession.selection,
    history: scope.htmlSession.wysiwyg.__nvProgrammaticHistory,
    onCommit: () => markHtmlEditorDirty(scope.htmlSession.wysiwyg, scope.filePath),
    readAuthored: () => cloneHtmlBodyForSave(scope.htmlSession.wysiwyg).innerHTML
  });
  scope.htmlSession.wysiwyg.__nvHtmlTransactions = scope.htmlSession.transactions;
  scope.htmlSession.ownedTools = {
    ...window.HTMLWysiwygTools,
    getEditorElement: () => scope.htmlSession.wysiwyg,
    markDirty: () => markHtmlEditorDirty(scope.htmlSession.wysiwyg, scope.filePath),
    recordProgrammaticChange: before => scope.htmlSession.transactions.record(before),
    insertTextAtSelection: text => scope.htmlSession.transactions.run("Insert text", () => {
      insertNodeAtCaret(scope.htmlSession.wysiwyg, document.createTextNode(String(text ?? "")));
    })
  };
  scope.htmlSession.layersContext = window.HTMLLayersContext;
  scope.htmlSession.activateHtmlEditorContext = createActivateHtmlEditorContextHandler({
    get htmlSession() {
      return scope.htmlSession;
    },
    get container() {
      return scope.container;
    },
    get filePath() {
      return scope.filePath;
    }
  });
  scope.htmlSession.htmlEditorContext = {
    kind: "html",
    saveKind: "html-wysiwyg",
    filePath: scope.filePath,
    selection: scope.htmlSession.selection,
    transactions: scope.htmlSession.transactions,
    styleSources: scope.htmlSession.sourceDocument.styleSources,
    get revision() {
      return scope.htmlSession.transactions.revision;
    },
    get isDirty() {
      return Boolean(scope.htmlSession.wysiwyg.__nvHtmlDirty);
    },
    setInlineStyle(element, property, value, priority = "") {
      if (!scope.htmlSession.wysiwyg.contains(element) || element === scope.htmlSession.wysiwyg) throw new Error("Style target is outside this HTML body.");
      return scope.htmlSession.transactions.run("Inline style", () => {
        if (value === null) element.style.removeProperty(property);else element.style.setProperty(property, String(value), priority);
      });
    },
    getHTML: scope.htmlSession.getHtmlForSave,
    save: scope.htmlSession.saveHtmlForPath,
    getEditorElement: () => scope.htmlSession.wysiwyg,
    editorElement: scope.htmlSession.wysiwyg,
    activate: scope.htmlSession.activateHtmlEditorContext
  };
  scope.container.__nvHtmlEditorContext = scope.htmlSession.htmlEditorContext;
  scope.htmlSession.wysiwyg.__nvHtmlEditorContext = scope.htmlSession.htmlEditorContext;
  scope.htmlSession.htmlEditorCell = scope.container.closest?.(".panel-cell") || null;
  if (scope.htmlSession.htmlEditorCell) scope.htmlSession.htmlEditorCell.__nvHtmlEditorContext = scope.htmlSession.htmlEditorContext;
  scope.htmlSession.wrapper.addEventListener("pointerdown", scope.htmlSession.activateHtmlEditorContext, true);
  scope.htmlSession.wrapper.addEventListener("focusin", scope.htmlSession.activateHtmlEditorContext, true);
  scope.container.__cleanupHTMLActiveContext = createCleanupHTMLActiveContextHandler({
    get htmlSession() {
      return scope.htmlSession;
    },
    get container() {
      return scope.container;
    },
    get filePath() {
      return scope.filePath;
    }
  });
  scope.htmlSession.activateHtmlEditorContext();
  window.NodevisionState.fileIsDirty = false;
}
