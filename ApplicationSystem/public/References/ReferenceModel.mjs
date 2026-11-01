// Nodevision/ApplicationSystem/public/References/ReferenceModel.mjs
// This module defines document-local reference identities and ordinary HTML constructors independently of editor panels, leaving annotation kinds available for later scholarly reference phases.
export const MISSING_NOTE_TEXT = 'Footnote content is missing. Restore the original note or enter its contents here.';
export const NOTE = 'data-nv-note-id';
export const KIND = 'data-nv-note-kind';
export const REF = 'data-nv-reference';
export const DEFINITIONS = 'li[data-nv-note-kind="footnote"],li[role="doc-footnote"],#footnotes-list > li,.nv-footnotes > ol > li';
export const ANCHORS = 'a[data-nv-reference="footnote"],a[role="doc-noteref"]:not([data-nv-reference]),sup > a[href^="#footnote-"],sup > a[href^="#temp-note-"],sup > a[href^="#fn-"]';
export const STRUCTURE = `${DEFINITIONS},${ANCHORS},[data-nv-notes="footnote"],[data-nv-note-returns],[data-nv-note-orphans]`;
export function identity(prefix = 'note') { return `${prefix}-${crypto.randomUUID()}`; }
export function setAttribute(element, name, value) {
  if (element.getAttribute(name) !== String(value)) element.setAttribute(name, String(value));
}
export function fragmentTarget(link) {
  const href = link.getAttribute('href') || '';
  if (!href.startsWith('#')) return '';
  try { return decodeURIComponent(href.slice(1)); } catch { return href.slice(1); }
}
export function noteDefinitions(root) { return [...root.querySelectorAll(DEFINITIONS)]; }
export function noteAnchors(root) {
  return [...root.querySelectorAll(ANCHORS)].filter(anchor => !anchor.closest(DEFINITIONS));
}
export function createDefinition(doc, noteId = identity()) {
  const li = doc.createElement('li'); li.id = identity('fn');
  li.setAttribute(NOTE, noteId); li.setAttribute(KIND, 'footnote'); li.setAttribute('role', 'doc-footnote');
  const paragraph = doc.createElement('p'); paragraph.append(doc.createElement('br')); li.append(paragraph);
  return li;
}
export function createAnchor(doc, definition) {
  const anchor = doc.createElement('a'); anchor.id = identity('fnref');
  anchor.setAttribute(REF, 'footnote'); anchor.setAttribute(NOTE, definition.getAttribute(NOTE));
  anchor.setAttribute('role', 'doc-noteref'); anchor.setAttribute('href', `#${definition.id}`);
  anchor.textContent = '?';
  const sup = doc.createElement('sup'); sup.append(anchor);
  return {anchor, sup};
}
export function ensureCollection(root) {
  let section = root.querySelector('section[data-nv-notes="footnote"]') || root.querySelector('section.nv-footnotes');
  if (!section) {
    section = root.ownerDocument.createElement('section');
    section.setAttribute('data-nv-notes', 'footnote'); section.className = 'nv-footnotes';
    section.setAttribute('aria-label', 'Footnotes');
    const heading = root.ownerDocument.createElement('h2'); heading.textContent = 'Footnotes';
    section.append(heading, root.ownerDocument.createElement('ol')); root.append(section);
  }
  setAttribute(section, "data-nv-notes", "footnote");
  setAttribute(section, "aria-label", "Footnotes");
  let list = section.querySelector(':scope > ol');
  if (!list) { list = root.ownerDocument.createElement('ol'); section.append(list); }
  return {section, list};
}
