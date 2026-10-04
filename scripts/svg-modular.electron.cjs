// Run the real SVG runtime with isolated application-shell stubs and a local HTTP server.
const { app, BrowserWindow } = require('electron');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const root = path.resolve(__dirname, '..');
const stubs = {
  '/panels/createToolbar.mjs': 'export function updateToolbarState(patch){Object.assign(window.NodevisionState,patch)}',
  '/panels/panelFactory.mjs': 'export function createPanelDOM(){return document.createElement("div")}',
  '/panels/workspace.mjs': 'export function ensureSvgEditorModeLayout(){} export function rebuildLayoutDividersForContainer(){} export function loadPanelIntoCell(){}',
  '/TemplateSystem/NodevisionOverlayPanel.mjs': 'export function openNodevisionOverlayPanel(){}',
  '/ToolbarJSONfiles/insertMediaPanel.mjs': 'export function registerSvgEditorContextForInsertMedia(){return {dispose(){}}}',
};
const server = http.createServer((req,res)=>{
  const url = new URL(req.url,'http://localhost').pathname;
  if(url==='/'){res.setHeader('Content-Type','text/html');res.end('<div class="panel-cell"><div id="editor" style="width:800px;height:600px"></div></div><pre id="result">RUNNING</pre><script type="module" src="/scripts/svg-modular-browser.mjs"></script>');return;}
  if(stubs[url]){res.setHeader('Content-Type','text/javascript');res.end(stubs[url]);return;}
  const file=path.resolve(url.startsWith('/scripts/')?root:path.join(root,'ApplicationSystem/public'),'.'+url);
  if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Type',/\.(mjs|js)$/.test(file)?'text/javascript':file.endsWith('.css')?'text/css':'text/plain');res.end(fs.readFileSync(file));
});
app.disableHardwareAcceleration();app.commandLine.appendSwitch('no-sandbox');
app.whenReady().then(async()=>{
  try {
    await new Promise(r=>server.listen(0,'127.0.0.1',r));
    const win=new BrowserWindow({width:1000,height:800,show:true});
    win.webContents.on('console-message',(_e,level,message)=>{if(level>=2)console.log(message)});
    await win.loadURL('http://127.0.0.1:'+server.address().port);
    for(let i=0;i<200;i++){
      const result=await win.webContents.executeJavaScript('document.getElementById("result").textContent');
      if(result!=='RUNNING'){console.log(result);app.exit(result.startsWith('PASS:')?0:1);return;}
      await new Promise(r=>setTimeout(r,100));
    }
    throw new Error('SVG runtime timed out');
  }catch(error){console.error(error);app.exit(1);}finally{server.close();}
});
