// Nodevision/ApplicationSystem/tests/grayscaleAnalysis.electron.cjs
// This isolated browser harness serves generated PNG and JPEG fixtures and the real analysis modules. It validates image decoding and worker-backed UI workflows without creating or changing Notebook files.
const { app, BrowserWindow } = require('electron');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'nv-grayscale-test-'));
app.setPath('userData', profile);
const assets = new Map(), errors = [];
const root = path.resolve('ApplicationSystem');
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (assets.has(pathname)) { const asset = assets.get(pathname); res.setHeader('Content-Type', asset.type); res.end(asset.bytes); return; }
  if (pathname === '/') { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><html><body style="margin:0"></body></html>'); return; }
  const file = path.resolve(root, pathname.startsWith('/tests/') ? '.' + pathname : './public' + pathname);
  if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (error, bytes) => {
    if (error) { res.writeHead(404); res.end(); return; }
    const ext = path.extname(file);
    res.setHeader('Content-Type', ({ '.mjs':'text/javascript', '.js':'text/javascript', '.json':'application/json', '.png':'image/png', '.csv':'text/csv' })[ext] || 'text/plain');
    res.end(bytes);
  });
});
const timeout = setTimeout(() => { console.error('Grayscale test timed out', errors); app.exit(1); }, 240000);
(async () => {
  await app.whenReady(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const win = new BrowserWindow({ width:1100, height:900, show:false, webPreferences:{contextIsolation:true,nodeIntegration:false,backgroundThrottling:false} });
  win.webContents.on('console-message', (_event, level, message) => { if (level >= 3) errors.push(message); if (message.startsWith('GRAYSCALE TEST')) console.log(message); });
  await win.loadURL(`http://127.0.0.1:${server.address().port}`);
  const fixtures = await win.webContents.executeJavaScript(`(() => {
    const c=document.createElement('canvas'); c.width=120; c.height=80; const x=c.getContext('2d');
    x.fillStyle='rgb(64,64,64)';x.fillRect(0,0,60,80);x.fillStyle='rgb(192,192,192)';x.fillRect(60,0,60,80);
    const png=c.toDataURL('image/png'), jpeg=c.toDataURL('image/jpeg');
    x.clearRect(0,0,10,10);x.fillStyle='rgba(64,64,64,0.5)';x.fillRect(10,0,10,10);
    return {png,jpeg,alpha:c.toDataURL('image/png')};
  })()`);
  for (const [name, key] of [['opaque.png','png'],['alpha.PNG','alpha'],['photo.JPG','jpeg'],['photo.jpeg','jpeg']]) {
    assets.set('/Notebook/' + name, {type:key==='jpeg'?'image/jpeg':'image/png',bytes:Buffer.from(fixtures[key].split(',')[1],'base64')});
  }
  const runScript = process.argv.includes('--editor-only')
    ? "import('/tests/grayscaleEditorBrowser.mjs').then(async m=>{const passed=[];await m.runEditorChecks(passed);return {ok:true,passed};})"
    : "import('/tests/grayscaleAnalysisBrowser.mjs').then(m=>m.run())";
  const result = await win.webContents.executeJavaScript(runScript, true);
  console.log(JSON.stringify(result,null,2));
  if (!result.ok) throw new Error(result.error);
  for (const width of process.argv.includes('--editor-only') ? [] : [1100,390]) {
    win.setSize(width,900);
    await win.webContents.executeJavaScript(`window.checkGrayscaleLayout(${width})`);
    fs.writeFileSync(path.join(os.tmpdir(), `nodevision-grayscale-${width}.png`), (await win.webContents.capturePage()).toPNG());
  }
  if (!process.argv.includes('--editor-only')) console.log('PASS desktop/mobile layout and screenshots: /tmp/nodevision-grayscale-{1100,390}.png');
  clearTimeout(timeout); win.destroy(); server.close(); app.exit(0);
})().catch(error => { console.error(error.stack, errors.slice(-8)); server.close(); app.exit(1); });
app.on('quit', () => fs.rmSync(profile,{recursive:true,force:true}));
