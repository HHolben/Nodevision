// Nodevision/ApplicationSystem/public/References/ReconcileFootnotes.mjs
// This module repairs and presents footnotes as standalone HTML while preserving rich definition content, stable identities, shared references, and recoverable inconsistencies.
import { MISSING_NOTE_TEXT, NOTE, KIND, REF, identity, setAttribute, fragmentTarget, noteDefinitions, noteAnchors, createDefinition, ensureCollection } from './ReferenceModel.mjs';

function uniqueHtmlId(element, prefix, occupied) {
  const old = element.id;
  if (!old || /\s/.test(old) || occupied.get(old) !== element) {
    let id; do { id = identity(prefix); } while (occupied.has(id));
    element.id = id; occupied.set(id, element);
  }
}
function syncReturns(root, definition, anchors, number) {
  let returns = definition.querySelector(':scope > [data-nv-note-returns]');
  if (!returns) {
    // Only remove recognized backlink chrome; retain unrelated hyperlinks and rich note content.
    const targets = new Set(anchors.flatMap(a => [a.id, a.parentElement?.id].filter(Boolean)));
    definition.querySelectorAll('a[href^="#"]').forEach(link => {
      if (link.getAttribute('role') === 'doc-backlink' || targets.has(fragmentTarget(link))) link.remove();
    });
    returns = root.ownerDocument.createElement('span'); returns.setAttribute('data-nv-note-returns', '');
    definition.append(returns);
  }
  setAttribute(returns, 'contenteditable', 'false');
  const existing = [...returns.querySelectorAll('a')];
  if (existing.length === anchors.length && existing.every((a,i) => fragmentTarget(a) === anchors[i].id && a.getAttribute('aria-label') === `Return to footnote ${number} reference ${i+1}`)) return;
  returns.replaceChildren();
  for (const [index, anchor] of anchors.entries()) {
    const link = root.ownerDocument.createElement('a'); link.href = `#${anchor.id}`;
    link.setAttribute('role', 'doc-backlink'); link.setAttribute('aria-label', `Return to footnote ${number} reference ${index+1}`);
    link.textContent = anchors.length === 1 ? '↩' : `↩${index+1}`;
    returns.append(root.ownerDocument.createTextNode(' '), link);
  }
}
export function reconcileFootnotes(root) {
  const diagnostics = [];
  const definitions = noteDefinitions(root), anchors = noteAnchors(root);
  if (!definitions.length && !anchors.length) {
    root.querySelectorAll('section[data-nv-notes="footnote"]').forEach(section => {
      if ([...section.children].every(el => (el.tagName === 'H2' && el.textContent === 'Footnotes') || (el.tagName === 'OL' && !el.childNodes.length))) section.remove();
    });
    return {diagnostics, count:0};
  }
  const {section, list} = ensureCollection(root);
  const occupied = new Map();
  root.querySelectorAll('[id]').forEach(element => { if (!occupied.has(element.id)) occupied.set(element.id,element); });
  const byNote = new Map(), byTarget = new Map(), duplicateNotes = new Set();
  for (const definition of definitions) {
    const oldTarget = definition.id;
    if (oldTarget && !byTarget.has(oldTarget)) byTarget.set(oldTarget, definition);
    let noteId = definition.getAttribute(NOTE) || identity();
    if (byNote.has(noteId)) {
      duplicateNotes.add(noteId);
      diagnostics.push('Duplicate note definitions were retained with separate identities; check their references.');
      noteId = identity();
    }
    setAttribute(definition, NOTE, noteId); setAttribute(definition, KIND, 'footnote');
    setAttribute(definition, 'role', 'doc-footnote'); setAttribute(definition, 'tabindex', '-1');
    byNote.set(noteId, definition); uniqueHtmlId(definition, 'fn', occupied);
    if (oldTarget && oldTarget !== definition.id) diagnostics.push('A conflicting footnote HTML target ID was repaired.');
  }
  const groups = new Map();
  for (const anchor of anchors) {
    const target = byTarget.get(fragmentTarget(anchor));
    let definition = (duplicateNotes.has(anchor.getAttribute(NOTE)) && target) || byNote.get(anchor.getAttribute(NOTE)) || target;
    if (!definition) {
      const requested = anchor.getAttribute(NOTE) || identity();
      definition = createDefinition(root.ownerDocument, requested);
      definition.firstChild.textContent = MISSING_NOTE_TEXT;
      definition.setAttribute('data-nv-note-missing', 'true'); list.append(definition); definitions.push(definition);
      byNote.set(requested, definition); byTarget.set(fragmentTarget(anchor), definition);
      uniqueHtmlId(definition, 'fn', occupied);
    }
    uniqueHtmlId(anchor, 'fnref', occupied);
    if (anchor.parentElement?.tagName === 'SUP' && anchor.parentElement.id) uniqueHtmlId(anchor.parentElement, 'fnref-wrapper', occupied);
    setAttribute(anchor, REF, 'footnote'); setAttribute(anchor, NOTE, definition.getAttribute(NOTE));
    setAttribute(anchor, 'role', 'doc-noteref'); setAttribute(anchor, 'href', `#${definition.id}`);
    // Number labels are atomic in the editor, but native hyperlinks in standalone HTML.
    setAttribute(anchor, 'contenteditable', 'false');
    if (!groups.has(definition)) groups.set(definition, []);
    groups.get(definition).push(anchor);
  }
  let number = 0;
  let cursor = list.firstElementChild;
  for (const [definition, refs] of groups) {
    number++;
    for (const ref of refs) {
      if (ref.textContent !== String(number)) ref.textContent = String(number);
      setAttribute(ref, 'aria-label', `Footnote ${number}`);
    }
    setAttribute(definition, 'value', number); setAttribute(definition, 'aria-label', `Footnote ${number}`);
    setAttribute(definition, 'tabindex', '-1');
    if (definition !== cursor) list.insertBefore(definition, cursor); else cursor = cursor.nextElementSibling;
    syncReturns(root, definition, refs, number);
    const bodyText = [...definition.childNodes].filter(node => !node.hasAttribute?.('data-nv-note-returns')).map(node => node.textContent).join('').trim();
    if (bodyText && bodyText !== MISSING_NOTE_TEXT) definition.removeAttribute('data-nv-note-missing');
    if (definition.hasAttribute('data-nv-note-missing')) diagnostics.push(`Footnote ${number} was missing its definition; its placeholder is editable.`);
  }
  const orphans = definitions.filter(definition => !groups.has(definition));
  let recovery = section.querySelector(':scope > [data-nv-note-orphans]');
  if (orphans.length) {
    if (!recovery) {
      recovery = root.ownerDocument.createElement('section'); recovery.setAttribute('data-nv-note-orphans', 'footnote');
      const heading = root.ownerDocument.createElement('h3'); heading.textContent = 'Unreferenced footnotes (retained)';
      recovery.append(heading, root.ownerDocument.createElement('ul')); section.append(recovery);
    }
    const recoveryList = recovery.querySelector('ul');
    for (const definition of orphans) {
      if (definition.parentNode !== recoveryList) recoveryList.append(definition);
      definition.removeAttribute('value'); setAttribute(definition, 'aria-label', 'Unreferenced footnote');
      syncReturns(root, definition, [], 'unreferenced');
    }
    diagnostics.push(`${orphans.length} unreferenced footnote definition(s) retained for recovery.`);
  } else if (recovery && !recovery.querySelector('li')) recovery.remove();
  // Consolidate managed lists, but never remove arbitrary imported section contents.
  root.querySelectorAll('section[data-nv-notes="footnote"]').forEach(other => {
    if (other !== section && !other.querySelector('li') && [...other.children].every(el => ['H2','OL'].includes(el.tagName) && (el.tagName !== 'OL' || !el.textContent.trim()))) other.remove();
  });
  let followedByContent = false;
  for (let next = section.nextSibling; next; next = next.nextSibling) if (next.nodeType === 1 || (next.nodeType === 3 && next.textContent.trim())) followedByContent = true;
  if (section.parentNode !== root || followedByContent) root.append(section);
  return {diagnostics:[...new Set(diagnostics)], count:groups.size};
}
