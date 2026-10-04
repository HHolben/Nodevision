// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlEditorTransactions.test.mjs
// This module tests transaction failure boundaries and bookmark-aware history while preserving the existing model snapshot adapter contract.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createHtmlEditorTransactions } from './HtmlEditorTransactions.mjs';
import { createWysiwygProgrammaticHistory } from './WysiwygProgrammaticHistory.mjs';

function fixture() {
  const root = Object.assign(new EventTarget(), { innerHTML: 'before', isConnected: true });
  let bookmark = 'caret-before', failRead = false, commits = 0;
  const selection = { bookmark: () => bookmark, restore: value => { bookmark = value; }, clear() {} };
  const history = createWysiwygProgrammaticHistory(root, {
    readBookmark: selection.bookmark, restoreBookmark: selection.restore,
  });
  const transactions = createHtmlEditorTransactions({ root, selection, history,
    readAuthored() { if (failRead) throw new Error('serialization failed'); return root.innerHTML; },
    onCommit() { commits++; },
  });
  return { root, history, transactions, selection, failRead: () => { failRead = true; }, get commits() { return commits; } };
}

test('nested edits commit once and restore before/after bookmarks', () => {
  const f = fixture();
  f.transactions.run('compound', () => {
    f.root.innerHTML = 'intermediate';
    f.transactions.run('joined', () => { f.root.innerHTML = 'after'; });
  });
  assert.equal(f.commits, 1);
  f.selection.restore('caret-after');
  assert.equal(f.history.undo(), true);
  assert.equal(f.root.innerHTML, 'before');
  assert.equal(f.selection.bookmark(), 'caret-before');
  assert.equal(f.history.canUndo(), false);
  assert.equal(f.history.redo(), true);
  assert.equal(f.root.innerHTML, 'after');
  assert.equal(f.selection.bookmark(), 'caret-after');
});

test('caught nested failure still rejects outer commit and rolls back', () => {
  const f = fixture();
  assert.throws(() => f.transactions.run('outer', () => {
    f.root.innerHTML = 'partial';
    try { f.transactions.run('nested', () => { throw new Error('broken'); }); } catch {}
  }), /broken/);
  assert.equal(f.root.innerHTML, 'before');
  assert.equal(f.history.canUndo(), false);
  assert.equal(f.commits, 0);
});

test('serialization failure during commit rolls back without history', () => {
  const f = fixture();
  assert.throws(() => f.transactions.run('broken read', () => {
    f.root.innerHTML = 'partial'; f.failRead();
  }), /serialization failed/);
  assert.equal(f.root.innerHTML, 'before');
  assert.equal(f.transactions.pending, false);
  assert.equal(f.history.canUndo(), false);
});

test('no-op and cancel create no notifications; native input invalidates an open transaction', () => {
  const f = fixture();
  assert.equal(f.transactions.run('nothing', () => {}), false);
  const gesture = f.transactions.begin('gesture');
  gesture.preview(() => { f.root.innerHTML = 'preview'; });
  gesture.cancel();
  assert.equal(f.root.innerHTML, 'before');
  assert.equal(f.commits, 0);
  const stale = f.transactions.begin();
  f.root.innerHTML = 'native'; f.root.dispatchEvent(new Event('input'));
  assert.throws(() => stale.cancel(), /stale/);
  assert.equal(f.root.innerHTML, 'native');
  f.transactions.dispose();
  assert.throws(() => f.transactions.begin(), /disposed/);
});

test('model snapshot adapters still undo without DOM events or bookmarks', () => {
  const root = new EventTarget();
  let model = 'old', events = 0;
  root.addEventListener('input', () => events++);
  const history = createWysiwygProgrammaticHistory(root, {
    readSnapshot: () => model, writeSnapshot: value => { model = value; },
  });
  model = 'new'; history.record('old'); history.undo();
  assert.equal(model, 'old');
  history.redo(); assert.equal(model, 'new');
  assert.equal(events, 0);
});

test('composition excludes graphical transactions until the native commit boundary', () => {
  const f = fixture(), events = [];
  f.transactions.subscribeBoundary(event => events.push(event));
  f.root.dispatchEvent(new Event('compositionstart'));
  assert.equal(f.transactions.composing, true);
  assert.throws(() => f.transactions.run('style during IME', () => { f.root.innerHTML = 'lost'; }), /composition/);
  assert.equal(f.root.innerHTML, 'before');
  const input = new Event('input'); Object.assign(input, { inputType: 'insertCompositionText', isComposing: true });
  f.root.innerHTML = 'composing'; f.root.dispatchEvent(input);
  assert.equal(f.history.canUndo(), false);
  assert.equal(events.at(-1).composing, true);
  f.root.dispatchEvent(new Event('compositionend'));
  assert.equal(events.at(-1).phase, 'composition-end');
  f.transactions.run('style after IME', () => { f.root.innerHTML = 'committed style'; });
  assert.equal(f.commits, 1);
  assert.deepEqual(events.slice(-3).map(event => event.phase), ['begin', 'preview', 'commit']);
});

test('boundary observers do not create snapshots on native input and release on disposal', () => {
  const f = fixture(), events = [];
  f.transactions.subscribeBoundary(event => events.push(event));
  Object.defineProperty(f.root, 'innerHTML', { get() { throw new Error('unexpected snapshot'); } });
  const before = new Event('beforeinput', { cancelable: true });
  f.root.dispatchEvent(before);
  assert.equal(events.at(-1).phase, 'beforeinput');
  assert.equal(before.defaultPrevented, false);
  f.root.dispatchEvent(new Event('input'));
  assert.equal(events.at(-1).phase, 'input');
  f.transactions.dispose(); const count = events.length;
  f.root.dispatchEvent(new Event('compositionstart')); f.root.dispatchEvent(new Event('input'));
  assert.equal(events.length, count);
  assert.throws(() => f.transactions.subscribeBoundary(() => {}), /disposed/);
});

test('gesture previews, cancellation and no-op retain explicit transaction boundaries', () => {
  const f = fixture(), phases = [];
  f.transactions.subscribeBoundary(event => phases.push([event.phase, event.changed]));
  const tx = f.transactions.begin('resize');
  for (let i = 0; i < 20; i++) tx.preview(() => { f.root.innerHTML = 'width:' + i; });
  tx.cancel();
  assert.equal(f.history.inspect().undoEntries, 0);
  f.transactions.run('same', () => {});
  assert.deepEqual(phases.at(-1), ['commit', false]);
  assert.equal(phases.filter(([phase]) => phase === 'cancel').length, 1);
});
