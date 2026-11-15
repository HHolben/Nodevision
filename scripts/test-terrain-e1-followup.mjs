// Nodevision/scripts/test-terrain-e1-followup.mjs
// This runner serves alternating prior E1 and a profiling-only vertex reuse candidate with identical benchmark code. It materializes the recorded baseline in a temporary directory and reads the geographic Notebook fixture without modifying it.
import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const baselineDir=await fs.mkdtemp('/tmp/nv-e1-baseline-');
const baseline=JSON.parse(await fs.readFile(new URL('../docs/TerrainE1FollowupBaselineSources.json',import.meta.url),'utf8'));
for(const [name,hash] of Object.entries(baseline.sharedSha256||{}))assert.equal(createHash('sha256').update(await fs.readFile(new URL('../ApplicationSystem/public/'+name,import.meta.url))).digest('hex'),hash,'Shared baseline source changed: '+name);
for(const [name,content] of Object.entries(baseline.files)){const destination=path.join(baselineDir,'MetaWorld',name);await fs.mkdir(path.dirname(destination),{recursive:true});await fs.writeFile(destination,content);}
const app=express(),root=path.resolve(import.meta.dirname,'..'),output=process.argv[2]||'/tmp/nodevision-e1-followup.json';
const html=await fs.readFile(path.join(root,'Notebook/test.html'),'utf8'),world=JSON.parse(html.match(/<script[^>]*id="nodevision-metaworld"[^>]*>([\s\S]*?)<\/script>/i)[1]);
app.get('/test/resume',async(req,res)=>{try{const saved=JSON.parse(await fs.readFile(output,'utf8'));res.json(saved.results.slice(0,saved.results.length-saved.results.length%2));}catch{res.json([]);}});
app.get('/test/geographic',(req,res)=>res.json(world.objects.find(o=>o.terrainSource==='geographic')));
app.use(express.json({limit:'32mb'}));app.post('/test/results',async(req,res)=>{await fs.writeFile(output,JSON.stringify(req.body,null,2));res.json({ok:true});});
app.get('/',(req,res)=>res.type('html').send(`<pre id="result">RUNNING</pre><script type="importmap">{"imports":{"/baseline/lib/":"/lib/","/ApplicationSystem/public/":"/"}}</script><script>window.phaseDCenter=${process.env.NV_PHASE_D_CENTER==='1'};</script><script type="module" src="/scripts/terrain-e1-followup.mjs"></script>`));
app.use('/scripts',express.static(path.join(root,'scripts')));
// Explicit profiling opt-in; production keeps the prior E1 builder.
app.get('/MetaWorld/TerrainLOD/TileMesh.mjs',(req,res)=>res.type('js').send("export {createTileMesh} from '/scripts/terrain-e1-vertex-tile.mjs';"));
if(process.env.NV_PHASE_E_BASELINE)app.use('/MetaWorld',express.static(path.join(process.env.NV_PHASE_E_BASELINE,'MetaWorld')));
app.use('/baseline',express.static(baselineDir));
app.use('/baseline',express.static(path.join(root,'ApplicationSystem/public')));
app.use(express.static(path.join(root,'ApplicationSystem/public')));
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
try{const child=spawn(process.execPath,['scripts/run-browser-regression.mjs',`http://127.0.0.1:${server.address().port}/${process.env.NV_E1_FOCUS?"?focus=1":""}`,'chromium','1800000'],{cwd:root,stdio:'inherit',env:{...process.env,NODEVISION_TEST_WEBGL:'1'}});assert.equal(await new Promise(r=>child.once('exit',r)),0);}finally{server.closeAllConnections();await new Promise(r=>server.close(r));await fs.rm(baselineDir,{recursive:true,force:true});}
