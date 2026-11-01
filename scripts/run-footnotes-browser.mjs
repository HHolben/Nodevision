// Nodevision/scripts/run-footnotes-browser.mjs
// This runner serves application modules and uses Chromium's debugging protocol to wait for real browser regressions without virtual-time distortion or additional dependencies.
import http from 'node:http';
import {readFile, mkdtemp, rm} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
const base=path.resolve('ApplicationSystem/public');
const tests=path.resolve('scripts');
const testName=process.argv[2] || 'footnotes-browser.mjs';
if(!/^[\w.-]+\.mjs$/.test(testName)) throw Error('Invalid test module');
let standalone='';
const server=http.createServer(async(req,res)=>{
  try {
    if(req.url==='/education-fixture' && testName==='education-browser.mjs'){if(process.argv.includes('--synthetic')){res.statusCode=404;res.end('synthetic fixture requested');return;}res.setHeader('Content-Type','text/html');res.end(await readFile(process.env.NODEVISION_EDUCATION_FIXTURE||'Notebook/test-fixtures/GreekAlphabet/GreekAlphabet.html'));return;}
    if(req.url==='/test-standalone' && req.method==='POST') { standalone=''; for await(const chunk of req) standalone+=chunk;res.end('ok');return; }
    if(req.url==='/standalone.html') {res.setHeader('Content-Type','text/html');res.end(standalone);return;}
    if(req.url==='/') {res.setHeader('Content-Type','text/html');res.end(`<pre id="result">WAIT</pre><div id="editor"></div><script type="module" src="/tests/${testName}"></script>`);return;}
    const pathname=decodeURIComponent(req.url.split('?')[0]);
    const file=pathname.startsWith('/tests/')?path.join(tests,pathname.slice(7)):path.join(base,pathname);
    if(!file.startsWith(base+path.sep) && !file.startsWith(tests+path.sep)) throw Error('Invalid path');
    res.setHeader('Content-Type',file.endsWith('.mjs')||file.endsWith('.js')?'text/javascript':'text/plain');res.end(await readFile(file));
  } catch {res.statusCode=404;res.end('not found');}
});
const profile=await mkdtemp(path.join(os.tmpdir(),'nv-footnotes-'));
let child, socket;
try {
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  child=spawn(process.env.CHROMIUM || 'chromium',['--headless','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank']);
  const endpoint=await new Promise((resolve,reject)=>{
    let log=''; const timeout=setTimeout(()=>reject(Error('Chromium startup timeout')),15000);
    child.on('error',reject); child.stderr.on('data',data=>{log+=data;const match=log.match(/DevTools listening on (ws:\/\/[^\s]+)/);if(match){clearTimeout(timeout);resolve(match[1]);}});
  });
  const {host}=new URL(endpoint);
  const pages=await (await fetch(`http://${host}/json/list`)).json();
  socket=new WebSocket(pages.find(page=>page.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
  let id=0; const pending=new Map();
  socket.onmessage=event=>{const data=JSON.parse(event.data);if(!data.id)return;const entry=pending.get(data.id);pending.delete(data.id);if(data.error)entry?.reject(Error(data.error.message));else entry?.resolve(data.result);};
  const call=(method,params={})=>new Promise((resolve,reject)=>{const request=++id;pending.set(request,{resolve,reject});socket.send(JSON.stringify({id:request,method,params}));});
  await call('Page.navigate',{url:`http://127.0.0.1:${server.address().port}/`});
  let result='WAIT'; const deadline=Date.now()+60000;
  while(Date.now()<deadline) {
    const value=await call('Runtime.evaluate',{expression:'document.getElementById("result")?.textContent',returnByValue:true});
    result=value.result?.value || 'WAIT'; if(/^(PASS|FAIL)/.test(result))break;
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  console.log(result);process.exitCode=result.startsWith('PASS')?0:1;
} catch(error) {console.error(error);process.exitCode=1;}
finally {socket?.close();child?.kill();server.close();await rm(profile,{recursive:true,force:true,maxRetries:5,retryDelay:100});}
