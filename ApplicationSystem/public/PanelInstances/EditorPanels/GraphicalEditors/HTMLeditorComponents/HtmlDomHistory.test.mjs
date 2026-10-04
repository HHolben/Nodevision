// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlDomHistory.test.mjs
// This module verifies that disposing an HTML journal releases queued changes, observer registrations, event listeners, and shared history routing.
import assert from 'node:assert/strict';
import test from 'node:test';
import { createHtmlDomHistory } from './HtmlDomHistory.mjs';

// Track listeners and queued records without depending on a browser's GC timing.
class Target extends EventTarget {
  listeners = new Set();
  addEventListener(name, fn, options) { this.listeners.add(fn); super.addEventListener(name, fn, options); }
  removeEventListener(name, fn, options) { this.listeners.delete(fn); super.removeEventListener(name, fn, options); }
}
test('dispose releases journal state, observer, listeners and shared routing', () => {
  const originalObserver = globalThis.MutationObserver;
  const observers = [];
  globalThis.MutationObserver = class {
    records = []; disconnected = false;
    constructor() { observers.push(this); }
    observe() {}
    takeRecords() { return this.records.splice(0); }
    disconnect() { this.disconnected = true; }
  };
  try {
    const originalCommand = () => false;
    const doc = Object.assign(new Target(), { execCommand: originalCommand, defaultView: {} });
    const root = Object.assign(new Target(), { ownerDocument: doc });
    const history = createHtmlDomHistory(root);
    const node = { nodeType: 3, data: 'before' };
    const change = value => {
      const oldValue = node.data; node.data = value;
      observers[0].records.push({ type: 'characterData', target: node, oldValue });
    };
    history.beginTransaction(); change('after'); history.record();
    assert.equal(history.canUndo(), true);
    history.undo();
    assert.equal(history.canRedo(), true);
    history.beginTransaction(); change('pending');
    history.dispose(); history.dispose();
    assert.equal(history.inspect().retainedBytes, 0);
    assert.equal(history.canUndo(), false);
    assert.equal(history.canRedo(), false);
    assert.equal(history.undo(), false);
    assert.equal(history.redo(), false);
    assert.equal(observers[0].records.length, 0);
    assert.equal(observers[0].disconnected, true);
    assert.equal(root.listeners.size, 0);
    assert.equal(doc.listeners.size, 0);
    assert.equal(root.__nvHtmlDiagnostics, undefined);
    assert.equal(doc.execCommand, originalCommand);
    assert.equal(doc.defaultView.__nvDispatchHtmlHistory, undefined);
  } finally { globalThis.MutationObserver = originalObserver; }
});
