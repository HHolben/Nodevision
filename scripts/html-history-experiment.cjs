// Native Electron sequences characterize history boundaries without changing user Notebook files.
module.exports = async function run({ win, js, key, type, delay }) {
  const report = { sequences: [], bare: [], performance: [] };
  const invoke = (method, ...args) => js(`historyExperiment.${method}(...${JSON.stringify(args)})`);
  const native = async direction => { win.webContents[direction](); await delay(80); };
  async function sequence(name, run) {
    const states = [], step = async (label, action) => { const result = await action?.(); await delay(30); states.push({ label, result, editors: await invoke('state') }); };
    await run(step); report.sequences.push({ name, states, traces: await invoke('trace') });
  }
  for (const [kind, unsafe] of [['properties', true], ['insertion', false], ['attribute', false], ['css', false], ['properties', false]]) {
    await sequence(kind + (unsafe ? ' diagnostic fence disabled' : ''), async step => {
      await invoke('reset', { sheet: kind === 'css' }); await step('initial');
      await step('type A', () => type('A'));
      await step('programmatic ' + kind, () => invoke('edit', kind, { unsafe, focus: kind === 'properties' ? 'properties' : '' }));
      await invoke('end', 0); await step('type B', () => type('B'));
      if (kind === 'properties' || kind === 'css') await step('Properties Undo', () => invoke('propertyUndo'));
      for (let i = 1; i <= 3; i++) await step('keyboard undo ' + i, () => key('Z', ['control']));
      for (let i = 1; i <= 3; i++) await step('keyboard redo ' + i, () => key('Z', ['control', 'shift']));
      if (kind === 'properties' || kind === 'css') await step('Properties Redo', () => invoke('propertyUndo', 'redo'));
    });
  }
  await sequence('retained editors and toolbar ownership', async step => {
    await invoke('reset'); await step('A types', () => type('A'));
    await step('A attribute through toolbar focus', () => invoke('edit', 'attribute', { focus: 'toolbar' }));
    await invoke('end', 1); await step('B types', () => type('B'));
    await invoke('end', 0); await step('A types again', () => type('C'));
    await step('toolbar undo A', () => invoke('toolbarUndo'));
    await invoke('end', 1); await step('Electron menu undo B', () => native('undo'));
    await invoke('end', 0); await step('Electron menu redo A', () => native('redo'));
  });
  await sequence('owned Properties versus native menu and execCommand entry points', async step => {
    await invoke('reset'); await type('A'); await invoke('edit', 'properties'); await invoke('end', 0); await type('B');
    await step('before menu undo'); await step('Electron menu undo', () => native('undo'));
    await step('direct execCommand undo', () => invoke('directUndo'));
  });
  await sequence('shared CSS rejects replay after another owner commits', async step => {
    await invoke('reset', { sheet: true }); await invoke('edit', 'css', { value: 'orange' }); await invoke('rememberOperation');
    await invoke('end', 1); await step('B commits shared CSS', () => invoke('edit', 'css', { value: 'blue' }));
    await invoke('end', 0); await step('A stale CSS undo refuses', async () => {
      const result = await invoke('undoRemembered'); if (!result.error) throw new Error('Stale shared CSS undo was allowed'); return result;
    });
  });
  await sequence('owned redo after a native branch', async step => {
    await invoke('reset'); await type('A'); await invoke('edit', 'style'); await invoke('end', 0); await type('B');
    await step('snapshot undo', () => invoke('rawProgrammaticUndo')); await invoke('end', 0);
    await step('new native branch C', () => type('C'));
    await step('owned redo refuses abandoned branch', () => invoke('rawProgrammaticUndo', 'redo'));
  });
  for (const kind of ['attribute', 'insertHTML', 'foreColor', 'replace']) {
    await invoke('bareReset'); const states = [];
    const step = async (label, action) => { await action?.(); states.push({ label, ...await invoke('bareState') }); };
    await step('type A', () => type('A')); await step(kind, () => invoke('bareCommand', kind));
    await step('type B', () => type('B'));
    for (let i = 1; i <= 3; i++) await step('native undo ' + i, () => native('undo'));
    for (let i = 1; i <= 3; i++) await step('native redo ' + i, () => native('redo'));
    report.bare.push({ kind, states, trace: await invoke('trace') });
  }
  await invoke('bareReset'); await type('A'); await invoke('bareCommand', 'attribute'); await type('B');
  const before = await invoke('bareState'); await invoke('intercept', true); await native('undo');
  const intercepted = await invoke('bareState'); await invoke('intercept', false); await native('undo');
  report.interception = { before, intercepted, nativeUndo: await invoke('bareState'), trace: await invoke('trace') };
  if (before.html !== intercepted.html) throw new Error('Cancelable native menu undo interception failed');
  await invoke('bareReset'); await type('A'); await invoke('bareFocus', 1); await type('B'); await invoke('bareFocus', 0);
  report.nativeOwner = { before: await invoke('bareState') }; await native('undo'); report.nativeOwner.after = await invoke('bareState');
  // Explicit ledger experiment: remove the scripted attribute in place, then ask native history to undo typing.
  await invoke('bareReset'); await type('A'); await invoke('bareCommand', 'attribute'); await type('B');
  const ledger = [{ label: 'A/style/B', ...await invoke('bareState') }];
  await native('undo'); ledger.push({ label: 'undo presumed B run', ...await invoke('bareState') });
  await invoke('bareCommand', 'reverseAttribute'); ledger.push({ label: 'reverse scripted attribute', ...await invoke('bareState') });
  await native('undo'); ledger.push({ label: 'undo presumed A run', ...await invoke('bareState') });
  await type('C'); await native('redo'); ledger.push({ label: 'branch C then redo', ...await invoke('bareState') }); report.ledger = ledger;
  // Native deletion, clipboard paste, and composition use Electron/Chromium input, not dispatchEvent.
  await sequence('native deletion paste and composition', async step => {
    await invoke('reset'); await step('type text', () => type('hello'));
    await step('backspace', () => key('Backspace'));
    const { clipboard } = require('electron'), previous = clipboard.readText();
    try { clipboard.writeText('PASTE'); await step('paste', () => native('paste')); } finally { clipboard.writeText(previous); }
    win.webContents.debugger.attach('1.3');
    try {
      await step('composition draft', () => win.webContents.debugger.sendCommand('Input.imeSetComposition', { text: 'に', selectionStart: 1, selectionEnd: 1 }));
      await step('graphical edit during composition refused', async () => {
        try { await invoke('edit', 'style'); throw new Error('Composition guard failed'); }
        catch (error) { if (!/Finish text composition/.test(error.message)) throw error; return { refused: true }; }
      });
      await step('composition replacement', () => win.webContents.debugger.sendCommand('Input.imeSetComposition', { text: '日本', selectionStart: 2, selectionEnd: 2 }));
      await step('composition commit', () => win.webContents.debugger.sendCommand('Input.insertText', { text: '日本' }));
    } finally { win.webContents.debugger.detach(); }
    for (let i = 1; i <= 4; i++) await step('undo ' + i, () => key('Z', ['control']));
  });
  for (const paragraphs of [0, 2000]) for (const instrument of [false, true]) {
    await invoke('reset', { paragraphs, fragmented: !!paragraphs, instrument });
    const before = await invoke('startPerformance'); await type('abcdefghijklmnopqrstuvwxyz'.repeat(4));
    const typed = await invoke('endPerformance'), start = Date.now(); await invoke('edit', 'style'); const commitMs = Date.now() - start;
    const time = async direction => { const at = Date.now(); await invoke('toolbarUndo', direction); return Date.now() - at; };
    const undoMs = await time('undo'), redoMs = await time('redo');
    report.performance.push({ paragraphs, fragmented: !!paragraphs, instrument, before, typed, commitMs, undoMs, redoMs, trace: await invoke('trace') });
  }
  await invoke('reset', { instrument: true });
  win.webContents.debugger.attach('1.3');
  try {
    await win.webContents.debugger.sendCommand('HeapProfiler.collectGarbage');
    const before = await win.webContents.debugger.sendCommand('Runtime.getHeapUsage');
    await invoke('startPerformance');
    for (let i = 0; i < 1000; i++) { win.webContents.sendInputEvent({ type: 'char', keyCode: 'a' }); await delay(4); }
    await delay(100);
    await win.webContents.debugger.sendCommand('HeapProfiler.collectGarbage');
    report.longTyping = { characters: 1000, before, after: await win.webContents.debugger.sendCommand('Runtime.getHeapUsage'),
      performance: await invoke('endPerformance'), trace: await invoke('trace') };
  } finally { win.webContents.debugger.detach(); }
  const original = report.sequences.find(sequence => sequence.name === 'properties diagnostic fence disabled');
  const chronological = ['Properties Undo', 'keyboard undo 1', 'keyboard undo 2'].map(label => original.states.find(state => state.label === label).editors[0]);
  report.chronologicalInlineUndo = ['xA','xA','x'].every((text,i) => chronological[i].text === text) &&
    chronological.every((state,i) => state.element.includes('color: red') === (i === 0));
  if (!report.chronologicalInlineUndo) throw new Error('Owned Properties chronology failed');
  for (const sequence of report.sequences) for (const state of sequence.states) for (const editor of state.editors) {
    if (!editor.source.includes('lang="en"') || !editor.source.includes('class="authored"') || !editor.source.includes('src="example.js" defer') || /data-nv-(origin|chrome)-/.test(editor.source)) throw new Error('History diagnostic regressed source shell/provenance');
  }
  await invoke('dispose'); return report;
};
