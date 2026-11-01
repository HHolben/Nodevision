// Nodevision/ApplicationSystem/public/ToolbarCallbacks/file/saveFile/SaveFailure.test.mjs
// This test suite verifies inline-image finalization, save-hook failures, and editor-specific fallback behavior. Isolated browser state prevents real document writes during regression checks.

import test from 'node:test';
import assert from 'node:assert/strict';
const {
  default: saveFile
} = await import(process.env.NV_SAVE_DISPATCH_MODULE || '../saveFile.mjs');

import { editor } from './SaveTestEnvironment.mjs';

// Finalization and rejected hooks must prevent fallback writes or success notifications.
test('inline image completion precedes parent HTML serialization', async t => {
  const state = editor(t, 'HTMLediting');
  window.NodevisionState.htmlImageEditingInline = true;
  window.HTMLWysiwygTools = {
    async finishInlineImageEditor() {
      state.calls.push('finish');
      window.NodevisionState.htmlImageEditingInline = false;
    }
  };
  window.getEditorHTML = () => {
    state.calls.push('serialize');
    return '<html>Updated image</html>';
  };
  assert.equal(await saveFile(), true);
  assert.deepEqual(state.calls, ['finish', 'serialize']);
});
test('unfinished inline images abort all writes', async t => {
  const state = editor(t, 'HTMLediting');
  window.NodevisionState.htmlImageEditingInline = true;
  window.HTMLWysiwygTools = {
    async finishInlineImageEditor() {}
  };
  window.getEditorHTML = () => 'unsafe';
  assert.equal(await saveFile(), false);
  assert.deepEqual(state.writes, []);
  assert.deepEqual(state.saved, []);
});
test('EPUB hook refusal prevents success and fallback serialization', async t => {
  const state = editor(t, 'EPUBediting', 'book.epub');
  window.__nvActiveHtmlEditorContext = {
    kind: 'html',
    filePath: 'book.epub',
    save: async () => false,
    getHTML() {
      throw Error('Unsafe fallback');
    }
  };
  assert.equal(await saveFile(), false);
  assert.deepEqual(state.saved, []);
  assert.deepEqual(state.writes, []);
});
test('SVG hook rejection is caught by the dispatcher', async t => {
  const state = editor(t, 'SVGediting', 'drawing.svg');
  state.elements['svg-editor-root'] = {};
  window.SVGEditorContext = {
    filePath: 'drawing.svg',
    save: async () => {
      throw Error('Disk unavailable');
    }
  };
  assert.equal(await saveFile(), false);
  window.SVGEditorContext.save = async () => false;
  assert.equal(await saveFile(), false);
  assert.deepEqual(state.saved, []);
  assert.deepEqual(state.writes, []);
});
test('legacy SVG hook refuses HTML destinations', async t => {
  const state = editor(t, 'SVGediting', 'page.html');
  state.elements['svg-editor-root'] = {};
  window.currentSaveSVG = async () => state.calls.push('svg');
  assert.equal(await saveFile(), false);
  assert.deepEqual(state.calls, []);
});

// Editor-specific hooks and the final text fallback remain available.
for (const [mode, hook, path] of [['MIDIediting', 'saveMIDIFile', 'score.mid'], ['KMLeditorMode', 'currentSaveKML', 'map.kml']]) {
  test(`${mode} uses its native save hook`, async t => {
    const state = editor(t, mode, path);
    window[hook] = async target => state.calls.push(target);
    assert.equal(await saveFile(), true);
    assert.deepEqual(state.calls, [path]);
  });
}
test('simple Markdown textarea fallback and API failure handling', async t => {
  const state = editor(t, '', 'note.md');
  state.elements['markdown-editor'] = {
    value: 'Plain text'
  };
  assert.equal(await saveFile(), true);
  assert.equal(state.writes[0].content, 'Plain text');
  globalThis.fetch = async () => Response.json({
    error: 'Disk full'
  }, {
    status: 500
  });
  assert.equal(await saveFile(), false);
  assert.deepEqual(state.saved, ['note.md']);
});
