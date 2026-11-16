// Isolated desktop Electron GameView fixture, without login or the user's Notebook.
const {app,BrowserWindow}=require('electron');
const fs=require('node:fs/promises');
const url=process.argv.find(v=>v.startsWith('http://'));
app.setPath('userData',process.argv[process.argv.indexOf(url)+1]);
app.commandLine.appendSwitch('enable-unsafe-swiftshader');app.commandLine.appendSwitch('use-angle','swiftshader');app.commandLine.appendSwitch('disable-dev-shm-usage');
let win,timeout;
console.log('Desktop runner starting',url);
timeout=setTimeout(()=>{console.error('Native fixture timed out');app.exit(1);},180000);
app.whenReady().then(async()=>{
 console.log('Electron ready');
 try{
  win=new BrowserWindow({width:1000,height:800,show:true,webPreferences:{contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
  console.log('Loading fixture');await win.loadURL(url);win.focus();console.log('Fixture loaded');
  win.webContents.debugger.attach('1.3');const send=(method,params={})=>win.webContents.debugger.sendCommand(method,params);
  win.webContents.debugger.on('message',(_e,method,params)=>{if(method==='Runtime.exceptionThrown')console.error(JSON.stringify(params.exceptionDetails));});
  await send('Runtime.enable');

  const {runArcheryInput}=await import('./archery-chromium-input.mjs');
  await runArcheryInput(send);
  const result=await win.webContents.executeJavaScript('document.querySelector("#result").textContent');console.log(result);
  await fs.writeFile('/tmp/nodevision-m14-native-results.txt',result+'\n');clearTimeout(timeout);app.exit(result.startsWith('PASS:')?0:1);
 }catch(e){console.error(e);clearTimeout(timeout);app.exit(1);}
});
