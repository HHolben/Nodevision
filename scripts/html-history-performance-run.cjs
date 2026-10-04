// Native-input matrix with CDP renderer timings and isolated before/after output.
const fs=require('node:fs');
module.exports=async({win,js,key,type,delay})=>{
  const report={matrix:[],method:'Native Electron input; rAF presentation proxies and CDP layout/style metrics.'};
  win.webContents.debugger.attach('1.3');
  const cdp=(name,args={})=>win.webContents.debugger.sendCommand(name,args);
  await cdp('Performance.enable');
  const metrics=async()=>Object.fromEntries((await cdp('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
  const heap=async()=>{await cdp('HeapProfiler.collectGarbage');return {...await cdp('Runtime.getHeapUsage'),...await cdp('Memory.getDOMCounters')};};
  const measure=async(label,run,settle=Number(process.env.NV_HTML_PERF_SETTLE_MS || 560))=>{
    await js('historyPerf.resetMetrics()');const before=await metrics(),start=Date.now();const result=await run();await delay(settle);
    const after=await metrics(), data=await js('historyPerf.snapshot()');
    return {label,wallMs:Date.now()-start,result,...data,renderer:Object.fromEntries(['LayoutDuration','RecalcStyleDuration','ScriptDuration','TaskDuration','LayoutCount','RecalcStyleCount'].map(k=>[k,after[k]-before[k]]))};
  };
  const sizes=process.env.NV_HTML_PERF_TRACES ? [] : process.env.NV_HTML_PERF_QUICK ? [1000,20000] : [1000,10000,20000,40000];
  const configs=process.env.NV_HTML_PERF_QUICK ? ['editor','heavy'] : ['editor','fileview','layers','properties','heavy','retained'];
  for(const words of sizes) for(const fragmented of [false,true]) for(const config of configs){
    const caseName=words+':'+(fragmented?'fragmented':'clean')+':'+config;
    if(process.env.NV_HTML_PERF_CASE && process.env.NV_HTML_PERF_CASE!==caseName)continue;
    if(report.matrix.length){await win.loadURL(win.webContents.getURL());for(let i=0;i<200&&!await js('!!window.historyPerf?.ready');i++)await delay(50);}
    const fixture=await js(`historyPerf.configure(${words},${fragmented},${JSON.stringify(config)})`),before=await heap();
    const typing=await measure('typing',()=>type('abcdefghijklmnopqrstuvwxyzabcdefghijklmn')),operations=[];
    const replay=async kind=>{for(const direction of ['undo','redo'])operations.push(await measure(kind+' '+direction,()=>js(`historyPerf.history('${direction}')`)));};
    if(typing.history.undoEntries!==1)throw new Error('Typing did not form one entry: '+JSON.stringify(fixture));
    await replay('typing');
    operations.push(await measure('backspace',async()=>{for(let i=0;i<4;i++)await key('Backspace');}));await replay('deletion');
    await js('historyPerf.caret(undefined,1)');
    operations.push(await measure('delete',async()=>{for(let i=0;i<3;i++)await key('Delete');}));
    operations.push(await measure('caret move and type',async()=>{await key('Right');await type('move');}));
    operations.push(await measure('boundary',()=>js('historyPerf.prepare("boundary")')));
    const {clipboard}=require('electron');clipboard.writeHTML('<p>'+('moderate pasted fragment '.repeat(100))+'</p>');
    operations.push(await measure('paste',async()=>{win.webContents.paste();await delay(50);}));await replay('paste');
    for(const kind of ['properties','insertion','structure']){operations.push(await measure(kind+' commit',()=>js(`historyPerf.prepare('${kind}')`)));await replay(kind);}
    const after=await heap();report.matrix.push({fixture,typing,operations,memory:{before,after}});
    console.log('matrix',words,fragmented?'fragmented':'clean',config,'complete');
    fs.writeFileSync('/tmp/html-history-performance-progress-'+(process.env.NV_HTML_PERF_LABEL||'after')+'.json',JSON.stringify(report));
  }
  if(!process.env.NV_HTML_PERF_BASELINE)report.replayInvariantChecks=require('./html-history-performance-checks.cjs')(report);
  if(!process.env.NV_HTML_PERF_QUICK){
    if(!process.env.NV_HTML_PERF_TRACES)report.longSession=await require('./html-history-performance-session.cjs')({win,js,key,type,delay,measure,heap,cdp});
    report.traces=await require('./html-history-performance-trace.cjs')({win,js,type,delay,cdp});
  }
  await js('historyPerf.dispose()');await delay(700);report.disposed=await heap();report.lifecycle=await js('foundationDiagnostics.counts()');
  win.webContents.debugger.detach();return report;
};
