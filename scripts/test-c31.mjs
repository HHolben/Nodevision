// C3.1 production workflows and controlled shared-GLB benchmarks in a temporary Notebook.
import express from 'express';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {registerWorldRoutes} from '../ApplicationSystem/server/routes/worldRoutes.mjs';
import createFileSaveRouter from '../ApplicationSystem/routes/api/fileSaveRoutes.js';
import {worldLoadingFixture} from './world-loading-fixture.mjs';
import {registerNotebookRoutes} from '../ApplicationSystem/server/routes/notebookRoutes.mjs';
import createSearchRouter from '../ApplicationSystem/routes/api/search.js';
const root=path.resolve(import.meta.dirname,'..'),temp=await fs.mkdtemp(path.join(os.tmpdir(),'nv-c31-'));
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
const modes={browser:'c31-browser',c3:'c3-browser',performance:'c31-performance',c2:'c2-browser',c1:'c1-browser',m14:'m14-browser',archery:'archery-browser',target:'archery-target-browser',teleporter:'raycasting-teleporter-browser'},mode=process.argv[2]||'browser';if(!modes[mode])throw Error('Unknown test mode');
const captureNames=['voxel','polygonal','target','target-properties','hare'].map(n=>'archery-'+n+'.png'),captures=new Map();for(const name of captureNames){try{captures.set(name,await fs.readFile(path.join(root,'docs/ArcheryVisuals',name)));}catch{captures.set(name,null);}}
const runtimeSourceHashes={};for(const file of ['MetaWorld/Creatures/Capabilities/Resolver.mjs','MetaWorld/Creatures/Skills/Skills.mjs','MetaWorld/Creatures/Skills/RemoteTarget.mjs','MetaWorld/Creatures/Behaviors/Schema.mjs','MetaWorld/Creatures/Behaviors/Interpreter.mjs','MetaWorld/Creatures/Behaviors/Adapter.mjs','MetaWorld/Creatures/Behaviors/Library.mjs','MetaWorld/Mobs/Runtime.mjs','MetaWorld/Mobs/Ground.mjs','MetaWorld/Mobs/Perception.mjs']){const p='ApplicationSystem/public/'+file;runtimeSourceHashes[p]=crypto.createHash('sha256').update(await fs.readFile(path.join(root,p))).digest('hex');}
app.post('/test/metrics',async(req,res)=>{req.body.runtimeSourceHashes=runtimeSourceHashes;await fs.writeFile(path.join(root,mode==='performance'?'docs/CreatureDesignerC31Performance.json':mode==='browser'?'docs/CreatureDesignerC31Browser.json':'docs/CreatureDesignerC31Compatibility-'+mode+'.json'),JSON.stringify(req.body,null,2));res.json({ok:true});});
app.get('/',(req,res)=>res.type('html').send(`<div id="global-toolbar"></div><div id="sub-toolbar"></div><div id="editor"></div><pre id="result">RUNNING</pre><script>window.addEventListener("error",e=>{document.getElementById("result").textContent="FAIL: "+(e.error?.stack||e.message||"Module load failed");},true);window.addEventListener("unhandledrejection",e=>{document.getElementById("result").textContent="FAIL: "+e.reason;});</script><script type="module" src="/scripts/${modes[mode]}.mjs"></script>`));
app.use('/Notebook',express.static(notebookDir));app.use('/scripts',express.static(path.join(root,'scripts')));app.use(express.static(path.join(root,'ApplicationSystem/public')));
console.log('NV_TEST_PROGRESS','C31 fixture ready to listen');
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
try{
 console.log('NV_TEST_PROGRESS','C31 launching browser',server.address().port);
 const child=spawn(process.execPath,['scripts/run-browser-regression.mjs',`http://127.0.0.1:${server.address().port}/`,'chromium','600000','/tmp/nodevision-c31-results.txt'],{cwd:root,stdio:'inherit',env:{...process.env,NODEVISION_TEST_WEBGL:'1',NODEVISION_NATIVE_ARCHERY:mode==='teleporter'?'0':'1',NODEVISION_NATIVE_TELEPORTER:mode==='teleporter'?'1':'0'}});
 assert.equal(await new Promise(r=>child.once('exit',r)),0,'Production C31 integration passes');
}finally{for(const [name,bytes] of captures){const file=path.join(root,'docs/ArcheryVisuals',name);if(bytes)await fs.writeFile(file,bytes);else await fs.rm(file,{force:true});}server.closeAllConnections();await new Promise(r=>server.close(r));await fs.rm(temp,{recursive:true,force:true});}
