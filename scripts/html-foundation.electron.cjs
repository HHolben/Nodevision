// Nodevision/scripts/html-foundation.electron.cjs
// This standalone Electron runner serves local application modules and exercises native typing and shortcuts in retained Nodevision tabs without touching Notebook files.
const { app, BrowserWindow } = require('electron');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const performanceMode = process.argv.includes('--performance');
const propertiesMode = process.argv.includes('--properties');
const journalMode = process.argv.includes('--journal');
const historyMode = process.argv.includes('--history') || journalMode;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const stubs = {
  '/panels/createToolbar.mjs': 'window.toolbarUpdates=0; export function updateToolbarState(patch) { window.toolbarUpdates++; Object.assign(window.NodevisionState,patch); }',
  '/panels/panelFactory.mjs': 'export function createPanelDOM(){return document.createElement("div");}',
  '/panels/workspace.mjs': 'export function rebuildLayoutDividersForContainer(){} export async function loadPanelIntoCell(){}',
  '/TemplateSystem/NodevisionOverlayPanel.mjs': 'export function openNodevisionOverlayPanel(){}',
  '/ToolbarJSONfiles/insertMediaPanel.mjs': 'export function registerSvgEditorContextForInsertMedia(){return {dispose(){}};}',
};
if (propertiesMode) {
  delete stubs['/panels/panelFactory.mjs'];
  delete stubs['/TemplateSystem/NodevisionOverlayPanel.mjs'];
}
const baselineSources = process.env.NV_HTML_PERF_BASELINE ? require('./html-history-performance-baseline.cjs')(root) : {};
const server = http.createServer((request, response) => {
  const url = new URL(request.url, 'http://localhost').pathname;
  if (url === '/') { response.setHeader('Content-Type', 'text/html'); response.end('<html><body><div style="display:flex"><div id="editor" style="height:550px;width:650px"></div><div id="viewer" style="height:550px;width:400px"></div></div><div id="layers" style="height:200px;overflow:auto"></div><pre id="result">RUNNING</pre><script type="module" src="/scripts/' + (performanceMode ? 'html-history-performance-browser.mjs' : historyMode ? 'html-history-browser.mjs' : propertiesMode ? 'html-properties-browser.mjs' : 'html-foundation-workspace.mjs') + '"></script></body></html>'); return; }
  if (url.startsWith('/__baseline/')) {
    const name = path.basename(url);
    const target = name === 'ShortcutSave.js' ? 'KeyboardShortcuts/ShortcutSave.js'
      : 'PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/' + name;
    try {
      let source = execFileSync('git', ['show', '729280e:ApplicationSystem/public/' + target], { cwd: root, encoding: 'utf8' });
      source = source.replace(/from ["'](\.[^"']+)["']/g, (_, relative) => 'from "' + new URL(relative, 'http://localhost/' + target).pathname + '"');
      response.setHeader('Content-Type', 'text/javascript'); response.end(source);
    } catch { response.writeHead(404); response.end(); }
    return;
  }
  if (baselineSources[path.basename(url)]) { response.setHeader('Content-Type','text/javascript'); response.end(baselineSources[path.basename(url)]); return; }
  if (stubs[url]) { response.setHeader('Content-Type', 'text/javascript'); response.end(stubs[url]); return; }
  const file = path.resolve(url.startsWith('/scripts/') ? root : path.join(root, 'ApplicationSystem/public'), '.' + url);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { response.writeHead(404); response.end(); return; }
  response.setHeader('Content-Type', ({ '.mjs':'text/javascript', '.js':'text/javascript', '.json':'application/json', '.css':'text/css', '.csv':'text/csv' })[path.extname(file)] || 'application/octet-stream');
  response.end(fs.readFileSync(file));
});
app.disableHardwareAcceleration();
app.commandLine.appendSwitch('no-sandbox');
app.whenReady().then(async () => {
  let win;
  try {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    win = new BrowserWindow({ width: 1200, height: 950, show: true, webPreferences: { backgroundThrottling: false } });
    if (journalMode) win.nativeHistory = (await import('../ApplicationSystem/Desktop/ElectronHtmlHistory.mjs')).installElectronHtmlHistory(win.webContents);
    if (journalMode) win.webContents.on('console-message', (_event, level, message) => { if (level >= 2) console.log(message); });
    const js = source => win.webContents.executeJavaScript(source, true);
    await win.loadURL(`http://127.0.0.1:${server.address().port}/`);
    for (let i = 0; i < 200; i++) {
      const status = await js(performanceMode ? '({ready:!!window.historyPerf?.ready,error:window.historyPerfError})' : historyMode ? '({ready:!!window.historyExperiment?.ready,error:window.historyError})' : propertiesMode ? '({ready:!!window.propertiesTest?.ready,error:window.propertiesError})' : '({ready:!!window.foundation?.ready,error:window.foundationError})');
      if (status.error) throw new Error(status.error);
      if (status.ready) break;
      await delay(100);
    }
    if (!await js(performanceMode ? '!!window.historyPerf?.ready' : historyMode ? '!!window.historyExperiment?.ready' : propertiesMode ? '!!window.propertiesTest?.ready' : '!!window.foundation?.ready')) throw new Error(await js('document.getElementById("result").textContent'));
    const key = async (keyCode, modifiers = []) => {
      win.webContents.sendInputEvent({ type: 'keyDown', keyCode, modifiers });
      win.webContents.sendInputEvent({ type: 'keyUp', keyCode, modifiers });
      await delay(80);
    };
    const type = async text => { for (const letter of text) { win.webContents.sendInputEvent({ type: 'char', keyCode: letter }); await delay(30); } };
    if (performanceMode) {
      const report = await require(process.env.NV_HTML_PERF_STRUCTURAL ? './html-history-performance-structural.cjs' : './html-history-performance-run.cjs')({win,js,key,type,delay});
      report.environment=process.versions;
      const label=process.env.NV_HTML_PERF_LABEL || 'after';
      fs.writeFileSync(path.join(root,'docs/html-history-performance-'+label+'.json'),JSON.stringify(report,null,2)+'\n');
      console.log('PASS: history performance '+label);app.exit(0);return;
    }
    if (historyMode) {
      const report = await require(journalMode ? './html-journal-experiment.cjs' : './html-history-experiment.cjs')({ win, js, key, type, delay });
      report.environment = process.versions;
      fs.writeFileSync(path.join(root, journalMode ? 'docs/html-journal-results.json' : 'docs/html-history-journal-experiments.json'), JSON.stringify(report, null, 2) + '\n');
      console.log('PASS: mixed-history experiments recorded'); app.exit(0); return;
    }
    if (propertiesMode) {
      await js('propertiesTest.prepareNative()'); await type('one');
      await js('propertiesTest.commitNativeStyle()'); await type('two');
      const before = await js('propertiesTest.snapshot()'); await key('Z', ['control']);
      const after = await js('propertiesTest.snapshot()');
      if (before === after) throw new Error('Owned Properties history did not undo later text');
      const staleUndoRefused = await js('(function(){try { propertiesTest.nativeOperation.undo(); return false; } catch { return true; }})()');
      if (staleUndoRefused) throw new Error('Owned Properties history refused chronological undo');
      const report = await js('({checks:propertiesTest.checks,timings:propertiesTest.timings,lifecycle:propertiesTest.lifecycle,diagnostics:propertiesTest.diagnostics})');
      report.environment = process.versions; report.nativeUndo = { before, after, staleUndoRefused };
      await js('propertiesTest.dispose()'); await delay(700);
      report.afterDispose = await js('({providers:window.NodevisionLiveFileContent.listProviders(),counts:foundationDiagnostics.counts()})');
      if (report.afterDispose.providers.length) throw new Error('Properties providers leaked after clean CSS teardown');
      fs.writeFileSync(path.join(root, 'docs/html-properties-electron-results.json'), JSON.stringify(report, null, 2) + '\n');
      console.log('PASS: Properties source, ownership, preview, native undo containment and lifecycle'); app.exit(0); return;
    }
    const report = { environment: process.versions, workspace: await js('document.getElementById("result").textContent'), states: [] };
    await js('foundation.preparePreview()');
    const preview = [await js('foundation.previewState()')];
    await type('first'); preview.push(await js('foundation.previewState()'));
    const point = await js('foundation.previewPoint()');
    win.webContents.sendInputEvent({ type: 'mouseDown', ...point, button: 'left', clickCount: 1 });
    win.webContents.sendInputEvent({ type: 'mouseUp', ...point, button: 'left', clickCount: 1 });
    await delay(100); await js('foundation.caret(0)');
    report.previewFocusReturn = await js('foundation.previewState()');
    await type('second'); preview.push(await js('foundation.previewState()'));
    await js('foundation.contexts[1].setInlineStyle(foundation.contexts[1].editorElement.querySelector("#text"),"color","green")');
    preview.push(await js('foundation.previewState()'));
    await js('foundation.hidePreview(true)');
    await type('hidden'); preview.push(await js('foundation.previewState()'));
    await js('foundation.showPreview()'); preview.push(await js('foundation.previewState()'));
    preview.push(await js('foundation.previewState()'));
    report.preview = preview;
    if (preview[1].text !== 'Afirst' || preview[2].text !== 'Afirstsecond' || !preview[2].focusedEditor ||
        preview[2].caret !== 12 || preview[1].frames !== preview[0].frames + 1 || preview[2].frames !== report.previewFocusReturn.frames + 1 ||
        preview[3].frames !== preview[2].frames || preview[4].frames !== preview[3].frames ||
        preview[5].text !== 'Afirstsecondhidden' || preview[6].frames !== preview[5].frames) {
      throw new Error('Preview focus, ownership, visibility, or refresh count failed: ' + JSON.stringify(preview));
    }
    await js('foundation.reset();');
    report.states.push({ step: 'initial', value: await js('foundation.state()') });
    await type('one');
    report.states.push({ step: 'type one', value: await js('foundation.state()') });
    await js('foundation.contexts[0].setInlineStyle(foundation.contexts[0].editorElement.querySelector("#text"),"color","red");');
    report.states.push({ step: 'style red', value: await js('foundation.state()') });
    await type('two');
    report.states.push({ step: 'type two', value: await js('foundation.state()') });
    for (let i = 1; i <= 6; i++) { await key('Z', ['control']); report.states.push({ step: 'undo ' + i, value: await js('foundation.state()') }); }
    for (let i = 1; i <= 6; i++) { await key('Z', ['control', 'shift']); report.states.push({ step: 'redo ' + i, value: await js('foundation.state()') }); }
    await js('foundation.caret(1);'); await type('other');
    await js('foundation.caret(0);');
    await js(`(async () => {
      const source = await (await fetch('/__baseline/ShortcutSave.js')).text();
      const add = document.addEventListener;
      document.addEventListener = function(type, callback, options) {
        if (type === 'keydown') window.foundationLegacySaveListener = callback;
        return add.call(this,type,callback,options);
      };
      try { (0,eval)(source); } finally { document.addEventListener = add; }
    })()`);
    const baselineCount = await js('foundation.saves.length');
    await key('S', ['control']);
    report.baselineShortcutRequests = await js(`foundation.saves.length - ${baselineCount}`);
    await js("document.removeEventListener('keydown', window.foundationLegacySaveListener, false);");
    const count = await js('foundation.saves.length');
    await key('S', ['control']);
    report.shortcut = await js(`({requests:foundation.saves.slice(${count}),active:window.__nvActiveHtmlEditorContext.filePath})`);
    if (report.shortcut.requests.length !== 1 || report.shortcut.requests[0].path !== 'A.html') throw new Error('Ctrl+S ownership/request count failed: ' + JSON.stringify(report.shortcut));
    report.interactions = await js('foundation.measureInteractions()');
    report.inputs = await js('foundationDiagnostics.inputs');
    report.lifecycle = await js('({beforeMount:foundation.countsBeforeMount,beforeSwitches:foundation.countsBeforeSwitches,afterSwitches:foundation.countsAfterSwitches})');
    report.timings = await js('foundation.timings');
    report.toolbarCalls = await js('window.toolbarUpdates');
    report.refreshes = await js('({...foundation.refreshes.counts, liveEvents:foundation.liveEvents.length})');
    report.liveProviderCount = await js('window.NodevisionLiveFileContent.listProviders().length');
    report.final = await js('foundation.state()');
    // Expected three user operations: second typing run, style, first typing run.
    report.chronologicalUndoCoherent = ['Aone', 'Aone', 'A'].every((text, index) => {
      const state = report.states.find(s => s.step === 'undo ' + (index + 1)).value[0];
      return state.text === text && state.source.includes('color: red') === (index === 0);
    });
    report.composition = 'Not simulated: sendInputEvent does not establish an OS IME composition session.';
    await js('foundation.dispose();');
    report.lifecycle.remountCycles = await js('foundation.lifecycleCycles()');
    report.lifecycle.afterDispose = await js('foundationDiagnostics.counts()');
    report.providersAfterDispose = await js('window.NodevisionLiveFileContent.listProviders().length');
    fs.writeFileSync(path.join(root, 'docs/html-foundation-electron-results.json'), JSON.stringify(report, null, 2) + '\n');
    console.log('PASS: Electron workspace and native input experiment; chronological states recorded in docs/html-foundation-electron-results.json');
    app.exit(0);
  } catch (error) { console.error(error.stack); app.exit(1); }
  finally { server.close(); win?.destroy(); }
});
setTimeout(() => { console.error('Electron foundation test timed out'); app.exit(1); }, performanceMode ? 1200000 : historyMode ? 180000 : 60000).unref();
