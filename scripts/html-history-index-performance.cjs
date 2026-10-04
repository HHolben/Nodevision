// Run selected measurements in the real index-page app and real toolbar using an isolated temporary runtime root.
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http');
const repo=process.cwd(), runtimeRoot=fs.mkdtempSync('/tmp/nodevision-html-index-');
process.env.NODEVISION_ROOT=runtimeRoot;process.env.NODEVISION_PHP_ENABLED='0';
const delay=ms=>new Promise(r=>setTimeout(r,ms));
app.on('window-all-closed',()=>{});
app.disableHardwareAcceleration();app.commandLine.appendSwitch('no-sandbox');
app.whenReady().then(async()=>{
 let server,win;
 try{
  fs.symlinkSync(path.join(repo,'ApplicationSystem'),path.join(runtimeRoot,'ApplicationSystem'),'dir');
  const {default:createApp}=await import('../ApplicationSystem/server.mjs');
  const application=await createApp({runtimeRoot,nodeModulesDir:path.join(repo,'node_modules'),host:'127.0.0.1',port:0,phpEnabled:false});
  let before=false;
  const baselineSources=require('./html-history-performance-baseline.cjs')(repo);
  server=http.createServer((req,res)=>{
    const url=new URL(req.url,'http://localhost').pathname;
    let file;
    if(url.startsWith('/scripts/'))file=path.join(repo,url);
    if(before && baselineSources[path.basename(url)]){res.setHeader('Content-Type','text/javascript');res.end(baselineSources[path.basename(url)]);return;}
    if(file){res.setHeader('Content-Type','text/javascript');res.setHeader('Cache-Control','no-store');res.end(fs.readFileSync(file));return;}
    application(req,res);
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+server.address().port;
  const output={environment:process.versions,runtime:'Actual index.html, real toolbar and attention subscribers; temporary server/account storage.',results:[]};
  for(const phase of (process.env.NV_HTML_INDEX_NORMAL ? ['after'] : ['before','after'])){
    before=phase==='before';win=new BrowserWindow({width:1400,height:1000,show:true,webPreferences:{backgroundThrottling:false,partition:'html-index-'+phase}});
    const js=s=>win.webContents.executeJavaScript(s,true);
    await win.loadURL(origin);
    await js(`fetch('/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'admin',password:'admin'})})`);
    await win.loadURL(origin);await delay(6000);
    const boot=await js('({hidden:document.getElementById("app-shell").classList.contains("hidden"),toolbar:document.getElementById("global-toolbar").childElementCount})');
    if(boot.hidden||!boot.toolbar)throw new Error('Actual workspace did not boot: '+JSON.stringify(boot));
    await js(`(async()=>{
      const tabs=await import('/panels/panelTabs.mjs');document.querySelectorAll('.panel-cell').forEach(c=>tabs.closePanelTabsInCell(c));
      const workspace=document.getElementById('workspace');workspace.innerHTML='<div style="display:flex;width:100%"><div id="editor" style="width:65%;height:550px"></div><div id="viewer" style="width:35%;height:550px"></div></div><div id="layers" style="height:200px;overflow:auto"></div><pre id="result"></pre>';
      workspace.style.cssText='display:block;overflow:auto;flex:1';
      window.historyPerfNormalPanels=${Boolean(process.env.NV_HTML_INDEX_NORMAL)};
      workspace.querySelector('#layers').className='panel-cell';
      await import('/scripts/html-history-performance-browser.mjs');
      window.indexAttentionCommits=0;window.addEventListener("nv-editor-attention-changed",()=>window.indexAttentionCommits++);
      window.indexToolbarRebuilds=0;new MutationObserver(()=>window.indexToolbarRebuilds++).observe(document.getElementById('global-toolbar'),{childList:true});
    })()`);
    for(const fragmented of [false,true])for(const config of (process.env.NV_HTML_INDEX_NORMAL ? ['heavy'] : ['editor','heavy'])){
      const settle=async()=>{const start=Date.now();let previewWaitMs=null;if(config==='heavy'){for(let i=0;i<200&&!await js('historyPerf.previewMatches()');i++)await delay(25);if(!await js('historyPerf.previewMatches()'))throw new Error('Live preview did not match the editor');previewWaitMs=Date.now()-start;}await delay(700);return previewWaitMs;};
      const fixture=await js(`historyPerf.configure(20000,${fragmented},'${config}')`);
      await js('historyPerf.resetMetrics();window.indexToolbarRebuilds=0;window.indexAttentionCommits=0');
      for(const letter of 'abcdefghijklmnopqrstuvwxyz'){win.webContents.sendInputEvent({type:'keyDown',keyCode:letter});win.webContents.sendInputEvent({type:'char',keyCode:letter});win.webContents.sendInputEvent({type:'keyUp',keyCode:letter});await delay(30);}
      const previewWaitMs=await settle();const typing=await js('({...historyPerf.snapshot(),toolbarRebuilds:window.indexToolbarRebuilds,attentionCommits:window.indexAttentionCommits})');
      if(typing.history.undoEntries!==1)throw new Error('Index typing did not coalesce into one entry');
      const replay=[];
      const properties=[];
      for(let i=0;i<3;i++)for(const direction of ['undo','redo']){
        await js('historyPerf.resetMetrics();window.indexToolbarRebuilds=0;window.indexAttentionCommits=0');const ms=await js(`(()=>{const start=performance.now();window.replayFrames={};requestAnimationFrame(()=>{replayFrames.firstRafMs=performance.now()-start;requestAnimationFrame(()=>replayFrames.secondRafMs=performance.now()-start);});return historyPerf.history('${direction}');})()`);const previewWaitMs=await settle();
        replay.push({direction,ms,previewWaitMs,frames:await js('window.replayFrames'),...await js('({...historyPerf.snapshot(),toolbarRebuilds:window.indexToolbarRebuilds,attentionCommits:window.indexAttentionCommits})')});
        if(direction==='undo'&&replay.at(-1).history.redoEntries!==1)throw new Error('Index undo did not take effect');
      }
      await js('historyPerf.prepare("properties")');await settle();
      for(const direction of ['undo','redo']){
        await js('historyPerf.resetMetrics();window.indexToolbarRebuilds=0;window.indexAttentionCommits=0');
        const start=Date.now(),ms=await js(`historyPerf.history('${direction}')`),previewWaitMs=await settle();
        const sample={direction,ms,previewWaitMs,completionMs:Date.now()-start,...await js('({...historyPerf.snapshot(),toolbarRebuilds:window.indexToolbarRebuilds,attentionCommits:window.indexAttentionCommits})')};
        properties.push(sample);
      }
      if(phase==='after')for(const sample of [...replay,...properties]){
        if(sample.probes.counts.revisions!==1 || (sample.probes.counts.livePublications||0)>1 || sample.refresh.viewerFramesMounted>1 || !sample.focused)throw new Error('Index replay invariant failed: '+JSON.stringify(sample));
      }
      output.results.push({phase,fixture,typing,previewWaitMs,replay,properties});console.log('index',phase,fragmented,config,'complete');
    }
    await js('historyPerf.dispose()');win.destroy();win=null;
  }
  fs.writeFileSync(path.join(repo,process.env.NV_HTML_INDEX_NORMAL ? 'docs/html-history-performance-index-normal.json' : 'docs/html-history-performance-index.json'),JSON.stringify(output,null,2)+'\n');
  console.log('PASS: actual index-page comparison');app.exit(0);
 }catch(error){console.error(error.stack);app.exit(1);}finally{win?.destroy();server?.close();}
});
setTimeout(()=>{console.error('index performance timeout');app.exit(1);},240000).unref();
