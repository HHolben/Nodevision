// Nodevision/ApplicationSystem/public/panels/editorHorizontalScroll.mjs
// This module maps unmodified Shift-wheel gestures to horizontal scrolling within an editor's scrollable ancestors. It leaves zoom gestures and ordinary vertical scrolling to their existing handlers and releases its listener with the editor lifecycle.

export function installEditorHorizontalScroll(root) {
  const wheel = event => {
    if (event.defaultPrevented || !event.shiftKey || event.ctrlKey || event.metaKey || event.altKey || event.getModifierState?.('Fn')) return;
    // Some devices already convert Shift-wheel to deltaX. Do not add both axes.
    const delta = event.deltaX || event.deltaY;
    if (!Number.isFinite(delta) || !delta) return;
    let element = event.target?.nodeType === 1 ? event.target : event.target?.parentElement;
    let fallback = null;
    while (element && root.contains(element)) {
      const view = element.ownerDocument.defaultView;
      const overflow = view.getComputedStyle(element).overflowX;
      if (/^(auto|scroll|overlay)$/.test(overflow) && element.scrollWidth > element.clientWidth) {
        fallback ||= element;
        const before = element.scrollLeft;
        const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? element.clientWidth : 1;
        element.scrollLeft += delta * unit;
        if (element.scrollLeft !== before) { event.preventDefault(); return; }
      }
      if (element === root) break;
      element = element.parentElement;
    }
    // At a horizontal edge, do not turn the same gesture into vertical scrolling.
    if (fallback) event.preventDefault();
  };
  root.addEventListener('wheel', wheel, { passive: false });
  return () => root.removeEventListener('wheel', wheel);
}
