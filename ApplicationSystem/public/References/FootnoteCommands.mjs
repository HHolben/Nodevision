// Nodevision/ApplicationSystem/public/References/FootnoteCommands.mjs
// This module supplies footnote commands that edit the owning HTML body through its existing transactions and navigate directly between editable definitions and native reference links.
import { NOTE, ANCHORS, DEFINITIONS, noteAnchors, noteDefinitions, createDefinition, createAnchor, ensureCollection, fragmentTarget } from './ReferenceModel.mjs';
import { referenceAtRange } from './ReferenceChanges.mjs';
export function createFootnoteCommands(root, {getRange, run, report}) {
  const doc = root.ownerDocument;
  let lastAnchor = null;
  function navigate(target) {
    if (!target || !root.contains(target)) return false;
    const range = doc.createRange();
    if (target.matches(ANCHORS)) {
      lastAnchor = target; range.setStartAfter(target.closest('sup') || target); range.collapse(true);
    } else {
      const editable = [...target.children].find(el => !el.hasAttribute('data-nv-note-returns')) || target;
      const walker = doc.createTreeWalker(editable, 4 /* SHOW_TEXT */);
      const text = walker.nextNode();
      if (text) range.setStart(text, 0); else range.selectNodeContents(editable);
      range.collapse(true);
    }
    root.focus({preventScroll:true});
    const selection = doc.getSelection(); selection.removeAllRanges(); selection.addRange(range);
    root.__nvHtmlSelection?.capture();
    target.scrollIntoView({block:'nearest'});
    return true;
  }
  function current() { return referenceAtRange(root, getRange()); }
  function definitionFor(element) {
    return noteDefinitions(root).find(def => def.getAttribute(NOTE) === element?.getAttribute(NOTE));
  }
  function insert() {
    const selected = getRange();
    if (!selected || !root.contains(selected.commonAncestorContainer)) { report('Place the caret in this HTML document first.'); return false; }
    const range = selected.cloneRange(); range.collapse(false);
    const element = range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement;
    if (element.closest(`${DEFINITIONS},[data-nv-notes],script,style,[contenteditable="false"]`) || /^(TABLE|THEAD|TBODY|TFOOT|TR|UL|OL|SELECT)$/.test(element.tagName)) {
      report('Place the caret in ordinary document text, outside footnotes and noneditable objects.'); return false;
    }
    let definition;
    run('Insert footnote', () => {
      definition = createDefinition(doc);
      const {anchor, sup} = createAnchor(doc, definition); lastAnchor = anchor;
      range.insertNode(sup); ensureCollection(root).list.append(definition);
      navigate(definition);
    });
    return definition;
  }
  function remove() {
    const target = current();
    if (!target) { report('Select a footnote reference or place the caret inside a note.'); return false; }
    const definition = definitionFor(target);
    const refs = noteAnchors(root).filter(ref => ref.getAttribute(NOTE) === target.getAttribute(NOTE));
    if (target.matches(DEFINITIONS) && refs.length > 1) { report('This note is shared. Select the particular reference to delete.'); return false; }
    const anchor = target.matches(ANCHORS) ? target : refs[0];
    run('Delete footnote', () => {
      if (anchor) {
        const wrapper = anchor.parentElement;
        const range = doc.createRange(); range.setStartBefore(anchor); range.collapse(true);
        const selection = doc.getSelection(); selection.removeAllRanges(); selection.addRange(range);
        anchor.remove(); if (wrapper.tagName === 'SUP' && !wrapper.childNodes.length) wrapper.remove();
      }
      if (refs.length <= 1) definition?.remove();
    });
    return true;
  }
  function edit() { const target = current(); return navigate(definitionFor(target)); }
  function returnToReference() {
    const target = current(), id = target?.getAttribute(NOTE);
    return navigate(lastAnchor?.isConnected && (!id || lastAnchor.getAttribute(NOTE) === id) ? lastAnchor : noteAnchors(root).find(ref => ref.getAttribute(NOTE) === id));
  }
  function activate(event) {
    if (event.type === 'keydown' && event.key !== 'Enter') return;
    const node = event.target.nodeType === 1 ? event.target : event.target.parentElement;
    const link = node?.closest('a');
    if (!link || !root.contains(link) || !(link.matches(ANCHORS) || link.getAttribute('role') === 'doc-backlink')) return;
    const targetId = fragmentTarget(link);
    const target = [...root.querySelectorAll('[id]')].find(el => el.id === targetId);
    if (!target) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (link.matches(ANCHORS)) lastAnchor = link;
    navigate(target);
  }
  root.addEventListener('click', activate, true); root.addEventListener('keydown', activate, true);
  return {insert, remove, edit, returnToReference, navigate, dispose() {
    root.removeEventListener('click', activate, true); root.removeEventListener('keydown', activate, true);
  }};
}
