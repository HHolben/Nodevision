// Nodevision/ApplicationSystem/public/ToolbarCallbacks/file/saveFile/SaveDispatch.test.mjs
// This test suite verifies native save priority and document ownership across panel assets, worlds, code, CSV, Markdown, and HTML. An optional baseline module runs these same assertions against the pre-refactor implementation.

import test from 'node:test';
import assert from 'node:assert/strict';
const {
  default: saveFile
} = await import(process.env.NV_SAVE_DISPATCH_MODULE || '../saveFile.mjs');

import { editor } from './SaveTestEnvironment.mjs';

// Panel-owned assets and active worlds retain priority over global editor hooks.
for (const [selector, property, path] of [['[data-nv-map-editor]', '__nvMapApi', 'map.nvmap'], ['[data-nv-gox]', '__nvGoxApi', 'model.gox']]) {
  test(`${property} owns save and refuses other paths`, async t => {
    const state = editor(t),
      api = {
        filePath: path,
        save: async () => {
          state.calls.push(path);
          return true;
        }
      };
    window.activeCell = {
      querySelectorAll: query => query === selector ? [{
        closest: () => true,
        [property]: {
          save() {
            throw Error('Hidden editor');
          }
        }
      }, {
        closest: () => null,
        [property]: api
      }] : []
    };
    window.monacoEditor = {
      getValue() {
        throw Error('Stale code editor');
      }
    };
    assert.equal(await saveFile(path), true);
    assert.equal(await saveFile('other.html'), false);
    assert.deepEqual(state.calls, [path]);
    assert.deepEqual(state.writes, []);
  });
}
test('active Game View saves its world and reports only successful saves', async t => {
  const state = editor(t);
  window.activePanel = 'GameView';
  window.saveVirtualWorldFile = async path => {
    state.calls.push(path);
    return true;
  };
  assert.equal(await saveFile('world.html'), true);
  assert.deepEqual(state.saved, ['world.html']);
  window.saveVirtualWorldFile = async () => false;
  assert.equal(await saveFile('world.html'), false);
  assert.deepEqual(state.saved, ['world.html']);
});

// Text and document dispatch preserve source paths, encodings, and ownership guards.
test('Code Editing hook precedes Monaco and rejects mismatched buffers', async t => {
  const state = editor(t, 'CodeEditing', 'code.js');
  window.__nvCodeEditorActivePath = 'code.js';
  window.saveCodeFile = async path => state.calls.push(path);
  window.monacoEditor = {
    getValue() {
      throw Error('Wrong priority');
    }
  };
  assert.equal(await saveFile(), true);
  assert.equal(await saveFile('other.js'), false);
  assert.deepEqual(state.calls, ['code.js']);
});
test('Monaco fallback preserves encoding and BOM', async t => {
  const state = editor(t, '', 'code.txt');
  window.__nvCodeEditorActivePath = 'code.txt';
  window.monacoEditor = {
    getValue: () => 'α'
  };
  window.currentFileEncoding = 'utf16le';
  window.currentFileBom = true;
  assert.equal(await saveFile(), true);
  assert.deepEqual(state.writes, [{
    path: 'code.txt',
    sourcePath: 'code.txt',
    content: 'α',
    encoding: 'utf16le',
    bom: true
  }]);
});
test('graphical save skips stale Monaco and serializes CSV', async t => {
  const state = editor(t, 'CSVediting', 'table.csv');
  window.monacoEditor = {
    getValue() {
      throw Error('Wrong priority');
    }
  };
  window.__nvCsvEditor = {
    filePath: 'table.csv',
    delimiter: ';',
    getRows: () => [['a', 'b']],
    serializeDelimitedRows: (rows, delimiter) => rows[0].join(delimiter)
  };
  assert.equal(await saveFile({
    graphicalEditor: true
  }), true);
  assert.equal(state.writes[0].content, 'a;b');
  assert.equal(await saveFile({
    graphicalEditor: true,
    path: 'other.csv'
  }), false);
});
test('Markdown source stays associated with its own file', async t => {
  const state = editor(t, 'MDediting', 'note.md');
  window.__nvMarkdownActivePath = 'note.md';
  window.getEditorMarkdown = () => '# Keep';
  assert.equal(await saveFile(), true);
  assert.equal(await saveFile('other.md'), false);
  assert.deepEqual(state.writes, [{
    path: 'note.md',
    sourcePath: 'note.md',
    content: '# Keep'
  }]);
});
test('owning HTML context precedes stale global markup and guards SVG paths', async t => {
  const state = editor(t, 'HTMLediting');
  window.__nvActiveHtmlEditorContext = {
    kind: 'html',
    filePath: 'page.html',
    getHTML: () => '<html>Keep</html>'
  };
  window.getEditorHTML = () => 'stale';
  window.__nvWysiwygActivePath = 'page.html';
  assert.equal(await saveFile({
    graphicalEditor: true
  }), true);
  assert.equal(state.writes[0].editorKind, 'html-wysiwyg');
  assert.equal(state.writes[0].content, '<html>Keep</html>');
  assert.equal(await saveFile({
    graphicalEditor: true,
    path: 'other.html'
  }), false);
  window.__nvActiveHtmlEditorContext.filePath = 'picture.svg';
  assert.equal(await saveFile({
    graphicalEditor: true,
    path: 'picture.svg'
  }), false);
});

