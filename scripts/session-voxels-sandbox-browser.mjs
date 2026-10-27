// Nodevision/scripts/session-voxels-sandbox-browser.mjs
// Real Sandbox Build/Play sessions exercise temporary-view teardown and reconstruction without committing voxel edits.
import {startSession,quitActiveSession} from '/Sessions/SessionController.mjs';
import {openPanelTabInCell} from '/panels/panelTabs.mjs';
import {planSandboxWorld} from '/MetaWorld/SandboxWorldPlanner.mjs';
import {createDefaultHtmlWorld} from '/MetaWorld/DefaultHtmlWorld.mjs';
const check=(value,label)=>{if(!value)throw Error(label);};
const terrain=()=>window.VRWorldContext?.objects.find(o=>o.userData.proceduralVoxelRuntime)?.userData.proceduralVoxelRuntime;
async function until(fn){for(let i=0;i<500;i++){if(fn())return;await new Promise(r=>setTimeout(r,25));}throw Error('Sandbox timed out: '+window.fixtureSessionError);}
try{
 window.NodevisionState={currentMode:'HTMLediting',virtualWorldMode:'survival'};window.selectedFilePath='voxel-session.html';window.confirm=()=>{throw Error('Mode switches must not request discard');};
 const cell=document.getElementById('editor').closest('.panel-cell');cell.replaceChildren();window.activeCell=cell;await openPanelTabInCell(cell,{panelType:'FileView',panelClass:'ViewPanel',panelVars:{filePath:'voxel-session.html'}},host=>{host.textContent='Original page';});
 const seed=planSandboxWorld(null,'voxel-session.html',()=>123456).definition;delete seed.metadata.astronomy;
 let html='<html><body>Keep page<script id="nodevision-metaworld" type="application/json">'+JSON.stringify(seed)+'</script></body></html>';const native=fetch,scripts={};for(const mode of ['Build','Play'])scripts[mode]=await(await native('/sandbox-builtins/Sandbox'+mode+'.NodevisionSession.js')).text();
 window.fetch=async(url,options)=>{const path=String(url);if(path.startsWith('/api/sessions/read')){const mode=path.includes('SandboxPlay')?'Play':'Build';return new Response(JSON.stringify({session:{id:'Sandbox'+mode+'.NodevisionSession.js',scope:'builtin',title:'Sandbox '+mode,source:scripts[mode]}}));}if(path==='/Notebook/voxel-session.html')return new Response(html);if(path==='/api/load-world')return new Response(JSON.stringify({worldDefinition:createDefaultHtmlWorld('voxel-session.html')}));if(path==='/api/save'){html=JSON.parse(options.body).content;return new Response('{"success":true}');}if(path.includes('GameControllerSettings.json'))return new Response('{}');return native(url,options);};
 async function launch(mode){window.activeCell=cell;await startSession('builtin','Sandbox'+mode+'.NodevisionSession.js');await until(()=>terrain()?.manager.loaded.size);}
 await launch('Build');let ctx=window.VRWorldContext,api=ctx.sessionVoxels;const at=[20,1,20],before=terrain().generator.getVoxel(...at);check(before>0,'fixture persistent terrain');api.edit('erase',[at]);api.flush();check(terrain().generator.getVoxel(...at)===0,'Build excavation');check(await ctx.saveVirtualWorldFile(),'native Save');check(!html.includes('sessionSignature')&&!html.includes('temporaryVoxel'),'save isolation');
 await quitActiveSession();check(!window.VRWorldContext&&api.session.count===1,'temporary panel cleanup retains logical session');await launch('Play');ctx=window.VRWorldContext;api=ctx.sessionVoxels;check(api.session.count===1&&terrain().generator.getVoxel(...at)===0,'actual Play reconstructs temporary occupancy');let rejected=false;try{api.edit('erase',[[21,1,20]]);}catch{rejected=true;}check(rejected,'actual Play blocks authoring');
 await quitActiveSession();await launch('Build');ctx=window.VRWorldContext;api=ctx.sessionVoxels;check(api.session.count===1,'returning to Build retains edits');api.clear();api.flush();check(terrain().generator.getVoxel(...at)===before,'Build discard restores persistent occupancy');await quitActiveSession();check(!window.VRWorldContext,'final scene cleanup');
 document.getElementById('result').textContent='PASS: actual Sandbox Build → Save → Play → Build, temporary occupancy, permissions, discard and teardown';
}catch(error){await quitActiveSession();document.getElementById('result').textContent='FAIL: '+error.stack;}
