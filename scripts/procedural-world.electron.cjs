// Nodevision/scripts/procedural-world.electron.cjs
// This runner uses the existing Electron local-server browser harness pattern to verify real procedural Game View integration.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const root = path.resolve(__dirname, '..');
const browserModule = process.env.NV_WORLD_BROWSER || 'procedural-world-browser.mjs';
const stubs = {
  '/panels/createToolbar.mjs': 'export function updateToolbarState(patch){Object.assign(window.NodevisionState,patch)}',
  '/panels/panelFactory.mjs': 'export function createPanelDOM(){return document.createElement("div")}',
  '/panels/workspace.mjs': 'export function ensureSvgEditorModeLayout(){} export function rebuildLayoutDividersForContainer(){} export function loadPanelIntoCell(){}',
  '/TemplateSystem/NodevisionOverlayPanel.mjs': 'export function openNodevisionOverlayPanel(){}',
  '/ToolbarJSONfiles/insertMediaPanel.mjs': 'export function registerSvgEditorContextForInsertMedia(){return {dispose(){}}}',
};
if (browserModule === 'sandbox-session-browser.mjs') {
  stubs['/panels/workspace.mjs'] = `
    export { ensureSvgEditingSplit } from '/panels/workspaceParts/workspaceSvgSplit.mjs';
    export function ensureSvgEditorModeLayout(){}
    export function rebuildLayoutDividersForContainer(){}
    export async function loadPanelIntoCell(type,vars){
      const {openPanelTabInCell}=await import('/panels/panelTabs.mjs');
      const cell=window.activeCell.closest('.panel-cell');
      return openPanelTabInCell(cell,{panelType:type,panelClass:vars.panelClass||'InfoPanel',panelVars:vars,allowDuplicate:vars.allowDuplicateTab},async(host)=>{
        if(type==='GameView')await(await import('/PanelInstances/ViewPanels/GameView.mjs')).setupPanel(host,vars);
        else host.textContent='MetaWorld Layers';
      });
    }`;
  stubs['/TemplateSystem/NodevisionOverlayPanel.mjs'] = 'export async function openNodevisionOverlayPanel(type,options){window.fixtureSessionError=options.message; console.error(options.message);return "quit";}';
}
const server = http.createServer((req,res)=>{
  const url = new URL(req.url,'http://localhost').pathname;
  if(url==='/'){res.setHeader('Content-Type','text/html');res.end(('<div class="panel-cell"><div id="editor" style="width:800px;height:600px"></div></div><pre id="result">RUNNING</pre><script type="module" src="/scripts/procedural-world-browser.mjs"></script>').replace('procedural-world-browser.mjs',browserModule));return;}
  if (url.startsWith('/sandbox-builtins/')) {
    const name=path.basename(url);
    if (!['SandboxBuild.NodevisionSession.js','SandboxPlay.NodevisionSession.js'].includes(name)) {res.writeHead(404);res.end();return;}
    res.end(fs.readFileSync(path.join(root,'ApplicationSystem/Sessions/BuiltIn',name)));return;
  }
  if(stubs[url]){res.setHeader('Content-Type','text/javascript');res.end(stubs[url]);return;}
  const file=path.resolve(url.startsWith('/scripts/')?root:path.join(root,'ApplicationSystem/public'),'.'+url);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',/\.(mjs|js)$/.test(file)?'text/javascript':file.endsWith('.css')?'text/css':'text/plain');res.end(fs.readFileSync(file));
});
app.commandLine.appendSwitch('no-sandbox');
app.commandLine.appendSwitch('use-angle', 'swiftshader');
app.commandLine.appendSwitch('enable-unsafe-swiftshader');
app.whenReady().then(async()=>{
  try {
    await new Promise(r=>server.listen(0,'127.0.0.1',r));
    const win=new BrowserWindow({width:1000,height:800,show:true});
    win.webContents.on('console-message',(_e,level,message)=>{if(level>=2)console.log(message)});
    await win.loadURL('http://127.0.0.1:'+server.address().port);
    for(let i=0;i<600;i++){
      const result=await win.webContents.executeJavaScript('document.getElementById("result").textContent');
      if(result!=='RUNNING'){console.log(result); if (result.startsWith('PASS:') && browserModule === 'procedural-world-browser.mjs') fs.writeFileSync(path.join(root,'docs/procedural-voxel-performance.json'),JSON.stringify(await win.webContents.executeJavaScript('window.proceduralReport'),null,2)+'\n');app.exit(result.startsWith('PASS:')?0:1);return;}
      await new Promise(r=>setTimeout(r,100));
    }
    throw new Error('World runtime timed out');
  }catch(error){console.error(error);app.exit(1);}finally{server.close();}
});
