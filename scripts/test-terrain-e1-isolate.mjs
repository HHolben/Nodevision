// Nodevision/scripts/test-terrain-e1-isolate.mjs
// Serves a repeatable finite-world profiling matrix locally and saves measured results without opening or modifying Notebook content.
import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const experiment={isolate:'terrain-e1-isolate.mjs',skirts:'terrain-e1-skirts.mjs',instances:'terrain-e1-instance-isolate.mjs',vertices:'terrain-e1-vertex-isolate.mjs'}[process.argv[3]||'isolate'];if(!experiment)throw Error('Unknown E1 experiment');
const app=express(),root=path.resolve(import.meta.dirname,'..'),output=process.argv[2]||'/tmp/nodevision-phase-e.json';
const html=await fs.readFile(path.join(root,'Notebook/test.html'),'utf8'),world=JSON.parse(html.match(/<script[^>]*id="nodevision-metaworld"[^>]*>([\s\S]*?)<\/script>/i)[1]);
app.get('/test/geographic',(req,res)=>res.json(world.objects.find(o=>o.terrainSource==='geographic')));
app.use(express.json({limit:'32mb'}));app.post('/test/results',async(req,res)=>{await fs.writeFile(output,JSON.stringify(req.body,null,2));res.json({ok:true});});
app.get('/',(req,res)=>res.type('html').send(`<pre id="result">RUNNING</pre><script type="importmap">{"imports":{"/ApplicationSystem/public/":"/"}}</script><script>window.phaseDCenter=${process.env.NV_PHASE_D_CENTER==='1'};</script><script type="module" src="/scripts/${experiment}"></script>`));
app.use('/scripts',express.static(path.join(root,'scripts')));
if(process.argv[3]==='vertices')app.get('/MetaWorld/TerrainLOD/TileMesh.mjs',(req,res)=>res.type('js').send("export {createTileMesh} from '/scripts/terrain-e1-vertex-tile.mjs';"));
if(process.env.NV_PHASE_E_BASELINE)app.use('/MetaWorld',express.static(path.join(process.env.NV_PHASE_E_BASELINE,'MetaWorld')));
app.use(express.static(path.join(root,'ApplicationSystem/public')));
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
try{const child=spawn(process.execPath,['scripts/run-browser-regression.mjs',`http://127.0.0.1:${server.address().port}/`,'chromium','1800000'],{cwd:root,stdio:'inherit',env:{...process.env,NODEVISION_TEST_WEBGL:'1'}});assert.equal(await new Promise(r=>child.once('exit',r)),0);}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
