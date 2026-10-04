// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlHistoryRestore.mjs
// This module distinguishes localized, identity-preserving history replay from edits requiring presentation rehydration so ordinary text and style changes do not reset every editor tool or scan the whole document.
const PRESENTATION = 'img,audio,video,iframe,canvas,svg,.nv-layout-canvas,.nv-canvas-item,.nodevision-image-text,[data-nodevision-image-text],[data-nodevision-image-src],.nv-inline-equation,.nodevision-circuit-reference,[data-nodevision-circuit-src]';
export function htmlHistoryNeedsPresentation(patches) {
  if (!patches) return true;
  for (const patch of patches) {
    const target = patch.node.nodeType === 1 ? patch.node : patch.node.parentElement;
    if (target?.closest?.(PRESENTATION)) return true;
    if (patch.kind !== 'children') continue;
    for (const node of [...patch.added, ...patch.removed]) {
      if (node.nodeType === 1 && (node.matches(PRESENTATION) || node.querySelector(PRESENTATION))) return true;
    }
  }
  return false;
}
export function createHtmlHistoryRestore(restorePresentation, root = null) {
  return detail => {
    const state = root?.ownerDocument?.defaultView?.NodevisionState;
    const selectedMedia = ['activeHtmlImageContext', 'activeHtmlImageTextContext', 'activeHtmlAudioContext', 'activeHtmlCircuitContext']
      .some(key => state?.[key]?.element && root.contains(state[key].element));
    if (selectedMedia || htmlHistoryNeedsPresentation(detail.patches)) restorePresentation(detail);
  };
}
