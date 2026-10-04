// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlAttentionReporting.mjs
// This module reports the owning HTML editor's semantic selection and persists scroll context while suppressing equivalent attention publications during repeated keyboard input.
import { getSnapshot, setEditorContext, setSelectionContext, getEditingContext, saveEditingContext, clearEditorContext } from '/EditorAttentionState.mjs';
import { findCircuitReferenceElement } from '../CircuitEditorComponents/CircuitReferenceElement.mjs';

function describeHtmlAttentionSelection(target) {
  const element = target?.nodeType === Node.TEXT_NODE ? target.parentElement : target;
  if (!element || element === document.body) {
    return { selectedObjectType: null, selectedObjectId: null, hasEditableSelection: false };
  }
  const poem = element.closest?.(".poem, [data-poetry], .poetry-block, .line-numbered-poetry");
  if (poem) {
    if (element.closest?.(".poem-line, [data-poem-line], .poetry-line")) return { selectedObjectType: "poem-line", selectedObjectLabel: "Poetry Line", selectedObjectId: element.id || null, hasEditableSelection: true };
    if (element.closest?.(".poem-stanza, [data-poem-stanza], .stanza")) return { selectedObjectType: "poem-stanza", selectedObjectLabel: "Poetry Stanza", selectedObjectId: element.id || null, hasEditableSelection: true };
    return { selectedObjectType: "poem", selectedObjectLabel: "Poetry Element", selectedObjectId: poem.id || null, hasEditableSelection: true };
  }
  if (element.closest?.("td, th")) return { selectedObjectType: "table-cell", selectedObjectLabel: "Table Cell", selectedObjectId: element.id || null, hasEditableSelection: true };
  if (element.closest?.("tr")) return { selectedObjectType: "table-row", selectedObjectLabel: "Table Row", selectedObjectId: element.id || null, hasEditableSelection: true };
  if (element.closest?.("table")) return { selectedObjectType: "table", selectedObjectLabel: "Table", selectedObjectId: element.id || null, hasEditableSelection: true };
  const circuit = findCircuitReferenceElement(element);
  if (circuit) return { selectedObjectType: "circuit", selectedObjectLabel: "Circuit", selectedObjectId: circuit.id || null, hasEditableSelection: true };
  if (element.closest?.("img")) return { selectedObjectType: "image", selectedObjectLabel: "Image", selectedObjectId: element.id || null, hasEditableSelection: true };
  if (element.closest?.("audio")) return { selectedObjectType: "audio", selectedObjectLabel: "Audio", selectedObjectId: element.id || null, hasEditableSelection: true };
  return { selectedObjectType: element.tagName?.toLowerCase?.() || "html-element", selectedObjectLabel: element.tagName || "HTML Element", selectedObjectId: element.id || null, hasEditableSelection: true };
}

export function installHtmlAttentionReporting(filePath, root) {
  setEditorContext({ filePath, fileFamily: "html", fileFamilyLabel: "HTML", editorMode: "HTMLediting", editorModeLabel: "HTML Editing", activeTool: "selection", activeToolLabel: "Selection Tool" });
  const saved = getEditingContext(filePath);
  requestAnimationFrame(() => {
    if (saved?.scroll && root) {
      root.scrollTop = saved.scroll.top || 0;
      root.scrollLeft = saved.scroll.left || 0;
    }
  });
  const persistScroll = () => saveEditingContext(filePath, { editorMode: "HTMLediting", activeTool: "selection", scroll: { top: root?.scrollTop || 0, left: root?.scrollLeft || 0 } });
  const report = event => {
    if (window.__nvActiveHtmlEditorContext?.editorElement !== root) return;
    const anchor = root.ownerDocument.getSelection()?.anchorNode;
    const target = ['input', 'keyup'].includes(event.type) && root.contains(anchor) ? anchor : event.target;
    const next = describeHtmlAttentionSelection(target);
    const current = getSnapshot();
    if (current.filePath !== filePath) setEditorContext({ filePath, fileFamily: 'html', editorMode: 'HTMLediting' });
    if (current.filePath !== filePath || Object.keys(next).some(key => next[key] !== current[key])) setSelectionContext(next);
  };
  root?.addEventListener("input", report);
  root?.addEventListener("click", report, true);
  root?.addEventListener("keyup", report, true);
  root?.addEventListener("mouseup", report, true);
  root?.addEventListener("scroll", persistScroll, { passive: true });
  return () => {
    root?.removeEventListener("input", report);
    root?.removeEventListener("click", report, true);
    root?.removeEventListener("keyup", report, true);
    root?.removeEventListener("mouseup", report, true);
    root?.removeEventListener("scroll", persistScroll);
    persistScroll();
    clearEditorContext(filePath);
  };
}
