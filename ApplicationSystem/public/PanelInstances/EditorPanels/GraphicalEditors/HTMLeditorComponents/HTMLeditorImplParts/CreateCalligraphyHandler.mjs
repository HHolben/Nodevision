// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/CreateCalligraphyHandler.mjs
// This module binds calligraphy conversion to the owning graphical editor and records the conversion as a single document history operation.
import { prepareCalligraphy } from '../HtmlCalligraphy.mjs';
import { getCurrentSelectionRangeInEditor, getRememberedSelectionRange, rememberCurrentSelectionRange, markHtmlEditorDirty } from './EnsureHTMLLayoutStyles.mjs';
import { markSelectedImageText, updateSelectedImageTextState, buildImageTextContextFromElement } from './UpdateSelectedImageState.mjs';
import { setStatus } from '/StatusBar.mjs';
export function createCalligraphyHandler(wysiwyg, editorFilePath, history) {
  return async () => {
    try {
      const range = getCurrentSelectionRangeInEditor(wysiwyg) || getRememberedSelectionRange(wysiwyg);
      const prepared = await prepareCalligraphy(wysiwyg, range);
      if (window.__nvActiveHtmlEditorContext?.editorElement && window.__nvActiveHtmlEditorContext.editorElement !== wysiwyg) throw Error('The active document changed. Select the text and retry.');
      const before = wysiwyg.innerHTML;
      const letters = prepared.apply();
      if (!letters.length) return false;
      history.record(before);
      markHtmlEditorDirty(wysiwyg, editorFilePath);
      const last = letters.at(-1);
      const caret = document.createRange(); caret.setStartAfter(last); caret.collapse(true);
      const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(caret);
      rememberCurrentSelectionRange(wysiwyg);
      markSelectedImageText(wysiwyg, last);
      updateSelectedImageTextState(buildImageTextContextFromElement(last, editorFilePath), {clearHtmlImageSelection:true,htmlTextSelectionActive:false});
      const message = prepared.warnings.length ? prepared.warnings.join('\n') : 'Created editable SVG outlines. Separate letters do not retain cross-letter kerning or ligatures.';
      setStatus('Calligraphy Letter', message);
      if (prepared.warnings.length) alert(message);
      return true;
    } catch (error) {
      setStatus('Calligraphy Letter', error.message); alert(error.message); return false;
    }
  };
}
