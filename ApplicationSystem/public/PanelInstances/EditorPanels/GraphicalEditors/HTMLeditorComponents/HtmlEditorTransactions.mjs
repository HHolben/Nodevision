// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlEditorTransactions.mjs
// This module groups synchronous HTML body edits through the editor's existing programmatic history, owns revision notifications, and supports preview cancellation without creating a second undo stack.

export function createHtmlEditorTransactions({ root, selection, history, onCommit }) {
  const listeners = new Set();
  let revision = 0;
  let active = null;
  let disposed = false;
  let publishing = false;
  const assertLive = () => {
    if (disposed || !root.isConnected) throw new Error('HTML editor is disposed or disconnected.');
  };
  function publish(label) {
    revision++;
    publishing = true;
    try { onCommit?.({ label, revision }); }
    finally { publishing = false; }
    listeners.forEach(listener => listener({ label, revision }));
  }
  function record(before, label = 'Body edit') {
    assertLive();
    if (active) return false;
    const changed = history.record(before);
    if (changed) publish(label);
    return changed;
  }

  // Capture once per command/gesture, not per pointer move or selection update.
  function begin(label = 'Body edit', expectedRevision = revision) {
    assertLive();
    if (active) throw new Error('An HTML transaction is already open.');
    if (expectedRevision !== revision) throw new Error('The HTML revision changed; refresh the edit target.');
    const pending = { before: root.innerHTML, bookmark: selection.bookmark(), revision };
    active = pending;
    function check() {
      assertLive();
      if (active !== pending || pending.revision !== revision) throw new Error('HTML transaction is stale.');
    }
    return {
      preview(mutate) {
        check();
        const result = mutate(root);
        if (result?.then) throw new Error('HTML transactions require synchronous mutations.');
        return result;
      },
      commit() {
        check();
        active = null;
        return record(pending.before, label);
      },
      cancel() {
        check();
        active = null;
        if (root.innerHTML !== pending.before) history.restorePreview(pending.before);
        selection.restore(pending.bookmark);
        return true;
      },
    };
  }
  function run(label, mutate, expectedRevision = revision) {
    const transaction = begin(label, expectedRevision);
    try {
      transaction.preview(mutate);
      return transaction.commit();
    } catch (error) {
      if (active) transaction.cancel();
      throw error;
    }
  }

  // Native input remains native; invalidate stale transactions without overwriting new input.
  function onInput() {
    if (publishing || disposed) return;
    active = null;
    revision++;
    listeners.forEach(listener => listener({ label: 'Input', revision }));
  }
  root.addEventListener('input', onInput);
  return {
    begin, run, record,
    get revision() { return revision; },
    get pending() { return Boolean(active); },
    assertSettled() { assertLive(); if (active) throw new Error('Commit or cancel the pending HTML edit before saving.'); },
    reset() { assertLive(); active = null; selection.clear(); history.clear(); revision++; },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    dispose() { disposed = true; active = null; listeners.clear(); root.removeEventListener('input', onInput); },
  };
}
