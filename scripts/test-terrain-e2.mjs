// Nodevision/scripts/test-terrain-e2.mjs
// Serve deterministic E2 WebGL sequences and recorded pre-E2 vegetation modules locally. Notebook input is read-only; retained images and metrics have their own E2 artifact paths.
import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..'),baselineDir=await fs.mkdtemp('/tmp/nv-e2-baseline-'),snapshot=JSON.parse(await fs.readFile(path.join(root,'docs/TerrainE2BaselineSources.json'),'utf8'));
for(const [name,hash] of Object.entries(snapshot.sharedSha256))assert.equal(createHash('sha256').update(await fs.readFile(path.join(root,'ApplicationSystem/public/MetaWorld',name))).digest('hex'),hash,`Shared source changed: ${name}`);
for(const [name,hash] of Object.entries(snapshot.currentSha256))assert.equal(createHash('sha256').update(await fs.readFile(path.join(root,name))).digest('hex'),hash,`Current source changed: ${name}`);
for(const [name,source] of Object.entries(snapshot.files))assert.equal(createHash('sha256').update(source).digest('hex'),snapshot.sha256[name],`Baseline changed: ${name}`);
for(const [name,source] of Object.entries(snapshot.files)){const file=path.join(baselineDir,'MetaWorld',name);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,source);}
const app=express(),experiment=process.argv[3]==='performance'?'terrain-e2-performance.mjs':process.argv[3]==='isolate'?'terrain-e2-isolation.mjs':'terrain-e2-visual.mjs',output=process.argv[2]||path.join(root,'docs/TerrainE2VisualMetrics.json');
app.use(express.json({limit:'12mb'}));
app.get('/',(req,res)=>res.type('html').send(`<pre id="result">RUNNING</pre><script type="importmap">{"imports":{"/baseline/lib/":"/lib/","/ApplicationSystem/public/":"/"}}</script><script type="module" src="/scripts/${experiment}"></script>`));
app.post('/test/image',async(req,res)=>{assert.match(req.body.name,/^[a-z0-9-]+\.png$/);await fs.writeFile(path.join(root,'docs/TerrainE2Visuals',req.body.name),Buffer.from(req.body.data.split(',')[1],'base64'));res.json({ok:true});});
app.post('/test/results',async(req,res)=>{await fs.writeFile(output,JSON.stringify(req.body,null,2));res.json({ok:true});});
app.get('/test/resume',async(req,res)=>{try{res.json(JSON.parse(await fs.readFile(output,'utf8')).results||[]);}catch{res.json([]);}});
app.get('/test/geographic',async(req,res)=>{const html=await fs.readFile(path.join(root,'Notebook/test.html'),'utf8');res.json(JSON.parse(html.match(/<script[^>]*id="nodevision-metaworld"[^>]*>([\s\S]*?)<\/script>/i)[1]).objects.find(o=>o.terrainSource==='geographic'));});
app.use('/scripts',express.static(path.join(root,'scripts')));app.use('/baseline',express.static(baselineDir));app.use('/baseline',express.static(path.join(root,'ApplicationSystem/public')));app.use(express.static(path.join(root,'ApplicationSystem/public')));
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
try{const child=spawn(process.execPath,['scripts/run-browser-regression.mjs',`http://127.0.0.1:${server.address().port}/?focus=${encodeURIComponent(process.env.NV_E2_FOCUS||'')}`,'chromium','1800000'],{cwd:root,stdio:'inherit',env:{...process.env,NODEVISION_TEST_WEBGL:'1'}});assert.equal(await new Promise(r=>child.once('exit',r)),0);}finally{server.closeAllConnections();await new Promise(r=>server.close(r));await fs.rm(baselineDir,{recursive:true,force:true});}
