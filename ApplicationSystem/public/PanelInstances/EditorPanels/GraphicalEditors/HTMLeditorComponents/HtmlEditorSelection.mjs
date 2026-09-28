// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlEditorSelection.mjs
// This module owns an HTML editor's element selection and caret bookmarks independently of application focus, with explicit restoration after a body snapshot is replaced.

export function createHtmlEditorSelection(root) {
  const doc = root.ownerDocument;
  const listeners = new Set();
  let element = null;
  let range = null;
  let endpoints = null;
  let disposed = false;
  const owns = node => !disposed && Boolean(node && root.contains(node));
  const notify = () => listeners.forEach(listener => listener());

  // Paths are used only for an explicit snapshot restoration, never for stale live targets.
  function path(node) {
    const result = [];
    while (node && node !== root) {
      result.unshift([...node.parentNode.childNodes].indexOf(node));
      node = node.parentNode;
    }
    return result;
  }
  const resolve = indices => indices?.reduce((node, index) => node?.childNodes[index], root);
  const validRange = () => range && endpoints && owns(endpoints[0]) && owns(endpoints[1]);

  function selectElement(next) {
    if (next !== null && (!owns(next) || next.nodeType !== 1)) return false;
    if (element === next) return true;
    element = next;
    notify();
    return true;
  }
  function capture() {
    if (disposed) return false;
    const native = doc.defaultView.getSelection();
    const next = native?.rangeCount ? native.getRangeAt(0) : null;
    if (!next || !owns(next.startContainer) || !owns(next.endContainer)) return false;
    range = next.cloneRange();
    endpoints = [next.startContainer, next.endContainer];
    selectElement(next.startContainer.nodeType === 1 ? next.startContainer : next.startContainer.parentElement);
    return true;
  }
  function bookmark() {
    return {
      owner: root,
      element: owns(element) ? path(element) : null,
      range: validRange() ? {
        start: path(range.startContainer), startOffset: range.startOffset,
        end: path(range.endContainer), endOffset: range.endOffset,
      } : null,
    };
  }
  function restore(saved = null) {
    if (disposed || (saved && saved.owner !== root)) return false;
    if (saved) {
      element = saved.element ? resolve(saved.element) : null;
      range = null;
      endpoints = null;
      if (saved.range) {
        const start = resolve(saved.range.start), end = resolve(saved.range.end);
        if (owns(start) && owns(end)) {
          try {
            range = doc.createRange();
            range.setStart(start, saved.range.startOffset);
            range.setEnd(end, saved.range.endOffset);
            endpoints = [start, end];
          } catch { range = null; }
        }
      }
      notify();
    }
    if (!validRange()) return false;
    root.focus();
    const native = doc.defaultView.getSelection();
    native.removeAllRanges();
    native.addRange(range.cloneRange());
    return true;
  }

  // A toolbar taking focus does not clear the owning editor's last valid selection.
  doc.addEventListener('selectionchange', capture);
  root.addEventListener('mouseup', capture);
  root.addEventListener('keyup', capture);
  return {
    capture, selectElement, bookmark, restore,
    getElement: () => owns(element) ? element : null,
    getRange: () => validRange() ? range.cloneRange() : null,
    clear() { element = range = endpoints = null; notify(); },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    dispose() {
      disposed = true;
      doc.removeEventListener('selectionchange', capture);
      root.removeEventListener('mouseup', capture);
      root.removeEventListener('keyup', capture);
      element = range = endpoints = null;
      listeners.clear();
    },
  };
}
