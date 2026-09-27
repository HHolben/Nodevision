// Real File Manager clicks, graphical CSV/SVG editors, shared save path and modal.
const output = document.getElementById('result');
const ok = (value, label) => { if (!value) throw new Error(label); };
const tick = () => new Promise(resolve => setTimeout(resolve, 20));
async function until(check, label) {
  for (let i = 0; i < 150; i++) { if (check()) return; await tick(); }
  throw new Error('Timed out: ' + label);
}
const unhandled = [];
window.addEventListener('unhandledrejection', e => unhandled.push(e.reason));
try {
  window.NodevisionState = {};
  const nativeFetch = window.fetch.bind(window);
  const files = new Map([['A.csv', 'name,value\nalpha,1'], ['B.csv', 'name,value\nbeta,2'], ['b.csv', 'lower,case'],
    ['C.svg', '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="20" height="10"/></svg>']]);
  const saves = [];
  let rejectSave = false, releaseSave = null, delaySave = false;
  window.fetch = async (url, options = {}) => {
    const path = String(url);
    if (path === '/PanelInstances/ModuleMap.csv') return new Response('Extension,ViewerModule,GraphicalEditorModule,Family\ncsv,,CSVeditor.mjs,Spreadsheet\nsvg,,SVGeditor.mjs,Vector');
    if (path.startsWith('/Notebook/') && files.has(path.slice(10))) return new Response(files.get(path.slice(10)));
    if (path === '/api/save') {
      saves.push(JSON.parse(options.body));
      if (delaySave) await new Promise(resolve => { releaseSave = resolve; });
      return new Response(JSON.stringify(rejectSave ? { error: 'Disk full' } : { success: true }), { status: rejectSave ? 500 : 200 });
    }
    if (path.includes('recent') || path.includes('Recent')) return new Response(JSON.stringify({ entries: [] }));
    return nativeFetch(url, options);
  };
  const { setupPanel } = await import('/PanelInstances/EditorPanels/GraphicalEditor.mjs');
  const { openPanelTabInCell } = await import('/panels/panelTabs.mjs');
  const { attachFileClickHandlers } = await import('/PanelInstances/InfoPanels/FileManagerCore.mjs');
  const editorCell = document.getElementById('editor');
  editorCell.className = 'panel-cell active-panel';
  editorCell.dataset.id = 'GraphicalEditor';
  window.activeCell = editorCell;
  await openPanelTabInCell(editorCell, { panelType: 'GraphicalEditor', panelClass: 'EditorPanel', panelVars: { filePath: 'A.csv' } }, setupPanel);
  const manager = document.getElementById('viewer');
  manager.innerHTML = '<div id="file-list"></div>';
  for (const name of [...files.keys(), 'folder']) {
    const link = document.createElement('a'); link.href = '#'; link.textContent = name;
    link.className = name === 'folder' ? 'folder' : 'file';
    link.dataset.fullPath = name; link.dataset.isDirectory = String(name === 'folder');
    document.getElementById('file-list').append(link);
  }
  attachFileClickHandlers();
  const choose = name => {
    window.activeCell = manager; window.activePanel = 'FileManager'; window.NodevisionState.activePanelType = 'InfoPanel';
    document.querySelector(`#file-list [data-full-path="${name}"]`).click();
  };
  const prompt = () => document.querySelector('dialog[open][data-instance-name="UnsavedPrompt"]');
  const button = label => [...prompt().querySelectorAll('button')].find(b => b.textContent === label);
  window.__nvCsvEditor.paste('changed');
  const originalRows = JSON.stringify(window.__nvCsvEditor.getRows());
  choose('B.csv');
  ok(prompt() && prompt().textContent.includes('A.csv') && prompt().textContent.includes('B.csv'), 'small overlay identifies both files');
  ok(window.selectedFilePath === 'A.csv' && window.__nvCsvEditor.filePath === 'A.csv', 'selection and buffer wait for decision');
  button('Cancel').click();
  ok(!prompt() && window.NodevisionState.fileIsDirty && JSON.stringify(window.__nvCsvEditor.getRows()) === originalRows, 'Cancel preserves edits');
  choose('B.csv');
  prompt().dispatchEvent(new Event('cancel', { cancelable: true }));
  ok(!prompt() && window.selectedFilePath === 'A.csv', 'Escape cancels');
  choose('A.csv');
  ok(!prompt(), 'same file does not prompt or reload');
  choose('B.csv');
  rejectSave = true;
  window.monacoEditor = { getValue() { throw new Error('Wrong code editor buffer'); } };
  window.__nvActiveHtmlEditorContext = { kind: 'html', filePath: 'unrelated.html', activate() { throw new Error('Wrong HTML editor context'); } };
  button('Save').click();
  await until(() => prompt()?.querySelector('[role="alert"]')?.textContent.includes('Save failed'), 'inline save error');
  ok(window.__nvCsvEditor.filePath === 'A.csv' && window.NodevisionState.fileIsDirty, 'failed save preserves original file and dirty state');
  ok(saves[0].path === 'A.csv' && saves[0].sourcePath === 'A.csv' && saves[0].content.startsWith('changed'), 'save uses edited source, never destination');
  rejectSave = false; delaySave = true;
  button('Save').click();
  await until(() => releaseSave, 'save begins');
  ok([...prompt().querySelectorAll('button')].every(b => b.disabled), 'buttons disabled while saving');
  choose('C.svg');
  prompt().dispatchEvent(new Event('cancel', { cancelable: true }));
  ok(prompt() && window.__nvCsvEditor.filePath === 'A.csv', 'pending save cannot be redirected or discarded');
  releaseSave(); delaySave = false;
  await until(() => !prompt() && window.__nvCsvEditor?.filePath === 'B.csv', 'save completes before switch');
  ok(saves.length === 2 && saves[1].path === 'A.csv', 'only one save per click');
  ok(window.selectedFilePath === 'B.csv' && !window.NodevisionState.fileIsDirty, 'new file selected and clean');
  ok(document.querySelector('#file-list [data-full-path="B.csv"]').classList.contains('selected'), 'File Manager highlights accepted destination');
  delete window.monacoEditor;
  delete window.__nvActiveHtmlEditorContext;
  const tab = editorCell.__nvPanelTabs.tabs[0];
  ok(tab.resourcePath === 'B.csv' && tab.panelVars.filePath === 'B.csv' && tab.displayName.includes('B.csv'), 'tab identity follows editor');
  choose('b.csv');
  ok(prompt(), 'different file prompts even when clean and case differs');
  button('Switch Without Saving').click();
  await until(() => !prompt() && window.__nvCsvEditor?.filePath === 'b.csv', 'discard switches without writing');
  ok(saves.length === 2, 'discard performs no save');
  choose('folder');
  ok(!prompt() && window.__nvCsvEditor.filePath === 'b.csv', 'folder navigation does not replace editor');
  choose('C.svg');
  button('Switch Without Saving').click();
  await until(() => !prompt() && window.__nvSvgEditorActivePath === 'C.svg', 'switch changes editor family');
  ok(!window.__nvCsvEditor, 'old CSV lifecycle is cleaned up');
  choose('A.csv');
  ok(prompt(), 'SVG file switch is guarded');
  window.currentSaveSVG = async () => false;
  button('Save').click();
  await until(() => prompt()?.querySelector('[role="alert"]')?.textContent.includes('Save failed'), 'SVG hook false keeps prompt open');
  ok(window.__nvSvgEditorActivePath === 'C.svg', 'failed SVG save keeps SVG editor');
  button('Cancel').click();
  await tick();
  ok(unhandled.length === 0, 'no unhandled promises: ' + unhandled.map(String).join('; '));
  output.textContent = 'PASS: File Manager graphical switch prompt, Cancel/Escape, Save ordering/failure, discard, clean/same/case-sensitive paths, CSV/SVG lifecycle, and tab metadata';
} catch (error) {
  output.textContent = 'FAIL: ' + (error.stack || error);
  console.error(error);
}
