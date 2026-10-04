// Nodevision/ApplicationSystem/Desktop/ElectronHtmlHistory.test.mjs
// These tests verify that the desktop history adapter dispatches once, preserves native commands for other editors, and refuses native fallback when renderer routing fails.
import assert from 'node:assert/strict';
import { installElectronHtmlHistory } from './ElectronHtmlHistory.mjs';
let nativeUndo = 0, nativeRedo = 0, handled = true, failed = false, requests = 0;
const contents = {
  isDestroyed: () => false,
  undo() { nativeUndo++; }, redo() { nativeRedo++; },
  async executeJavaScript() { requests++; if (failed) throw new Error('renderer unavailable'); return handled; },
};
installElectronHtmlHistory(contents);
await contents.undo(); await contents.redo();
assert.equal(requests, 2); assert.equal(nativeUndo + nativeRedo, 0);
handled = false;
await contents.undo(); await contents.redo();
assert.equal(nativeUndo, 1); assert.equal(nativeRedo, 1);
failed = true;
await contents.undo(); await contents.redo();
assert.equal(nativeUndo + nativeRedo, 2, 'routing failure must not enable stale native fallback');
