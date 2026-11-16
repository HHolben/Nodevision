// Compare the recorded pre-resume E2 runtime with the corrected runtime. Temporary source routing preserves historical benchmarks and Notebook input.
import express from 'express';import fs from 'node:fs/promises';import path from 'node:path';import {spawn} from 'node:child_process';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
const root=path.resolve(import.meta.dirname,'..'),snapshot=JSON.parse(await fs.readFile('docs/TerrainE2ResumeBaseline.json','utf8')),temp=await fs.mkdtemp('/tmp/nv-e2-resume-');
for(const [name,source] of Object.entries(snapshot.files)){assert.equal(createHash('sha256').update(source).digest('hex'),snapshot.sha256[name]);const target=path.join(temp,'MetaWorld/VegetationLOD',name);await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,source);}
await fs.mkdir('docs/TerrainE2ResumeVisuals',{recursive:true});const app=express();app.use(express.json({limit:'12mb'}));
app.get('/',(req,res)=>res.type('html').send('<pre id="result">RUNNING</pre><script type="importmap">{"imports":{"/before/lib/":"/lib/"}}</script><script type="module" src="/scripts/terrain-e2-resume.mjs"></script>'));
app.post('/results',async(req,res)=>{await fs.writeFile('docs/TerrainE2ResumeResults.json',JSON.stringify(req.body,null,2));res.json({ok:true});});
app.post('/image',async(req,res)=>{assert.match(req.body.name,/^(before|after)-(voxel|polygonal)-(ready|invalidated|recovering|restored)\.png$/);await fs.writeFile(path.join('docs/TerrainE2ResumeVisuals',req.body.name),Buffer.from(req.body.data.split(',')[1],'base64'));res.json({ok:true});});
app.use('/before',express.static(temp));app.use('/before',express.static(path.join(root,'ApplicationSystem/public')));app.use('/scripts',express.static(path.join(root,'scripts')));app.use(express.static(path.join(root,'ApplicationSystem/public')));
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));try{
 const child=spawn(process.execPath,['scripts/run-browser-regression.mjs',`http://127.0.0.1:${server.address().port}/`,'chromium','480000','/tmp/nv-e2-resume-browser-result.txt'],{stdio:'inherit',env:{...process.env,NODEVISION_TEST_WEBGL:'1'}});assert.equal(await new Promise(r=>child.once('exit',r)),0);
}finally{server.closeAllConnections();await new Promise(r=>server.close(r));await fs.rm(temp,{recursive:true,force:true});}
