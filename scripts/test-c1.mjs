// Real GameView concealment/melee integration and isolated shared-GLB benchmarks in a temporary Notebook.
import express from 'express';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import {registerWorldRoutes} from '../ApplicationSystem/server/routes/worldRoutes.mjs';
import createFileSaveRouter from '../ApplicationSystem/routes/api/fileSaveRoutes.js';
import {worldLoadingFixture} from './world-loading-fixture.mjs';
import {registerNotebookRoutes} from '../ApplicationSystem/server/routes/notebookRoutes.mjs';
import createSearchRouter from '../ApplicationSystem/routes/api/search.js';
const root=path.resolve(import.meta.dirname,'..'),temp=await fs.mkdtemp(path.join(os.tmpdir(),'nv-c1-'));
const notebookDir=path.join(temp,'Notebook'),userSettingsDir=path.join(temp,'UserSettings');
await fs.mkdir(notebookDir);await fs.mkdir(userSettingsDir);
// Expand the parser fixture's crop from its small pixel rectangle to the full cached raster.
const html=worldLoadingFixture(),raw=html.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1],definition=JSON.parse(raw);
definition.metadata.playerRules={allowToolUse:true};
definition.objects[1].representation='voxel';
definition.objects[1].geographic.effectiveRaster=[[[[0,0],[223,0],[223,289],[0,289],[0,0]]]];
await fs.writeFile(path.join(notebookDir,'world.html'),html.replace(raw,JSON.stringify(definition,null,2)));
const app=express();app.use(express.json({limit:'32mb'}));
const ctx={notebookDir,userSettingsDir,serverSettingsDir:path.join(temp,'ServerSettings')};
registerWorldRoutes(app,ctx);registerNotebookRoutes(app,ctx);app.use('/api',createSearchRouter(ctx));
// Existing upload adapter is CWD-relative; isolate it inside the temporary Notebook.
process.chdir(temp);app.use('/api/file',(await import('../ApplicationSystem/routes/api/fileUploadRoutes.js')).default);app.use('/api',createFileSaveRouter(ctx));
const mode=process.argv[2]==='performance'?'performance':'browser';
app.post('/test/metrics',async(req,res)=>{await fs.writeFile(path.join(root,mode==='performance'?'docs/CreatureDesignerPerformance.json':'docs/CreatureDesignerBrowser.json'),JSON.stringify(req.body,null,2));res.json({ok:true});});
app.get('/',(req,res)=>res.type('html').send(`<div id="global-toolbar"></div><div id="sub-toolbar"></div><div id="editor"></div><pre id="result">RUNNING</pre><script type="module" src="/scripts/c1-${mode}.mjs"></script>`));
app.use('/Notebook',express.static(notebookDir));app.use('/scripts',express.static(path.join(root,'scripts')));app.use(express.static(path.join(root,'ApplicationSystem/public')));
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
try{
 const child=spawn(process.execPath,['scripts/run-browser-regression.mjs',`http://127.0.0.1:${server.address().port}/`,'chromium','600000','/tmp/nodevision-c1-results.txt'],{cwd:root,stdio:'inherit',env:{...process.env,NODEVISION_TEST_WEBGL:'1',NODEVISION_NATIVE_ARCHERY:'1'}});
 assert.equal(await new Promise(r=>child.once('exit',r)),0,'Production C1 integration passes');
}finally{server.closeAllConnections();await new Promise(r=>server.close(r));await fs.rm(temp,{recursive:true,force:true});}
