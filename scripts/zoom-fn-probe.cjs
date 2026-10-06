// Nodevision/scripts/zoom-fn-probe.cjs
// This Electron probe records browser-visible modifiers and tests Electron's Fn injection support without claiming that synthetic input proves a physical keyboard exposes Fn.
const { app, BrowserWindow } = require('electron');
app.commandLine.appendSwitch('no-sandbox');
app.whenReady().then(async () => {
  const window = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
  await window.loadURL('data:text/html,<textarea autofocus></textarea>');
  await window.webContents.executeJavaScript(`window.probeEvents=[];document.addEventListener('keydown',e=>probeEvents.push({key:e.key,code:e.code,ctrl:e.ctrlKey,alt:e.altKey,shift:e.shiftKey,fn:e.getModifierState('Fn'),trusted:e.isTrusted}));`);
  const attempts = [];
  for (const keyCode of ['Fn', 'A', 'F1']) {
    try { window.webContents.sendInputEvent({type:'keyDown',keyCode,modifiers:['control','alt']}); attempts.push({keyCode,accepted:true}); }
    catch(error) { attempts.push({keyCode,accepted:false,error:error.message}); }
  }
  await new Promise(resolve=>setTimeout(resolve,100));
  const events = await window.webContents.executeJavaScript('probeEvents');
  console.log(JSON.stringify({platform:process.platform,electron:process.versions.electron,chromium:process.versions.chrome,attempts,events,physicalFn:'Not measured: no physical keyboard interaction is available to this automated probe.'},null,2));
  window.destroy();app.quit();
}).catch(error=>{console.error(error);app.exit(1);});
