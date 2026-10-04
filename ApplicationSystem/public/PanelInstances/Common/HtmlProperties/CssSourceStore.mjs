// Nodevision/ApplicationSystem/public/PanelInstances/Common/HtmlProperties/CssSourceStore.mjs
// This module owns shared local CSS buffers, revisioned programmatic transactions, explicit saves and source-editor conflict checks for the bounded Properties prototype.
import { createHtmlEditorTransactions } from '../../EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlEditorTransactions.mjs';
import { createWysiwygProgrammaticHistory } from '../../EditorPanels/GraphicalEditors/HTMLeditorComponents/WysiwygProgrammaticHistory.mjs';
import { normalizeLiveFilePath, listLiveFileContentProviders, registerLiveFileContentProvider, touchLiveFileContentProvider } from '/LiveFileContent.mjs';
import { toNotebookAssetUrl } from '/utils/notebookPath.mjs';
import { indexCssSource } from './CssSourceIndex.mjs';

const sources = new Map();
export function cssSourceConflict(path) {
  const same = value => normalizeLiveFilePath(value) === path;
  if (window.__nvCodeEditorDirty && same(window.__nvCodeEditorActivePath)) return 'This CSS file has unsaved CodeEditor changes.';
  for (const host of document.querySelectorAll('.monaco-editor-container, [data-nv-code-editor-root]')) {
    const session = host.__nvCodeEditorSession;
    if (session && same(session.filePath)) return session.dirty ? 'This CSS file has unsaved CodeEditor changes.' : 'Close this CSS file in CodeEditor before editing it here.';
  }
  const other = listLiveFileContentProviders().find(provider => same(provider.filePath) && provider.editorKind !== 'css-properties');
  return other ? 'This CSS file is owned by another editor buffer. Close that editor first.' : '';
}
async function read(path) {
  const response = await fetch(toNotebookAssetUrl(path), { cache: 'no-store' });
  if (!response.ok) throw new Error(`Stylesheet unavailable (${response.status}): ${path}`);
  if (response.redirected) throw new Error('Redirected stylesheets are read-only in this prototype');
  return response.text();
}
export async function acquireCssSource(path) {
  if (!sources.has(path)) sources.set(path, read(path).then(text => createSource(path, text)).catch(error => { sources.delete(path); throw error; }));
  const source = await sources.get(path); source.retain(); return source;
}
function createSource(path, initial) {
  const root = new EventTarget(); root.innerHTML = initial; root.isConnected = true;
  const listeners = new Set(); let saved = initial, committed = initial, indexed = null, references = 0, saving = false;
  const id = 'properties-css:' + path;
  const notify = () => { committed = root.innerHTML; indexed = null; listeners.forEach(fn => fn()); touchLiveFileContentProvider(id); };
  const selection = { bookmark: () => null, restore() {}, clear() {} };
  const history = createWysiwygProgrammaticHistory(root, { readSnapshot: () => root.innerHTML,
    writeSnapshot: value => { root.innerHTML = value; }, onRestore: ({ direction }) => { if (direction !== 'cancel') root.dispatchEvent(new Event('input')); } });
  const transactions = createHtmlEditorTransactions({ root, selection, history });
  const unsubscribe = transactions.subscribe(notify);
  const removeProvider = registerLiveFileContentProvider({ id, filePath: path, editorKind: 'css-properties',
    sourceLabel: 'CSS Properties', getContent: () => committed, dirty: () => committed !== saved });
  function assertWritable() {
    if (!root.isConnected) throw new Error('CSS buffer is disposed');
    const conflict = cssSourceConflict(path); if (conflict) throw new Error(conflict);
    if (saving) throw new Error('CSS save is in progress');
  }
  function collect() {
    if (references || root.innerHTML !== saved || transactions.pending || saving) return;
    root.isConnected = false; unsubscribe(); transactions.dispose(); removeProvider(); listeners.clear(); sources.delete(path);
  }
  return {
    path, transactions, history, assertWritable,
    get text() { return root.innerHTML; },
    get dirty() { return committed !== saved; },
    get revision() { return transactions.revision; },
    get index() { return indexed?.source === root.innerHTML ? indexed : (indexed = indexCssSource(root.innerHTML)); },
    retain() { references++; }, release() { references = Math.max(0, references - 1); collect(); },
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    async checkDisk() { assertWritable(); if (await read(path) !== saved) throw new Error('CSS changed on disk. Reopen the document before editing.'); assertWritable(); },
    begin() {
      assertWritable(); const tx = transactions.begin('CSS declaration');
      return { preview(text) { assertWritable(); tx.preview(() => { root.innerHTML = text; }); indexed = null; listeners.forEach(fn => fn()); },
        commit() { assertWritable(); const result = tx.commit(); collect(); return result; },
        cancel() { const result = tx.cancel(); indexed = null; listeners.forEach(fn => fn()); collect(); return result; } };
    },
    async save() {
      transactions.assertSettled(); await this.checkDisk();
      const content = root.innerHTML, revision = transactions.revision; saving = true;
      try {
        const response = await fetch('/api/save', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path, sourcePath: path, content, editorKind: 'css-properties' }) });
        const result = await response.json(); if (!response.ok || !result.success) throw new Error(result.error || 'CSS save failed');
        if (revision === transactions.revision) saved = content;
        notify();
        window.dispatchEvent(new CustomEvent('fileSaved', { detail: { filePath: path } }));
      } finally { saving = false; collect(); }
    },
  };
}
