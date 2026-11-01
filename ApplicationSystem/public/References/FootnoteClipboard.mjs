// Nodevision/ApplicationSystem/public/References/FootnoteClipboard.mjs
// This module carries complete footnote definitions in ordinary clipboard HTML, sharing identities within one editor and remapping foreign imports before insertion without replacing unrelated clipboard behavior.
import { NOTE, DEFINITIONS, identity, noteAnchors, noteDefinitions, fragmentTarget } from './ReferenceModel.mjs';

export function createFootnoteClipboard(root, {getRange, run, runNative = run, report}) {
  const token = identity('clipboard');
  const doc = root.ownerDocument;
  function copy(event) {
    const range = getRange();
    if (!range || range.collapsed || !root.contains(range.commonAncestorContainer) || !event.clipboardData || event.defaultPrevented) return;
    const body = doc.createElement('div'); body.append(range.cloneContents());
    const refs = noteAnchors(body);
    if (!refs.length) return;
    const section = doc.createElement('section'); section.setAttribute('data-nv-notes', 'footnote');
    section.setAttribute('data-nv-clipboard-origin', token); section.setAttribute('aria-label','Footnotes');
    const list = doc.createElement('ol'); section.append(list);
    const ids = new Set(refs.map(ref => ref.getAttribute(NOTE)));
    const present = new Set(noteDefinitions(body).map(def => def.getAttribute(NOTE)));
    noteDefinitions(root).filter(def => ids.has(def.getAttribute(NOTE)) && !present.has(def.getAttribute(NOTE))).forEach(def => list.append(def.cloneNode(true)));
    body.append(section);
    const clean = root.__nvSourceProvenance?.clean(body) || body;
    event.clipboardData.setData('text/html', clean.innerHTML);
    event.clipboardData.setData('text/plain', range.toString());
    event.preventDefault(); event.stopImmediatePropagation();
    if (event.type === 'cut') run('Cut footnote references', () => range.deleteContents());
  }
  function prepare(html) {
    const parsed = new DOMParser().parseFromString(html,'text/html');
    const body = parsed.body;
    if (!noteAnchors(body).length && !noteDefinitions(body).length) return null;
    // Match ordinary clipboard expectations: executable content is not imported by this special path.
    body.querySelectorAll('script,style,iframe,object,embed,base,meta,link').forEach(el => el.remove());
    body.querySelectorAll('*').forEach(el => [...el.attributes].forEach(attr => {
      if (/^on/i.test(attr.name) || (/^(href|src|action|formaction)$/i.test(attr.name) && /^\s*(javascript|vbscript):/i.test(attr.value))) el.removeAttribute(attr.name);
    }));
    const origin = body.querySelector('[data-nv-clipboard-origin]')?.getAttribute('data-nv-clipboard-origin');
    const same = origin === token;
    const existing = new Set(noteDefinitions(root).map(def => def.getAttribute(NOTE)));
    const mappedNotes = new Map(), mappedTargets = new Map();
    for (const def of noteDefinitions(body)) {
      const old = def.getAttribute(NOTE), oldTarget = def.id;
      if (same && existing.has(old)) { def.remove(); continue; }
      const next = same && old ? old : identity();
      if (!mappedNotes.has(old)) mappedNotes.set(old,next);
      const target = identity('fn'); mappedTargets.set(oldTarget,{note:next,target});
      def.setAttribute(NOTE,next); def.id = target;
      def.querySelectorAll('[data-nv-note-returns]').forEach(el => el.remove());
    }
    for (const ref of noteAnchors(body)) {
      const target = mappedTargets.get(fragmentTarget(ref));
      let note = target?.note || mappedNotes.get(ref.getAttribute(NOTE));
      if (!note && origin && !same) {
        const old = ref.getAttribute(NOTE) || fragmentTarget(ref);
        note = mappedNotes.get(old) || identity(); mappedNotes.set(old,note);
        ref.setAttribute('href',`#missing-${note}`);
      }
      if (note) ref.setAttribute(NOTE,note);
      if (target) ref.setAttribute('href',`#${target.target}`);
      ref.id = identity('fnref');
    }
    body.querySelectorAll('[data-nv-clipboard-origin]').forEach(section => {
      section.removeAttribute('data-nv-clipboard-origin');
      if (!noteDefinitions(section).length) section.remove();
    });
    return body;
  }
  function paste(event) {
    if (event.defaultPrevented || !event.clipboardData) return;
    const range = getRange();
    if (!range || !root.contains(range.commonAncestorContainer)) return;
    const body = prepare(event.clipboardData.getData('text/html'));
    if (!body) return;
    event.preventDefault(); event.stopImmediatePropagation();
    const target = range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentElement;
    if (target.closest(DEFINITIONS)) { report('Paste references into the main document, outside footnote definitions.'); return; }
    try {
      runNative('Paste footnote references', () => {
        // Definitions belong at the end, not inside a pasted paragraph or table cell.
        const definitions = noteDefinitions(body); definitions.forEach(def => def.remove());
        body.querySelectorAll('[data-nv-notes]').forEach(section => { if (!section.querySelector('li')) section.remove(); });
        const selection = doc.getSelection(); selection.removeAllRanges(); selection.addRange(range);
        root.focus({preventScroll:true});
        if (!doc.execCommand('insertHTML', false, body.innerHTML)) throw new Error('The browser could not paste this reference selection.');
        if (definitions.length) {
          const section = doc.createElement('section'); section.setAttribute('data-nv-notes','footnote');
          const list = doc.createElement('ol'); section.append(list); definitions.forEach(def => list.append(doc.importNode(def,true))); root.append(section);
        }
      });
    } catch (error) { report(error.message); }
  }
  root.addEventListener('copy',copy,true); root.addEventListener('cut',copy,true); root.addEventListener('paste',paste,true);
  return {prepare, dispose() {
    root.removeEventListener('copy',copy,true); root.removeEventListener('cut',copy,true); root.removeEventListener('paste',paste,true);
  }};
}
