// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SvgSelectionMarkers.mjs
// This module reconciles SVG selection attributes separately from geometry overlays so selection changes can avoid work on unrelated objects.

export function createSvgSelectionMarkers(getSelectableElements) {
  const legacyFilter = 'drop-shadow(0 0 2px #ff2f2f)';
  let previous = null;
  let disposed = false;
  function clear(element) {
    if (element.hasAttribute('data-selected')) element.removeAttribute('data-selected');
    if (element.style.filter === legacyFilter) element.style.filter = '';
  }
  return {
    update(selected) {
      if (disposed) return;
      const next = new Set(selected);
      // Reconcile imported legacy markers once; subsequent changes visit only the selection.
      for (const element of previous || getSelectableElements()) {
        if (!next.has(element)) clear(element);
      }
      for (const element of next) {
        if (element.getAttribute('data-selected') !== 'true') element.setAttribute('data-selected', 'true');
        if (element.style.filter === legacyFilter) element.style.filter = '';
      }
      previous = next;
    },
    reset() { previous = null; },
    dispose() { for (const element of previous || []) clear(element); previous = new Set(); disposed = true; },
  };
}
