// Nodevision/scripts/profile-terrain-e1-electron.cjs
// This probe attempts native Electron graphics and records the actual adapter and timer-query support. It removes the agent environment's run-as-Node flag in a child process so a Node-only invocation cannot be mistaken for a native desktop test.
if(!process.versions.electron){
 const {spawn}=require('node:child_process'),path=require('node:path'),env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
 const child=spawn(path.resolve('node_modules/electron/dist/electron'),['--no-sandbox',__filename],{env,stdio:'inherit'});child.on('exit',code=>{process.exitCode=code??1;});
}else{
 const {app,BrowserWindow}=require('electron');
 setTimeout(()=>{console.error('Native graphics probe timed out');app.exit(1);},15000).unref();
 app.whenReady().then(async()=>{
  const window=new BrowserWindow({show:false});await window.loadURL('data:text/html,<canvas id="c"></canvas>');
  console.log(JSON.stringify({features:app.getGPUFeatureStatus(),gpu:await app.getGPUInfo('basic'),webgl:await window.webContents.executeJavaScript('(()=>{const g=document.querySelector("canvas").getContext("webgl2");return g?{renderer:g.getParameter(g.RENDERER),timer:!!g.getExtension("EXT_disjoint_timer_query_webgl2")}:null})()')}));app.quit();
 });
}
