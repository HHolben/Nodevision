// Nodevision/ApplicationSystem/public/References/ReferenceChanges.mjs
// This module filters journal patches for reference relationship changes and preserves live selection endpoints while reference presentation moves existing nodes.
import { STRUCTURE, ANCHORS, DEFINITIONS, NOTE, KIND, REF } from './ReferenceModel.mjs';
const relationshipAttributes = new Set(['id','href','role',NOTE,KIND,REF,'value']);
export function referenceChanges(patches) {
  return patches.some(patch => {
    const element = patch.node.nodeType === 1 ? patch.node : patch.node.parentElement;
    if (patch.kind !== 'attribute' && element?.closest('[data-nv-note-missing]')) return true;
    if (patch.kind === 'attribute') return relationshipAttributes.has(patch.name) && Boolean(element?.matches(STRUCTURE));
    if (patch.kind === 'text') return Boolean(element?.closest(ANCHORS));
    if (patch.kind !== 'children') return false;
    if (element?.matches(ANCHORS)) return true;
    return [...patch.added,...patch.removed].some(node => node.nodeType === 1 && (node.matches(STRUCTURE) || node.querySelector(STRUCTURE)));
  });
}
export function preserveReferenceSelection(root, action) {
  const selection = root.ownerDocument.getSelection();
  const saved = selection?.rangeCount && root.contains(selection.anchorNode) && root.contains(selection.focusNode)
    ? [selection.anchorNode, selection.anchorOffset, selection.focusNode, selection.focusOffset] : null;
  const result = action();
  if (saved && root.contains(saved[0]) && root.contains(saved[2])) {
    try { selection.setBaseAndExtent(...saved); } catch { /* A deleted number label cannot retain its caret. */ }
  }
  return result;
}
export function referenceAtRange(root, range) {
  if (!range || !root.contains(range.commonAncestorContainer)) return null;
  const node = range.startContainer;
  const element = node.nodeType === 1 ? node : node.parentElement;
  const nearest = element?.closest(`${ANCHORS},${DEFINITIONS}`);
  if (nearest && root.contains(nearest)) return nearest;
  const current = node.childNodes?.[range.startOffset];
  const candidates = range.collapsed ? [node.childNodes?.[range.startOffset - 1], current] : [current];
  for (const child of candidates) {
    if (child?.nodeType !== 1) continue;
    const match = child.matches(ANCHORS) ? child : child.querySelector(ANCHORS);
    if (match) return match;
  }
  return null;
}
