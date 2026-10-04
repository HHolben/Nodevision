// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlHistoryPatches.mjs
// This module compacts localized DOM mutations into reversible patches and validates their preimages during atomic replay while preserving node identities and source provenance.
import { isHtmlEditorChrome } from './HtmlSourceProvenance.mjs';

const chrome = node => {
  for (let element = node.nodeType === 1 ? node : node.parentElement; element; element = element.parentElement) {
    if (isHtmlEditorChrome(element)) return true;
  }
  return false;
};
export function mutationPatches(records, provenance) {
  const patches = [], latest = new Map();
  // Walk backwards to recover each record's immediate postimage, including repeated writes.
  for (const record of [...records].reverse()) {
    const node = record.target;
    if (chrome(node)) continue;
    if (record.type === 'childList') {
      const removed = [...record.removedNodes].filter(n => !chrome(n));
      const added = [...record.addedNodes].filter(n => !chrome(n));
      if (removed.length || added.length) patches.push({ kind: 'children', node, removed, added, next: record.nextSibling });
      continue;
    }
    const name = record.type === 'attributes' ? record.attributeName : null;
    const privateAttribute = name && provenance?.isPrivateAttribute(name);
    let values = latest.get(node);
    if (!values) latest.set(node, values = new Map());
    const after = values.has(name) ? values.get(name) : name ? node.getAttribute(name) : node.data;
    values.set(name, record.oldValue);
    const normalize = value => name && provenance ? provenance.historyAttribute(node, name, value) : value;
    const presentation = privateAttribute || normalize(record.oldValue) === normalize(after);
    patches.push({ kind: name ? 'attribute' : 'text', node, name, presentation, before: record.oldValue, after });
  }
  const authored = new Set(patches.filter(p => !p.presentation).map(p => p.node));
  return patches.reverse().filter(p => !p.presentation || authored.has(p.node));
}
export function compactPatches(patches) {
  const result = [], nodes = new Map();
  for (const patch of patches) {
    if (patch.kind === 'children') { nodes.clear(); result.push(patch); continue; }
    let attributes = nodes.get(patch.node);
    if (!attributes) nodes.set(patch.node, attributes = new Map());
    const previous = attributes.get(patch.name);
    if (previous && previous.after === patch.before) previous.after = patch.after;
    else { const copy = { ...patch }; attributes.set(patch.name, copy); result.push(copy); }
  }
  return result.filter(p => p.kind === 'children' || p.before !== p.after);
}
function apply(patch, forward) {
  const { node, kind, name } = patch;
  if (kind !== 'children') {
    const expected = forward ? patch.before : patch.after, value = forward ? patch.after : patch.before;
    if ((kind === 'text' ? node.data : node.getAttribute(name)) !== expected) throw new Error('HTML history preimage changed.');
    if (kind === 'text') node.data = value;
    else if (value === null) node.removeAttribute(name);
    else node.setAttribute(name, value);
    return;
  }
  const remove = forward ? patch.removed : patch.added, insert = forward ? patch.added : patch.removed;
  if (remove.some(child => child.parentNode !== node) || (patch.next && patch.next.parentNode !== node)) throw new Error('HTML history structure changed.');
  if (insert.some(child => child.parentNode && !remove.includes(child))) throw new Error('HTML history insertion moved.');
  remove.forEach(child => child.remove());
  insert.forEach(child => node.insertBefore(child, patch.next));
}
export function replayPatches(patches, forward) {
  const ordered = forward ? patches : [...patches].reverse(), applied = [];
  try { for (const patch of ordered) { apply(patch, forward); applied.push(patch); } }
  catch (error) { for (const patch of applied.reverse()) apply(patch, !forward); throw error; }
}
export function patchBytes(patches) {
  let bytes = 0;
  const visited = new Set();
  for (const patch of patches) {
    bytes += 128 + 2 * ((patch.before?.length || 0) + (patch.after?.length || 0));
    const queue = [...(patch.removed || []), ...(patch.added || [])];
    while (queue.length) {
      const node = queue.pop();
      if (visited.has(node)) continue;
      visited.add(node); bytes += 96 + (node.nodeType === 3 ? node.length * 2 : 0);
      if (node.attributes) for (const attr of node.attributes) bytes += 2 * (attr.name.length + attr.value.length);
      queue.push(...node.childNodes);
    }
  }
  return bytes;
}
