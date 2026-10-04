// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlTransactionBoundary.mjs
// This module exposes editor-owned transaction and composition boundaries for history coordination without recording document snapshots or claiming ownership of browser undo groups.
export function createHtmlTransactionBoundary(root) {
  const listeners = new Set();
  let composing = false, disposed = false;
  // Metadata is allocated only when a consumer explicitly subscribes.
  function emit(phase, detail = null) {
    if (disposed || !listeners.size) return;
    const event = Object.freeze({ phase, composing, ...detail });
    for (const listener of listeners) {
      try { listener(event); }
      catch (error) { console.warn('HTML transaction boundary observer failed:', error); }
    }
  }
  function start() { composing = true; emit('composition-start'); }
  function end() { composing = false; emit('composition-end'); }
  function before(event) {
    if (listeners.size) emit('beforeinput', { inputType: event.inputType || null, isComposing: Boolean(event.isComposing), trusted: event.isTrusted, cancelable: event.cancelable });
  }
  root.addEventListener('beforeinput', before, true);
  root.addEventListener('compositionstart', start, true);
  root.addEventListener('compositionend', end, true);
  return {
    emit,
    get observed() { return listeners.size > 0; },
    get composing() { return composing; },
    assertCommandAllowed() {
      if (composing) throw new Error('Finish text composition before starting or committing a graphical edit.');
    },
    subscribe(listener) { if (disposed) throw new Error('HTML transaction boundary is disposed.'); listeners.add(listener); return () => listeners.delete(listener); },
    reset() { composing = false; emit('reset'); },
    dispose() {
      emit('dispose'); disposed = true; composing = false; listeners.clear();
      root.removeEventListener('beforeinput', before, true);
      root.removeEventListener('compositionstart', start, true);
      root.removeEventListener('compositionend', end, true);
    },
  };
}
