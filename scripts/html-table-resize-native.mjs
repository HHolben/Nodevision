// Nodevision/scripts/html-table-resize-native.mjs
// This runner executes a local browser fixture through Chromium's debugging pipe using real clocks. It waits for the fixture's result element, preserving meaningful render timings without virtual-time clock distortion or external automation dependencies.
import { spawn } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const profile = await mkdtemp(join(tmpdir(), 'nodevision-browser-test-'));
const browser = spawn(process.argv[3] || 'chromium', ['--headless', '--window-size=1400,1200', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--force-device-scale-factor=2', '--remote-debugging-pipe', `--user-data-dir=${profile}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe', 'pipe', 'pipe'] });
let nextId = 0, buffer = '', errors = '';
const pending = new Map(), events = new Map();
browser.stderr.on('data', chunk => { errors = (errors + chunk).slice(-4000); });
browser.stdio[4].on('data', chunk => {
  buffer += chunk;
  let end;
  while ((end = buffer.indexOf('\0')) >= 0) {
    const message = JSON.parse(buffer.slice(0, end)); buffer = buffer.slice(end + 1);
    const eventKey = message.sessionId + ":" + message.method;
    if (events.has(eventKey)) { events.get(eventKey)(message.params); events.delete(eventKey); }
    if (message.method === 'Runtime.exceptionThrown') console.error(JSON.stringify(message.params.exceptionDetails));
    if (message.method === 'Runtime.consoleAPICalled' && message.params.args?.[0]?.value === 'NV_TEST_PROGRESS') console.log(...message.params.args.map(arg=>arg.value));
    const request = pending.get(message.id);
    if (request) { pending.delete(message.id); message.error ? request.reject(Error(JSON.stringify(message.error))) : request.resolve(message.result); }
  }
});
const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
  const id = ++nextId; pending.set(id, { resolve, reject });
  browser.stdio[3].write(JSON.stringify({ id, method, params, sessionId }) + '\0');
});
const timeout = setTimeout(() => { console.error('Browser regression timeout\n' + errors); browser.kill('SIGKILL'); process.exitCode = 1; }, Number(process.argv[4]) || 180000);
browser.on('exit', () => { for (const request of pending.values()) request.reject(Error('Browser exited: ' + errors)); pending.clear(); });
try {
  const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
  await send('Page.enable', {}, sessionId);
  await send('Runtime.enable', {}, sessionId);
  const loaded = new Promise(resolve => events.set(sessionId + ':Page.loadEventFired', resolve));
  await send('Page.navigate', { url: process.argv[2] }, sessionId);
  await send('Page.bringToFront', {}, sessionId);
  await loaded;
  const result = await send('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression: `new Promise(resolve => { const poll = () => { const text = document.querySelector('#result')?.textContent; if (text && /^(PASS|FAIL):/.test(text)) resolve(text); else setTimeout(poll, 50); }; poll(); })` }, sessionId);
  const report = result.result?.value || JSON.stringify(result);
  if (report.startsWith('PASS:')) {
    const js = async expression => {
      const value = await send('Runtime.evaluate', {expression, returnByValue:true}, sessionId);
      if (value.exceptionDetails) throw Error(value.exceptionDetails.exception?.description || JSON.stringify(value.exceptionDetails));
      return value.result?.value;
    };
    for (const kind of ['column','row']) for (const zoom of [.5,1,1.75]) {
      const point = await js(`nativeResize.prepare('${kind}',${zoom})`);
      const mouse = (type,delta=0) => send('Input.dispatchMouseEvent', {type,
        x:point.x+(kind==='column'?delta:0), y:point.y+(kind==='row'?delta:0),
        button:'left', buttons:type==='mouseReleased'?0:1, clickCount:1}, sessionId);
      await mouse('mousePressed');await new Promise(resolve=>setTimeout(resolve,50));
      for(const delta of [1,10,90,200,40]) { await mouse('mouseMoved',delta);await new Promise(resolve=>setTimeout(resolve,30));await js(`nativeResize.check(${delta})`); }
      await mouse('mouseReleased',40);await js('nativeResize.finish()');
    }
    await js('nativeResize.cleanup()');
    console.log('PASS: native pointer capture, movement and release on both axes at three zoom levels');
  }
  console.log(report); process.exitCode = report.startsWith('PASS:') ? 0 : 1;
} catch (error) { console.error(error); process.exitCode = 1; }
finally { clearTimeout(timeout); browser.kill('SIGKILL'); await new Promise(resolve => browser.exitCode !== null || browser.signalCode ? resolve() : browser.once('exit', resolve)); await rm(profile, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); }
