// Real panel tabs, graphical hosts, HTML contexts, and neighboring FileView for Electron verification.
import './html-foundation-diagnostics.mjs';
import './html-source-browser.mjs';
const output = document.getElementById('result');
const ok = (value, label) => { if (!value) throw new Error(label); };
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
try {
  ok(output.textContent.startsWith('PASS:'), output.textContent);
  const fetchOriginal = window.fetch.bind(window);
  const files = new Map(['A.html', 'B.html'].map(name => [name,
    `<!doctype html><html lang="en"><head><title>${name}</title></head><body><p id="text">${name[0]}</p></body></html>`]));
  const saves = [], liveEvents = [], timings = [];
  window.fetch = async (url, options = {}) => {
    const path = String(url);
    if (path === '/PanelInstances/ModuleMap.csv') return new Response('Extension,ViewerModule,GraphicalEditorModule,Family\nhtml,ViewHTML.mjs,HTMLeditor.mjs,Publication');
    if (path.startsWith('/Notebook/')) return new Response(files.get(path.slice(10)) || '<html><body>fixture</body></html>');
    if (path === '/api/save') { saves.push(JSON.parse(options.body)); return Response.json({ success: true }); }
    return fetchOriginal(url, options);
  };
  window.addEventListener('nodevision-live-file-content-changed', event => liveEvents.push(event.detail.filePath));
  const { setupPanel } = await import('/PanelInstances/EditorPanels/GraphicalEditor.mjs');
  const { setupPanel: setupViewer, setLiveFileViewerEnabled, updateViewPanel } = await import('/PanelInstances/ViewPanels/FileView.mjs');
  setLiveFileViewerEnabled(true, { refresh: false });
  const tabs = await import('/panels/panelTabs.mjs');
  const live = await import('/LiveFileContent.mjs');
  const { default: saveFile } = await import('/ToolbarCallbacks/file/saveFile.mjs');
  window.saveCurrentFile = () => saveFile();
  await import('/KeyboardShortcuts/ShortcutSave.js');
  const cell = document.getElementById('editor'), viewer = document.getElementById('viewer');
  cell.replaceChildren(); viewer.replaceChildren();
  cell.className = 'panel-cell active-panel'; viewer.className = 'panel-cell';
  const countsBeforeMount = foundationDiagnostics.counts();
  const opened = [], contexts = [];
  for (const name of ['A.html', 'B.html']) {
    const tab = await tabs.openPanelTabInCell(cell, { panelType: 'GraphicalEditor', panelClass: 'EditorPanel',
      resourcePath: name, panelVars: { filePath: name } }, setupPanel);
    opened.push(tab);
    contexts.push(tab.contentElement.querySelector('[data-nv-graphical-editor-root]').__nvHtmlEditorContext);
  }
  const [a, b] = contexts;
  function activate(index) {
    if (tabs.getActivePanelTab(cell)?.tabId !== opened[index].tabId) tabs.activatePanelTab(cell, opened[index].tabId);
    contexts[index].activate();
    return contexts[index];
  }
  function caret(index, offset = null) {
    const context = activate(index), root = context.editorElement;
    const text = root.querySelector('#text').firstChild;
    const range = document.createRange();
    range.setStart(text, offset ?? text.length); range.collapse(true);
    root.focus(); window.getSelection().removeAllRanges(); window.getSelection().addRange(range);
    context.selection.capture();
  }
  caret(0, 1); caret(1, 1);
  ok(a.selection.getRange().startContainer !== b.selection.getRange().startContainer, 'retained tabs own distinct selections');
  a.setInlineStyle(a.editorElement.querySelector('#text'), 'color', 'red');
  b.setInlineStyle(b.editorElement.querySelector('#text'), 'color', 'blue');
  ok(live.getLiveFileContentForPath('A.html').content.includes('red'), 'inactive A live source belongs to A');
  ok(live.getLiveFileContentForPath('B.html').content.includes('blue'), 'B live source belongs to B');
  ok(!live.getLiveFileContentForPath('a.html'), 'case-sensitive paths stay separate');
  const layersHost = document.getElementById('layers');
  const refreshes = foundationDiagnostics.watchRefreshes(layersHost, viewer);
  activate(0);
  const disposeLayers = window.HTMLLayersContext.attachHost(layersHost);
  a.selection.selectElement(a.editorElement.querySelector('#text'));
  ok(layersHost.querySelector('button[data-layer-index]'), 'Layers mounted for owning editor');
  layersHost.querySelector('button[data-layer-index]').click();
  ok(a.selection.getElement() === a.editorElement.querySelector('#text'), 'Layers shares the editor selection owner');
  await tabs.openPanelTabInCell(viewer, { panelType: 'FileView', panelClass: 'ViewPanel', resourcePath: 'A.html', panelVars: { filePath: 'A.html' } }, setupViewer);
  await delay(600);
  const frame = viewer.querySelector('iframe');
  ok(frame && (frame.srcdoc.includes('red') || frame.contentDocument?.body.innerHTML.includes('red')), 'neighboring FileView uses A live source');
  activate(1); await a.save(); await b.save();
  ok(saves.at(-2).path === 'A.html' && saves.at(-2).content.includes('red'), 'A scoped save path/content');
  ok(saves.at(-1).path === 'B.html' && saves.at(-1).content.includes('blue'), 'B scoped save path/content');
  // Current-baseline timings include real browser DOM cloning and geometry, but the toolbar is a counted harness adapter.
  const { createHtmlSourceDocument: oldSource } = await import('/__baseline/HtmlSourceDocument.mjs');
  const { cloneHtmlBodyForSave: oldClone } = await import('/__baseline/HtmlBodySerialization.mjs');
  for (const [paragraphs, fragmented] of [[100, false], [1000, false], [5000, false], [1000, true]]) {
    const paragraph = fragmented ? '<p class="line"><span data-x="1">ordinary</span> <em class="em">source</em> <span style="color:red">text</span></p>' : '<p>ordinary <em>source</em> text</p>';
    const source = '<!doctype html><html><body>' + paragraph.repeat(paragraphs) + '</body></html>';
    a.setHTML(source);
    const oldBody = document.createElement('div'), oldHead = document.createElement('div'), oldHidden = document.createElement('div');
    const oldDocument = oldSource({ body: oldBody, head: oldHead, hidden: oldHidden });
    oldDocument.load(source);
    oldDocument.serialize(oldClone(oldBody)); a.getHTML();
    for (let i = 0; i < 12; i++) {
      const actions = [['baseline detached serializer', () => oldDocument.serialize(oldClone(oldBody))], ['save serialization', () => a.getHTML()]];
      if (i % 2) actions.reverse();
      for (const [action, run] of actions) { const start = performance.now(); run(); timings.push({ action, paragraphs, fragmented, bytes: source.length, ms: performance.now() - start }); }
    }
  }
  const countsBeforeSwitches = foundationDiagnostics.counts();
  for (let i = 0; i < 20; i++) activate(i % 2);
  const countsAfterSwitches = foundationDiagnostics.counts();
  const otherCell = document.createElement('div'); otherCell.className = 'panel-cell'; document.body.append(otherCell);
  tabs.movePanelTab(cell, opened[1].tabId, otherCell);
  b.activate(); a.activate();
  ok(a.selection !== b.selection, 'panel move retains distinct owners');
  tabs.movePanelTab(otherCell, opened[1].tabId, cell); otherCell.remove();
  a.setHTML(files.get('A.html')); b.setHTML(files.get('B.html')); caret(0);
  window.foundation = { ready: true, contexts, saves, liveEvents, timings, refreshes, activate, caret, countsBeforeMount, countsBeforeSwitches, countsAfterSwitches,
    reset() { a.setHTML(files.get('A.html')); b.setHTML(files.get('B.html')); caret(0); },
    async preparePreview() { a.setHTML(files.get('A.html')); b.setHTML(files.get('B.html')); caret(0); await updateViewPanel('A.html', { force: true }); await delay(700); },
    async previewState() {
      await delay(700);
      return { text: viewer.querySelector('iframe')?.contentDocument?.body.textContent,
        source: viewer.querySelector('iframe')?.srcdoc, frames: refreshes.counts.viewerFramesMounted,
        focusedEditor: document.activeElement === a.editorElement, caret: a.selection.getRange()?.startOffset,
        owner: window.__nvActiveHtmlEditorContext?.filePath };
    },
    previewPoint() { const rect = viewer.querySelector('iframe').getBoundingClientRect(); return { x: Math.round(rect.x + 30), y: Math.round(rect.y + 30) }; },
    hidePreview(hidden) { viewer.querySelector('.nv-panel-tab-content').hidden = hidden; },
    async showPreview() { viewer.querySelector('.nv-panel-tab-content').hidden = false; await updateViewPanel('A.html', { force: true }); await delay(700); },
    state() { return contexts.map(context => ({ source: context.getHTML(), text: context.editorElement.textContent,
      caret: context.selection.getRange()?.startOffset, revision: context.revision })); },
    async measureInteractions() {
      await updateViewPanel('A.html', { force: true });
      caret(0);
      await delay(700);
      const context = a, root = a.editorElement;
      const measures = [];
      for (const [action, run] of [
        ['caret', () => {
          const range = document.createRange(); range.setStart(root.querySelector('#text').firstChild, 1); range.collapse(true);
          window.getSelection().removeAllRanges(); window.getSelection().addRange(range); context.selection.capture();
        }],
        ['element selection', () => context.selection.selectElement(root.querySelector('#text'))],
        ['style transaction', () => context.setInlineStyle(root.querySelector('#text'), 'color', 'purple')],
        ['transaction rollback', () => {
          const transaction = context.transactions.begin('cancel');
          transaction.preview(() => root.querySelector('#text').style.color = 'orange'); transaction.cancel();
        }],
        ['programmatic undo', () => root.__nvProgrammaticHistory.undo()],
        ['programmatic redo', () => root.__nvProgrammaticHistory.redo()],
      ]) {
        const before = foundationDiagnostics.counts(), refreshBefore = { ...refreshes.counts }, liveBefore = liveEvents.length;
        const start = performance.now(); run();
        const synchronousMs = performance.now() - start;
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        const secondRafMs = performance.now() - start;
        await delay(700);
        measures.push({ action, synchronousMs, secondRafMs,
          toolbarCalls: foundationDiagnostics.counts().toolbarCalls - before.toolbarCalls,
          layersMutationBatches: refreshes.counts.layersMutationBatches - refreshBefore.layersMutationBatches,
          viewerRefreshMutations: refreshes.counts.viewerRefreshMutations - refreshBefore.viewerRefreshMutations,
          viewerFramesMounted: refreshes.counts.viewerFramesMounted - refreshBefore.viewerFramesMounted,
          liveEvents: liveEvents.length - liveBefore });
        if (action === 'style transaction') {
          ok(viewer.querySelector('iframe')?.srcdoc.includes('purple'), 'neighboring FileView refreshes committed A while editor has focus');
          ok(window.__nvActiveHtmlEditorContext === a, 'live preview refresh retains editor ownership');
        }
      }
      return measures;
    },
    async lifecycleCycles() {
      const counts = [];
      for (let cycle = 0; cycle < 10; cycle++) {
        const tab = await tabs.openPanelTabInCell(cell, { panelType: 'GraphicalEditor', panelClass: 'EditorPanel',
          resourcePath: 'A.html', panelVars: { filePath: 'A.html' } }, setupPanel);
        const temporaryCell = document.createElement('div'); temporaryCell.className = 'panel-cell'; document.body.append(temporaryCell);
        tabs.movePanelTab(cell, tab.tabId, temporaryCell);
        tabs.closePanelTab(temporaryCell, tab.tabId, { force: true });
        ok(!temporaryCell.__nvHtmlEditorContext, 'closing moved editor releases its panel compatibility context');
        temporaryCell.remove();
        await tabs.openPanelTabInCell(viewer, { panelType: 'FileView', panelClass: 'ViewPanel', resourcePath: 'A.html', panelVars: { filePath: 'A.html' } }, setupViewer);
        tabs.closePanelTabsInCell(viewer);
        await delay(500);
        ok(!window.__nvActiveHtmlEditorContext && !window.HTMLLayersContext && !window.getEditorHTML && !window.saveWYSIWYGFile, 'disposed editors release compatibility globals');
        counts.push(foundationDiagnostics.counts());
      }
      return counts;
    },
    closeEditor(index) { tabs.closePanelTab(cell, opened[index].tabId, { force: true }); },
    dispose() { refreshes.dispose(); disposeLayers?.(); tabs.closePanelTabsInCell(cell); tabs.closePanelTabsInCell(viewer); },
  };
  output.textContent = 'PASS: retained HTML tabs, Layers ownership, scoped saves, live sources, and FileView';
} catch (error) { output.textContent = 'FAIL: ' + error.stack; window.foundationError = error.stack; }
