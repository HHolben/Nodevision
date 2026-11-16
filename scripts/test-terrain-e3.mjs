// Nodevision/scripts/test-terrain-e3.mjs
// Serve real terrain extraction and Three.js locally; retain exact WebGL renders and metrics without modifying Notebook fixtures. Destructive image writes are limited to this task's named artifact directory.
import express from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'..'),out=path.join(root,'docs/TerrainE3Visuals');await fs.mkdir(out,{recursive:true});
const app=express();app.use(express.json({limit:'8mb'}));
app.get('/',(req,res)=>res.type('html').send('<pre id="result">RUNNING</pre><script type="module" src="/scripts/terrain-e3-visual.mjs"></script>'));
app.post('/test/image',async(req,res)=>{assert.match(req.body.name,/^[a-z0-9-]+\.png$/);await fs.writeFile(path.join(out,req.body.name),Buffer.from(req.body.data.split(',')[1],'base64'));res.json({ok:true});});
app.post('/test/results',async(req,res)=>{await fs.writeFile(path.join(root,'docs/TerrainE3VisualMetrics.json'),JSON.stringify(req.body,null,2));res.json({ok:true});});
app.use('/scripts',express.static(path.join(root,'scripts')));app.use(express.static(path.join(root,'ApplicationSystem/public')));
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
try{const child=spawn(process.execPath,['scripts/run-browser-regression.mjs',`http://127.0.0.1:${server.address().port}/`,'chromium','600000'],{cwd:root,stdio:'inherit',env:{...process.env,NODEVISION_TEST_WEBGL:'1'}});assert.equal(await new Promise(r=>child.once('exit',r)),0);}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
