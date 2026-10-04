// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/LoadHtmlEditorDocument.mjs
// This module implements load Html Editor Document behavior for the HTMLeditorImpl feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { encodeNotebookUrl } from "./IsVirtualEditorPath.mjs";
import { createHtmlSourceDocument } from "../HtmlSourceDocument.mjs";
import { applyInitialDocumentBodyBackground, applyDocumentBackgroundToWysiwyg, readDocumentBackgroundFromWysiwyg } from "./UpdateStoredDocumentBackgroundStyle.mjs";
import { renderInlineEquationsForEditor } from "./RegisterHTMLFallbackHotkeys.mjs";
import { syncEditorImageTextPresentation } from "./UpdateSelectedImageState.mjs";
import { rememberCurrentSelectionRange, getRememberedSelectionRange, applySelectionRange, markHtmlEditorDirty, insertNodeAtCaret, getCurrentSelectionRangeInEditor } from "./EnsureHTMLLayoutStyles.mjs";
import { applyFontFamilyToWysiwygSelection, removeFontFamilyFromWysiwygSelection } from "./ApplyFontStackToFragment.mjs";
import { applyFontReferenceToWysiwygSelection, removeTextStylesFromWysiwygSelection, readTextStyleSelection, collectDocumentFonts } from "./RemoveTextStylesFromWysiwygSelection.mjs";
import { selectTextStyleTargetForCurrentSelection, applyTextStylesToWysiwygSelection } from "./ApplyTextStylesInFragment.mjs";
import { readHtmlDocumentMetadata, applyHtmlDocumentMetadata } from "./MarkHtmlEditorNativeInputDirty.mjs";

// Load Html Editor Document operations.
export async function loadHtmlEditorDocument(scope) {
  scope.htmlSession.notebookUrl = encodeNotebookUrl(scope.filePath);
  scope.htmlSession.res = await fetch(scope.htmlSession.notebookUrl, {
    cache: 'no-cache'
  });
  if (!scope.htmlSession.res.ok) throw new Error(scope.htmlSession.res.statusText);
  scope.htmlSession.htmlText = await scope.htmlSession.res.text();
  if (!scope.htmlSession.isCurrentRender()) {
    scope.htmlSession.wysiwyg.__nvProgrammaticHistory?.dispose();
    scope.htmlSession.wysiwyg.__nvProgrammaticHistory = null;
    return {
      value: void 0
    };
  }
  scope.htmlSession.headClone = document.createElement("div");
  scope.htmlSession.sourceDocument = createHtmlSourceDocument({
    head: scope.htmlSession.headClone,
    body: scope.htmlSession.wysiwyg,
    hidden: scope.htmlSession.hidden
  });
  scope.htmlSession.doc = scope.htmlSession.sourceDocument.load(scope.htmlSession.htmlText);
  scope.htmlSession.wrapper.prepend(scope.htmlSession.headClone);
  applyInitialDocumentBodyBackground(scope.htmlSession.wysiwyg, scope.htmlSession.doc.body);
  window.NodevisionPoetry?.normalizeAllPoemBlocks?.(scope.htmlSession.wysiwyg);
  renderInlineEquationsForEditor(scope.htmlSession.wysiwyg);
  syncEditorImageTextPresentation(scope.htmlSession.wysiwyg, scope.filePath);
  scope.htmlSession.updateWordCount();
  window.HTMLWysiwygTools = Object.assign(window.HTMLWysiwygTools || {}, {
    getEditorElement: () => scope.htmlSession.wysiwyg,
    saveCurrentSelection: () => {
      rememberCurrentSelectionRange(scope.htmlSession.wysiwyg);
      return true;
    },
    restoreSavedSelection: () => {
      const range = getRememberedSelectionRange(scope.htmlSession.wysiwyg);
      if (!range) return false;
      applySelectionRange(range);
      scope.htmlSession.wysiwyg.focus();
      return true;
    },
    appendScriptForSave: (scriptText, key = "") => {
      const script = String(scriptText || "");
      if (!script.trim()) return false;
      const scriptKey = String(key || "").trim();
      const existing = scriptKey ? Array.from(scope.htmlSession.hidden.children).find(el => el.dataset.scriptKey === scriptKey || String(el.dataset.script || "").includes(scriptKey)) : null;
      const target = existing || document.createElement("div");
      target.dataset.script = script;
      if (scriptKey) target.dataset.scriptKey = scriptKey;
      if (!existing) scope.htmlSession.hidden.appendChild(target);
      markHtmlEditorDirty(scope.htmlSession.wysiwyg, scope.filePath);
      return true;
    },
    insertTextAtSelection: text => {
      const beforeHtml = scope.htmlSession.wysiwyg.innerHTML;
      const node = document.createTextNode(String(text ?? ""));
      insertNodeAtCaret(scope.htmlSession.wysiwyg, node, {
        preferredRange: getCurrentSelectionRangeInEditor(scope.htmlSession.wysiwyg) || getRememberedSelectionRange(scope.htmlSession.wysiwyg)
      });
      scope.htmlSession.wysiwyg.__nvProgrammaticHistory?.record?.(beforeHtml);
      markHtmlEditorDirty(scope.htmlSession.wysiwyg, scope.filePath);
      return true;
    },
    applyFontFamilyToSelection: (fontFamilyOrStack, fallback = "") => {
      applyFontFamilyToWysiwygSelection(scope.htmlSession.wysiwyg, fontFamilyOrStack, fallback);
    },
    removeFontFamilyFromSelection: () => {
      removeFontFamilyFromWysiwygSelection(scope.htmlSession.wysiwyg);
    },
    applyFontReferenceToSelection: ref => applyFontReferenceToWysiwygSelection({
      wysiwyg: scope.htmlSession.wysiwyg,
      headContainer: scope.htmlSession.headClone,
      filePath: scope.filePath,
      ref
    }),
    selectTextStyleTarget: () => selectTextStyleTargetForCurrentSelection(scope.htmlSession.wysiwyg),
    applyTextStylesToSelection: styles => {
      applyTextStylesToWysiwygSelection(scope.htmlSession.wysiwyg, styles);
      markHtmlEditorDirty(scope.htmlSession.wysiwyg, scope.filePath);
    },
    removeTextStylesFromSelection: () => {
      removeTextStylesFromWysiwygSelection(scope.htmlSession.wysiwyg);
      markHtmlEditorDirty(scope.htmlSession.wysiwyg, scope.filePath);
    },
    readTextStyleSelection: () => readTextStyleSelection(scope.htmlSession.wysiwyg),
    getDocumentFonts: () => collectDocumentFonts(scope.htmlSession.headClone, scope.htmlSession.wysiwyg),
    applyDocumentBackground: options => applyDocumentBackgroundToWysiwyg(scope.htmlSession.wysiwyg, options),
    readDocumentBackground: () => readDocumentBackgroundFromWysiwyg(scope.htmlSession.wysiwyg),
    markDirty: () => markHtmlEditorDirty(scope.htmlSession.wysiwyg, scope.filePath),
    readDocumentMetadata: () => readHtmlDocumentMetadata(scope.htmlSession.headClone),
    applyDocumentMetadata: patch => {
      const metadata = applyHtmlDocumentMetadata(scope.htmlSession.headClone, patch);
      markHtmlEditorDirty(scope.htmlSession.wysiwyg, scope.filePath);
      return metadata;
    }
  });
  window.NodevisionMetadataTools = {
    owner: scope.htmlSession.wysiwyg,
    formatLabel: scope.htmlSession.editorMode === "EPUBediting" ? "EPUB chapter" : "HTML document",
    fields: ["title", "description", "author", "tags"],
    readMetadata: () => ({
      ...readHtmlDocumentMetadata(scope.htmlSession.headClone),
      formatLabel: scope.htmlSession.editorMode === "EPUBediting" ? "EPUB chapter" : "HTML document"
    }),
    applyMetadata: patch => {
      const metadata = applyHtmlDocumentMetadata(scope.htmlSession.headClone, patch);
      markHtmlEditorDirty(scope.htmlSession.wysiwyg, scope.filePath);
      return {
        ...metadata,
        formatLabel: scope.htmlSession.editorMode === "EPUBediting" ? "EPUB chapter" : "HTML document"
      };
    }
  };
  scope.htmlSession.updateWordCount();

  // Saving function
}
