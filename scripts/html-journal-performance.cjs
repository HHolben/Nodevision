// This opt-in Electron benchmark measures bounded journal storage and native typing latency in the retained-editor workspace.
module.exports = async ({ win, js, type, delay }) => {
  const results = [];
  win.webContents.debugger.attach('1.3');
  const heap = async () => { await win.webContents.debugger.sendCommand('HeapProfiler.collectGarbage'); return win.webContents.debugger.sendCommand('Runtime.getHeapUsage'); };
  for (const [label, paragraphs, fragmented] of [['small', 0, false], ['20k words', 10000, false], ['fragmented', 2000, true], ['fragmented stress', 7000, true]]) {
    await js(`historyExperiment.reset({paragraphs:${paragraphs},fragmented:${fragmented},instrument:false})`); await delay(200);
    const beforeHeap = await heap();
    const beforeRefresh = await js('({...foundation.refreshes.counts,toolbar:window.toolbarUpdates})');
    await js('foundationDiagnostics.inputs.length=0; foundation.contexts[0].editorElement.__nvProgrammaticHistory.measure()');
    await type('abcdefghijklmnopqrstuvwxyz'.repeat(4)); await delay(100);
    const typing = await js('({storage:foundation.contexts[0].editorElement.__nvProgrammaticHistory.inspect(),paint:foundationDiagnostics.inputs.slice(),handlers:structuredClone(foundation.contexts[0].editorElement.__nvProgrammaticHistory.measurements)})');
    const afterRefresh = await js('({...foundation.refreshes.counts,toolbar:window.toolbarUpdates})');
    const commit = await js('(async()=>{const start=performance.now(); await historyExperiment.edit("properties"); return performance.now()-start;})()');
    await js('foundation.contexts[0].editorElement.__nvProgrammaticHistory.undo(); foundation.contexts[0].editorElement.__nvProgrammaticHistory.redo()');
    const measures = await js('structuredClone(foundation.contexts[0].editorElement.__nvProgrammaticHistory.measurements)');
    const afterHeap = await heap();
    results.push({ label, typing, beforeRefresh, afterRefresh, propertiesCommitMs:commit, measures, heapGrowth:afterHeap.usedSize-beforeHeap.usedSize, embedderGrowth:afterHeap.embedderHeapUsedSize-beforeHeap.embedderHeapUsedSize });
  }
  await js('historyExperiment.reset({instrument:false})');
  // A long uninterrupted native run should retain first/last text, not all intermediate values.
  for (let i=0;i<1000;i++) { win.webContents.sendInputEvent({type:'char',keyCode:'a'}); await delay(2); }
  const longTyping = await js('foundation.contexts[0].editorElement.__nvProgrammaticHistory.inspect()');
  const { clipboard } = require('electron'); clipboard.writeText('large paste '.repeat(10000)); win.webContents.paste(); await delay(200);
  const paste = await js('foundation.contexts[0].editorElement.__nvProgrammaticHistory.inspect()');
  await js(`(() => { const c=foundation.contexts[0]; for(let i=0;i<150;i++) c.setInlineStyle(c.editorElement.querySelector('#text'),'margin-left',i+'px'); })()`);
  const graphical = await js('foundation.contexts[0].editorElement.__nvProgrammaticHistory.inspect()');
  if (graphical.undoEntries > graphical.maxEntries || graphical.retainedBytes > graphical.maxBytes) throw new Error('history bounds exceeded');
  await js(`(() => {const c=foundation.contexts[0]; c.transactions.run('large table',()=>{ const t=document.createElement('table');t.innerHTML='<tbody>'+('<tr>'+ '<td>cell</td>'.repeat(30)+'</tr>').repeat(100)+'</tbody>'; c.editorElement.append(t); });})()`);
  const table = await js('foundation.contexts[0].editorElement.__nvProgrammaticHistory.inspect()');
  await js('foundation.contexts[0].editorElement.__nvProgrammaticHistory.undo();foundation.contexts[0].editorElement.__nvProgrammaticHistory.redo()');
  if (!await js('!!foundation.contexts[0].editorElement.querySelector("table")')) throw new Error('eviction corrupted remaining replay');
  win.webContents.debugger.detach(); return { results, storage: {longTyping,paste,graphical,table} };
};
