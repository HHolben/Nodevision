// Nodevision/scripts/run-calligraphy-browser.mjs
// This runner serves the regression and application modules locally and executes them in headless Chromium without adding test dependencies.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import path from 'node:path';
const base=path.resolve('ApplicationSystem/public');
const server=http.createServer(async(req,res)=>{
 try {
  if(req.url==='/'){res.setHeader('Content-Type','text/html');res.end('<pre id="result">WAIT</pre><script type="module" src="/test.mjs"></script>');return;}
  const file=req.url==='/test.mjs'?path.resolve('scripts/calligraphy-browser.mjs'):path.join(base,decodeURIComponent(req.url.split('?')[0]));
  if(!file.startsWith(base) && !file.endsWith('/scripts/calligraphy-browser.mjs'))throw Error('Invalid path');
  res.setHeader('Content-Type',file.endsWith('.mjs')||file.endsWith('.js')?'text/javascript':'text/plain');res.end(await readFile(file));
 } catch {res.statusCode=404;res.end('not found');}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const child=spawn(process.env.CHROMIUM || 'chromium',['--headless','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--dump-dom','--virtual-time-budget=15000',`http://127.0.0.1:${server.address().port}`]);
let output='',errors='';child.stdout.on('data',data=>output+=data);child.stderr.on('data',data=>errors+=data);
const timer=setTimeout(()=>child.kill(),30000);
await new Promise(resolve=>child.on('close',resolve));clearTimeout(timer);server.close();
const result=output.match(/<pre id="result">([\s\S]*?)<\/pre>/)?.[1]||errors;
console.log(result);process.exitCode=result.startsWith('PASS')?0:1;
