// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlEditorTransactions.mjs
// This module groups synchronous HTML body edits through the editor's existing programmatic history, owns revision notifications, and supports preview cancellation without creating a second undo stack.
import { measureHtmlWork } from './HtmlWorkDiagnostics.mjs';
import { createHtmlTransactionBoundary } from './HtmlTransactionBoundary.mjs';

export function createHtmlEditorTransactions({ root, selection, history, onCommit, readAuthored = () => root.innerHTML }) {
  const listeners = new Set();
  const boundary = createHtmlTransactionBoundary(root);
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
    measureHtmlWork(root, 'transactionNotifications', () => listeners.forEach(listener => listener({ label, revision })));
  }
  function record(before, label = 'Body edit') {
    assertLive();
    if (active) return false;
    const changed = history.record(before);
    if (changed) publish(label);
    boundary.emit('record', { label, revision, changed });
    return changed;
  }

  // Capture once per command/gesture, not per pointer move or selection update.
  function begin(label = 'Body edit', expectedRevision = revision) {
    assertLive();
    boundary.assertCommandAllowed();
    if (active) throw new Error('An HTML transaction is already open.');
    if (expectedRevision !== revision) throw new Error('The HTML revision changed; refresh the edit target.');
    history.beginTransaction?.();
    const pending = { before: history.owned ? null : root.innerHTML, authored: readAuthored(), bookmark: selection.bookmark(), revision, failure: null };
    active = pending;
    boundary.emit('begin', { label, revision });
    function check() {
      assertLive();
      if (active !== pending || pending.revision !== revision) throw new Error('HTML transaction is stale.');
    }
    const transaction = {
      preview(mutate) {
        check();
        boundary.assertCommandAllowed();
        try {
          if (mutate.constructor?.name === 'AsyncFunction') throw new Error('HTML transactions require synchronous mutations.');
          const result = mutate(root);
          if (result?.then) throw new Error('HTML transactions require synchronous mutations.');
          if (pending.failure) throw pending.failure;
          boundary.emit('preview', { label, revision });
          return result;
        } catch (error) { pending.failure = error; throw error; }
      },
      commit() {
        check();
        boundary.assertCommandAllowed();
        if (pending.failure) { transaction.cancel(); throw pending.failure; }
        if (readAuthored() === pending.authored) { history.finishNoop?.(); active = null; boundary.emit('commit', { label, revision, changed: false }); return false; }
        const changed = history.record(pending.before, pending.bookmark);
        active = null;
        if (changed) publish(label);
        boundary.emit('commit', { label, revision, changed });
        return changed;
      },
      cancel({ focus = true } = {}) {
        check();
        active = null;
        if (history.owned || root.innerHTML !== pending.before) history.restorePreview(pending.before);
        selection.restore(pending.bookmark, { focus });
        boundary.emit('cancel', { label, revision });
        return true;
      },
    };
    pending.transaction = transaction;
    return transaction;
  }
  function run(label, mutate, expectedRevision = revision) {
    if (active) return active.transaction.preview(mutate);
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
  function onInput(event) {
    if (publishing || disposed) return;
    if (active) history.finishNoop?.();
    active = null;
    revision++;
    if (boundary.observed) boundary.emit('input', { revision, inputType: event.inputType || null, isComposing: Boolean(event.isComposing), trusted: event.isTrusted });
    measureHtmlWork(root, 'transactionNotifications', () => listeners.forEach(listener => listener({ label: 'Input', revision })));
  }
  const onComposition = () => { if (active) active.transaction.cancel({ focus: false }); };
  root.addEventListener('compositionstart', onComposition, true);
  root.addEventListener('input', onInput);
  return {
    begin, run, record,
    subscribeBoundary: boundary.subscribe,
    get composing() { return boundary.composing; },
    get revision() { return revision; },
    get pending() { return Boolean(active); },
    assertSettled() { assertLive(); if (active) throw new Error('Commit or cancel the pending HTML edit before saving.'); },
    reset() { assertLive(); active = null; selection.clear(); history.clear(); revision++; boundary.reset(); },
    subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
    dispose() { disposed = true; active = null; listeners.clear(); history.dispose?.(); boundary.dispose(); root.removeEventListener('input', onInput); root.removeEventListener('compositionstart', onComposition, true); },
  };
}
