// Nodevision/scripts/test-world-extent.mjs
// Exercises extent authoring and reopening through the production HTTP loader, saver and GameView using a temporary Notebook with a linked construction.
import express from 'express';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {registerWorldRoutes} from '../ApplicationSystem/server/routes/worldRoutes.mjs';
import createFileSaveRouter from '../ApplicationSystem/routes/api/fileSaveRoutes.js';
const root=path.resolve(import.meta.dirname,'..'),temp=await fs.mkdtemp(path.join(os.tmpdir(),'nv-extent-'));
const notebookDir=path.join(temp,'Notebook'),userSettingsDir=path.join(temp,'UserSettings');await fs.mkdir(notebookDir);await fs.mkdir(userSettingsDir);
const terrain={id:'terrain',name:'Extent test',type:'procedural-voxel-world',position:[0,0,0],size:[64,64,64],voxelSize:.25,generator:{id:'nodevision-terrain-v1',version:1,seed:42},chunks:{voxelsPerAxis:32,loadRadius:1},generation:{vegetation:false,water:false,caves:false},streaming:{enabled:true,visibilityDistance:64,vegetationEnabled:false}};
const definition={name:'Extent regression',type:'world',objects:[terrain,{id:'authored-marker',type:'box',position:[-128,40,-128],size:[1,1,1],isSolid:false},{id:'cut',type:'construction',position:[-128,0,-128],constructionFile:'cut.construction.json'}]};
const construction={schema:'nodevision-construction',version:2,id:'cut',name:'Persistent excavation',voxelSize:.25,position:[-512,0,-512],terrainVolumes:[{id:'excavation',type:'TerrainCut',shape:'box',operation:'subtract',active:true,position:[0,1,0],size:[2,2,2]}],geometry:null};
await fs.writeFile(path.join(notebookDir,'cut.construction.json'),JSON.stringify(construction));
await fs.writeFile(path.join(notebookDir,'world.html'),'<!doctype html><html><body><p id="lesson">Keep authored lesson.</p><script id="nodevision-metaworld" type="application/json">'+JSON.stringify(definition)+'</script></body></html>');
const app=express();app.use(express.json({limit:'32mb'}));const ctx={notebookDir,userSettingsDir,serverSettingsDir:path.join(temp,'ServerSettings')};registerWorldRoutes(app,ctx);app.use('/api',createFileSaveRouter(ctx));
app.get('/',(req,res)=>res.type('html').send('<div id="global-toolbar"></div><div id="sub-toolbar"></div><div id="editor"></div><pre id="result">RUNNING</pre><script type="module" src="/scripts/world-extent-browser.mjs"></script>'));
app.use('/Notebook',express.static(notebookDir));app.use('/scripts',express.static(path.join(root,'scripts')));app.use(express.static(path.join(root,'ApplicationSystem/public')));
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
try{
 const child=spawn(process.execPath,['scripts/run-browser-regression.mjs',`http://127.0.0.1:${server.address().port}/`,'chromium','300000'],{cwd:root,stdio:'inherit',env:{...process.env,NODEVISION_TEST_WEBGL:'1'}});
 assert.equal(await new Promise(r=>child.once('exit',r)),0,'Extent browser regression passes');
 const saved=await fs.readFile(path.join(notebookDir,'world.html'),'utf8');assert.ok(saved.includes('Keep authored lesson.'));assert.equal(JSON.parse(saved.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1]).objects.find(o=>o.id==='terrain').worldExtent.mode,'infinite');
 assert.deepEqual(JSON.parse(await fs.readFile(path.join(notebookDir,'cut.construction.json'),'utf8')),construction);
}finally{server.closeAllConnections();await new Promise(r=>server.close(r));await fs.rm(temp,{recursive:true,force:true});}
