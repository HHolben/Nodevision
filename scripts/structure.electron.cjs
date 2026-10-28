// Nodevision/scripts/structure.electron.cjs
// Runs structure insertion against the real HTML editor and verifies print media.
// Browser regression harness: real editor/media/world modules, in-memory Notebook I/O.
const {app,BrowserWindow}=require('electron');
const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');

const stubs={
 '/panels/createToolbar.mjs':'export function updateToolbarState(p){Object.assign(window.NodevisionState,p)}',
 '/panels/panelFactory.mjs':`export async function createPanelDOM(type,id){const panel=document.createElement('div');panel.className='panel';panel.dataset.instanceId=id;const content=document.createElement('div');panel.append(content);return {panel,content};}`,
 '/TemplateSystem/NodevisionOverlayPanel.mjs':'export function openNodevisionOverlayPanel(){}',
 '/panels/workspace.mjs':'export function ensureAdjacentPanelCell(){return null;} export function ensureSvgEditorModeLayout(){} export function rebuildLayoutDividersForContainer(){} export async function loadPanelIntoCell(){}',
};
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost').pathname;
 if(url==='/'){res.setHeader('Content-Type','text/html');res.end('<div id="editor" style="width:900px;height:600px"></div><pre id="result">RUNNING</pre><script type="module" src="/scripts/'+'structure-browser.mjs'+'"></script>');return;}
 if(url.endsWith('.png')){res.setHeader('Content-Type','image/png');res.end(Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64'));return;}
 if(url==='/Notebook/blocked.html'){res.setHeader('X-Frame-Options','DENY');res.setHeader('Content-Type','text/html');res.end('blocked');return;}
 if(url.startsWith('/Notebook/')){res.setHeader('Content-Type','text/html');res.end('<p>Embedded Notebook fixture</p>');return;}
 if(stubs[url]){res.setHeader('Content-Type','text/javascript');res.end(stubs[url]);return;}
 const file=path.resolve(url.startsWith('/scripts/')?root:path.join(root,'ApplicationSystem/public'),'.'+url);
 if(!file.startsWith(root+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()){res.writeHead(404);res.end();return;}
 res.setHeader('Content-Type',({'.mjs':'text/javascript','.js':'text/javascript','.css':'text/css','.json':'application/json','.csv':'text/csv'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));
});
app.disableHardwareAcceleration();app.commandLine.appendSwitch('no-sandbox');
app.whenReady().then(async()=>{let win;try{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));win=new BrowserWindow({show:true,width:1200,height:1000,webPreferences:{backgroundThrottling:false}});
 win.webContents.on('console-message',(_e,level,message)=>{if(level>=2)console.log(message)});
 await win.loadURL(`http://127.0.0.1:${server.address().port}`);
 for(let n=0;n<600;n++){const result=await win.webContents.executeJavaScript('window.structureResult');if(result){if (!result.error) { win.webContents.debugger.attach('1.3'); await win.webContents.debugger.sendCommand('Emulation.setEmulatedMedia',{media:'print'}); const hidden=await win.webContents.executeJavaScript("getComputedStyle(document.querySelector('.nodevision-sensitive')).display === 'none'"); if (!hidden) throw Error('Sensitive field is visible in print media'); result.checks.push('Sensitive field hidden under actual print media'); } console.log(JSON.stringify(result,null,2));process.exitCode=result.error?1:0;return;}await new Promise(r=>setTimeout(r,100));}throw Error('Timed out');
 }catch(e){console.error(e);process.exitCode=1;}finally{win?.destroy();server.close();app.exit(process.exitCode||0);}});
