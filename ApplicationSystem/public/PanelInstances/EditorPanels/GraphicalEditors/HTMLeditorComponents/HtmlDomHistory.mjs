// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlDomHistory.mjs
// This module owns a bounded chronological DOM journal for one HTML editing surface, capturing browser input and transaction patches while keeping Chromium history outside the user-visible timeline.
import { mutationPatches, compactPatches, replayPatches, patchBytes } from './HtmlHistoryPatches.mjs';
import { installHtmlHistoryRouting } from './HtmlHistoryRouting.mjs';

export function createHtmlDomHistory(root, options = {}) {
  const measurements = {};
  let measuring = false;
  function measure(name, action) {
    if (!measuring) return action();
    const start = performance.now();
    try { return action(); } finally {
      const samples = measurements[name] ||= [];
      if (samples.length === 512) samples.shift(); samples.push(performance.now() - start);
    }
  }
  const undo = [], redo = [], maxEntries = options.maxEntries || 100, maxBytes = options.maxBytes || 8 * 1024 * 1024;
  let records = [], run = null, transaction = null, native = null, composing = false, replaying = false, disposed = false, commanding = false;
  const selection = () => root.__nvHtmlSelection;
  const bookmark = () => { selection()?.capture(); return selection()?.bookmark(); };
  root.__nvHtmlDiagnostics = { measure };
  const patches = () => measure('capture', () => {
    records.push(...observer.takeRecords());
    if (records.some(record => record.type === 'childList')) selection()?.invalidatePaths();
    const result = mutationPatches(records, root.__nvSourceProvenance); records = []; return result;
  });
  const clear = () => { undo.length = redo.length = 0; run = native = transaction = null; records = []; observer.takeRecords(); };
  const observer = new MutationObserver(changes => {
    records.push(...changes);
    if (transaction) transaction.patches = compactPatches([...transaction.patches, ...patches()]);
    if (!transaction && !native && !replaying && patches().length) clear();
  });
  observer.observe(root, { subtree: true, childList: true, attributes: true, attributeOldValue: true, characterData: true, characterDataOldValue: true });
  function trim() {
    let bytes = undo.reduce((sum, entry) => sum + entry.bytes, run?.bytes || 0);
    while (undo.length && (undo.length + Number(Boolean(run)) > maxEntries || bytes > maxBytes)) bytes -= undo.shift().bytes;
  }
  const flush = () => measure('typingCommit', flushRun);
  function flushRun() {
    if (!run) return;
    run.patches = compactPatches(run.patches);
    const entry = run; run = null;
    if (entry.patches.length) { entry.bytes = patchBytes(entry.patches); undo.push(entry); trim(); }
  }
  function commit(changes, before, after, type, merge = false) {
    if (!changes.length) return false;
    redo.length = 0;
    if (!merge || run?.type !== type) flush();
    if (!run) run = { patches: [], before, after, type };
    run.patches = measure('coalesce', () => compactPatches([...run.patches, ...changes])); run.after = after;
    run.bytes = patchBytes(run.patches);
    if (!merge) flush();
    trim();
    // Bound an unfinished run too; long text remains one first/last pair.
    if (patchBytes(run?.patches || []) > maxBytes) { flush(); }
    return true;
  }
  function quiesce(callback) {
    replaying = true;
    try { return callback(); } finally { observer.takeRecords(); records = []; selection()?.invalidatePaths(); replaying = false; }
  }
  function replay(direction) {
    if (disposed || composing || transaction) return false;
    if (patches().length) { clear(); return false; }
    flush();
    const from = direction === 'undo' ? undo : redo, to = direction === 'undo' ? redo : undo, entry = from.at(-1);
    if (!entry) return false;
    try { measure('replayDom', () => quiesce(() => replayPatches(entry.patches, direction === 'redo'))); }
    catch (error) { clear(); console.warn('HTML history refused:', error); return false; }
    from.pop(); to.push(entry);
    quiesce(() => {
      measure('restoreSubscribers', () => options.onRestore?.({ direction, patches: entry.patches }));
      measure('restoreCaret', () => selection()?.restore(direction === 'undo' ? entry.before : entry.after));
      measure('notifyInput', () => root.dispatchEvent(new Event('input', { bubbles: true })));
    });
    return true;
  }
  function before(event) {
    if (commanding || event.defaultPrevented || /^history/.test(event.inputType || '')) return;
    if (transaction) {
      if (event.cancelable) { event.preventDefault(); return; }
      history.cancelTransaction();
    }
    if (patches().length) clear();
    const saved = bookmark(), type = composing ? 'composition' : event.inputType;
    if (!composing && run && (run.type !== type || JSON.stringify(run.after?.range) !== JSON.stringify(saved?.range))) flush();
    const pending = native = { before: run?.before || saved, type };
    queueMicrotask(() => { if (native === pending && event.defaultPrevented) { native = null; if (patches().length) clear(); } });
  }
  function input(event) {
    if (replaying || commanding) return;
    if (/^history(Undo|Redo)$/.test(event.inputType || '')) {
      // A prototype-level execCommand can bypass beforeinput and the instance wrapper.
      // Reverse its actual mutations synchronously before dispatching owned history.
      const changes = patches();
      quiesce(() => replayPatches(changes, false));
      history[event.inputType === 'historyRedo' ? 'redo' : 'undo'](); return;
    }
    if (!native) return;
    const changes = patches(), after = bookmark();
    const merge = composing || ['insertText', 'deleteContentBackward', 'deleteContentForward'].includes(native.type);
    commit(changes, native.before, after, native.type, merge);
    native = null;
  }
  const boundary = () => { if (!composing) flush(); };
  const navigation = event => { if (!['Shift', 'Control', 'Meta', 'Alt', 'Backspace', 'Delete'].includes(event.key) && (event.key.length > 1 || event.ctrlKey || event.metaKey)) boundary(); };
  const start = () => { if (transaction) history.cancelTransaction(); flush(); composing = true; };
  const end = () => { composing = false; native = null; flush(); };
  const selectionChanged = () => {
    if (!run || composing || native) return;
    const saved = bookmark();
    if (JSON.stringify(saved?.range) !== JSON.stringify(run.after?.range)) flush();
  };
  const events = [['beforeinput', before], ['input', input], ['compositionstart', start], ['compositionend', end], ['keydown', navigation], ['pointerdown', boundary], ['focusout', boundary]].map(([name, fn]) => [name, event => measure(name, () => fn(event))]);
  const history = {
    owned: true, flush,
    captureCommand(action) {
      if (composing) return false;
      if (transaction) return action();
      history.beginTransaction(); commanding = true;
      try { const result = action(); history.record(); return result; }
      catch (error) { history.cancelTransaction(); throw error; }
      finally { commanding = false; }
    },
    beginTransaction() { if (patches().length) clear(); flush(); transaction = { before: bookmark(), patches: [] }; },
    record(_before, saved) {
      const changes = [...(transaction?.patches || []), ...patches()];
      const before = transaction?.before || saved || bookmark(); transaction = null;
      return commit(compactPatches(changes), before, bookmark(), 'transaction');
    },
    cancelTransaction() {
      if (!transaction) return;
      const pending = transaction, changes = compactPatches([...pending.patches, ...patches()]); transaction = null;
      quiesce(() => { replayPatches(changes, false); selection()?.restore(pending.before, { focus: false }); });
    },
    restorePreview() { history.cancelTransaction(); },
    finishNoop() { patches(); transaction = null; },
    undo: () => measure('undo', () => replay('undo')), redo: () => measure('redo', () => replay('redo')),
    measure(enabled = true) { measuring = enabled; for (const key of Object.keys(measurements)) delete measurements[key]; },
    measurements,
    canUndo: () => Boolean(run || undo.length), canRedo: () => Boolean(redo.length),
    inspect() { return { undoEntries: undo.length + Number(Boolean(run)), redoEntries: redo.length, maxEntries, maxBytes,
      retainedBytes: [...undo, ...redo, ...(run ? [run] : [])].reduce((sum, entry) => sum + patchBytes(entry.patches), 0) }; },
    clear,
    dispose() { if (disposed) return; delete root.__nvHtmlDiagnostics; disposed = true; clear(); observer.disconnect(); removeRouting(); events.forEach(([name, fn]) => root.removeEventListener(name, fn, true)); root.ownerDocument.removeEventListener('selectionchange', selectionChanged); },
  };
  const removeRouting = installHtmlHistoryRouting(root, history);
  events.forEach(([name, fn]) => root.addEventListener(name, fn, true));
  root.ownerDocument.addEventListener('selectionchange', selectionChanged);
  return history;
}
