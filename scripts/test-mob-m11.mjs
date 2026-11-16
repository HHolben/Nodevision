// Nodevision/scripts/test-raycasting-teleporter.mjs
// Runs real GameView inventory and shared input/physics with trusted Chromium keyboard events and a temporary Notebook.
import express from 'express';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {registerWorldRoutes} from '../ApplicationSystem/server/routes/worldRoutes.mjs';
import createFileSaveRouter from '../ApplicationSystem/routes/api/fileSaveRoutes.js';
import {packRaster} from '../ApplicationSystem/public/MetaWorld/Geographic/Snapshot.mjs';
import {worldLoadingFixture} from './world-loading-fixture.mjs';
const root=path.resolve(import.meta.dirname,'..'),temp=await fs.mkdtemp(path.join(os.tmpdir(),'nv-mob-m11-'));
const notebookDir=path.join(temp,'Notebook'),userSettingsDir=path.join(temp,'UserSettings');
await fs.mkdir(notebookDir);await fs.mkdir(userSettingsDir);
// Expand the parser fixture's crop from its small pixel rectangle to the full cached raster.
const html=worldLoadingFixture(),raw=html.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1],definition=JSON.parse(raw);
definition.objects[1].representation='voxel';
const elevation=definition.objects[1].geographic.elevation,values=new Float64Array(224*290);for(let z=0;z<290;z++)for(let x=0;x<224;x++)values[z*224+x]=1100+((x*.25>17&&x*.25<24&&z*.25>12&&z*.25<18)?0:.15*Math.sin(x*.25/4)+.25*Math.sin(z*.25/6));definition.objects[1].geographic.elevation=packRaster({...elevation,width:224,height:290,origin:[675000,4362000],sourceOrigin:[675000,4362000],resolution:[.25,-.25],offset:.5,window:[0,0,224,290],crs:32634,asset:{path:'/Notebook/offline-dem.tif',sha256:'a'.repeat(64)}},values);
definition.objects[1].geographic.effectiveRaster=[[[[0,0],[223,0],[223,289],[0,289],[0,0]]]];
await fs.writeFile(path.join(notebookDir,'world.html'),html.replace(raw,JSON.stringify(definition,null,2)));
const app=express();app.use(express.json({limit:'32mb'}));
const ctx={notebookDir,userSettingsDir,serverSettingsDir:path.join(temp,'ServerSettings')};
registerWorldRoutes(app,ctx);app.use('/api',createFileSaveRouter(ctx));
app.post('/test/metrics',async(req,res)=>{await fs.writeFile(path.join(root,process.argv[2]==='performance'?'docs/MobM11Performance.json':'docs/MobM11Browser.json'),JSON.stringify(req.body,null,2));res.json({ok:true});});
app.get('/',(req,res)=>res.type('html').send(`<div id="global-toolbar"></div><div id="sub-toolbar"></div><div id="editor"></div><pre id="result">RUNNING</pre><script type="module" src="/scripts/${process.argv[2]==='performance'?'mob-m11-performance.mjs':'mob-m11-browser.mjs'}"></script>`));
app.use('/Notebook',express.static(notebookDir));app.use('/scripts',express.static(path.join(root,'scripts')));app.use(express.static(path.join(root,'ApplicationSystem/public')));
const snapshot=JSON.parse(await fs.readFile(path.join(root,'docs/MobM11BaselineSources.json'),'utf8'));
app.get('/before/MetaWorld/Mobs/:name',(req,res,next)=>{const file=snapshot.files[req.params.name];if(!file)return next();res.type('text/javascript').send(file.source);});
app.use('/before',express.static(path.join(root,'ApplicationSystem/public')));
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
try{
 const child=spawn(process.execPath,['scripts/run-browser-regression.mjs',`http://127.0.0.1:${server.address().port}/`,'chromium','360000','/tmp/nodevision-m11-results.txt'],{cwd:root,stdio:'inherit',env:{...process.env,NODEVISION_TEST_WEBGL:'1',NODEVISION_NATIVE_ARCHERY:'1'}});
 assert.equal(await new Promise(r=>child.once('exit',r)),0,'Production archery browser regression passes');
}finally{server.closeAllConnections();await new Promise(r=>server.close(r));await fs.rm(temp,{recursive:true,force:true});}
