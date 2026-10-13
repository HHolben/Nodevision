// Nodevision/ApplicationSystem/tests/vectorDrawing.electron.cjs
// This isolated Electron harness serves the repository and generated image fixtures without writing Notebook content. It exercises shared gestures, the actual SVG editor, oriented JPEG decoding, and non-destructive raster analysis.
const { app, BrowserWindow } = require('electron');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'nv-vector-test-'));
app.setPath('userData', profile);
const root = path.resolve('ApplicationSystem/public');
const assets = new Map();
const errors = [];
const timeout = setTimeout(() => { console.error('Browser test timed out', errors.slice(-12)); app.exit(1); }, 120000);
const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
  if (assets.has(pathname)) { const asset = assets.get(pathname); res.setHeader('Content-Type', asset.type); res.end(asset.bytes); return; }
  if (pathname === '/') { res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><html><body style="margin:0"></body></html>'); return; }
  if (pathname === '/Notebook/vector-test.svg') { res.setHeader('Content-Type', 'image/svg+xml'); res.end('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600"></svg>'); return; }
  const file = pathname.startsWith('/tests/') ? path.resolve('ApplicationSystem', '.' + pathname) : path.resolve(root, '.' + pathname);
  if (!file.startsWith(path.resolve('ApplicationSystem') + path.sep)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (error, bytes) => {
    if (error) { res.writeHead(404); res.end(); return; }
    res.setHeader('Content-Type', file.endsWith('.mjs') || file.endsWith('.js') ? 'text/javascript' : file.endsWith('.json') ? 'application/json' : file.endsWith('.csv') ? 'text/csv' : 'text/plain'); res.end(bytes);
  });
});
(async () => {
  await app.whenReady(); await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const win = new BrowserWindow({ width: 1200, height: 900, show: false, webPreferences: { contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } });
  win.webContents.on('console-message', (_event, level, message) => { if (level >= 3) errors.push(message); if (message.includes('VECTOR TEST')) console.log(message); });
  await win.loadURL(`http://127.0.0.1:${server.address().port}`);
  const images = await win.webContents.executeJavaScript(`(() => {
    const c = document.createElement('canvas'); c.width = 120; c.height = 80;
    const x = c.getContext('2d'); x.fillStyle = 'red'; x.fillRect(0,0,60,80); x.fillStyle = 'blue'; x.fillRect(60,0,60,80);
    const jpeg = c.toDataURL('image/jpeg'); x.clearRect(0,0,10,10); return { png:c.toDataURL('image/png'), jpeg };
  })()`);
  const png = Buffer.from(images.png.split(',')[1], 'base64'), jpeg = Buffer.from(images.jpeg.split(',')[1], 'base64');
  assets.set('/Notebook/test.PNG', { type: 'image/png', bytes: png });
  assets.set('/Notebook/test.JPG', { type: 'image/jpeg', bytes: jpeg });
  assets.set('/Notebook/test.jpeg', { type: 'image/jpeg', bytes: jpeg });
  // EXIF little-endian orientation 6: display a 120x80 encoded image as 80x120.
  const exif = Buffer.from('ffe1002245786966000049492a0008000000010012010300010000000600000000000000', 'hex');
  assets.set('/Notebook/oriented.JPEG', { type: 'image/jpeg', bytes: Buffer.concat([jpeg.subarray(0,2),exif,jpeg.subarray(2)]) });
  const runScript = process.argv.includes('--svg-only')
    ? `import('/tests/vectorDrawingSvgBrowser.mjs').then(async m => { const passed=[]; await m.runSvgTests(passed); return {ok:true,passed}; })`
    : `import('/tests/vectorDrawingBrowser.mjs').then(m => m.run())`;
  const result = await win.webContents.executeJavaScript(runScript, true);
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) throw new Error(result.error);
  await win.webContents.executeJavaScript("import('/tests/continuousLineBrowser.mjs').then(m => m.setupNativeLine())");
  win.show(); win.focus(); win.webContents.focus();
  const pause = () => new Promise(resolve => setTimeout(resolve, 60));
  await new Promise(resolve => setTimeout(resolve, 300));
  for (let i = 0; i < 5; i++) {
    const vertices = await win.webContents.executeJavaScript('window.nativeLineCoordinates()');
    const at = vertices[i];
    win.webContents.sendInputEvent({type:'mouseMove', ...at});
    win.webContents.sendInputEvent({type:'mouseDown', ...at, button:'left', clickCount:1});
    const releaseAt = i === 0 ? {x:at.x+5,y:at.y} : at;
    win.webContents.sendInputEvent({type:'mouseMove', ...releaseAt});
    win.webContents.sendInputEvent({type:'mouseUp', ...releaseAt, button:'left', clickCount:1});
    win.webContents.sendInputEvent({type:'mouseMove', ...vertices[5]});
    await pause(); await win.webContents.executeJavaScript(`window.checkNativeLine(${i})`);
  }
  win.webContents.sendInputEvent({type:'keyDown',keyCode:'Return'}); await pause();
  await win.webContents.executeJavaScript('window.finishNativeLine()');
  console.log('PASS native five-click SVG Line, hover, completion, cancellation, history, save/reload');
  // Native input verifies real pointer capture and Escape cleanup, beyond synthetic gestures.
  const point = await win.webContents.executeJavaScript('window.vectorNativeCaptureSetup()');
  win.show(); win.focus(); win.webContents.focus();
  await new Promise(resolve => setTimeout(resolve, 200));
  win.webContents.sendInputEvent({ type: 'mouseMove', x: Math.round(point.x), y: Math.round(point.y) });
  win.webContents.sendInputEvent({ type: 'mouseDown', x: Math.round(point.x), y: Math.round(point.y), button: 'left', clickCount: 1 });
  await new Promise(resolve => setTimeout(resolve, 100));
  const captured = await win.webContents.executeJavaScript('window.vectorNativeCaptured()');
  if (!captured) throw new Error('Native pointer was not captured');
  win.webContents.sendInputEvent({ type: 'keyDown', keyCode: 'Escape' });
  win.webContents.sendInputEvent({ type: 'mouseUp', x: Math.round(point.x), y: Math.round(point.y), button: 'left', clickCount: 1 });
  await new Promise(resolve => setTimeout(resolve, 50));
  if (await win.webContents.executeJavaScript('window.vectorNativeCaptured()')) throw new Error('Escape retained pointer capture');
  console.log('PASS native pointer capture and Escape cleanup');
  win.destroy(); server.close(); app.exit(0);
})().catch(error => { console.error(error.stack, errors.slice(-8)); server.close(); app.exit(1); });
app.on('quit', () => fs.rmSync(profile, { recursive: true, force: true }));
