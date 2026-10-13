// Nodevision/scripts/voxel-world-sandbox-browser.mjs
// This focused session regression verifies that procedural-object authoring preserves the actual Sandbox Build and Play lifecycle, compact persistence, and temporary authoring permissions without depending on fixed tree-foliage fixtures.
import { startSession, quitActiveSession } from '/Sessions/SessionController.mjs';
import { openPanelTabInCell } from '/panels/panelTabs.mjs';
import { getActiveMetaWorldLayerBridge } from '/MetaWorld/MetaWorldLayerState.mjs';
import { planSandboxWorld } from '/MetaWorld/SandboxWorldPlanner.mjs';
import { createDefaultHtmlWorld } from '/MetaWorld/DefaultHtmlWorld.mjs';
import { definitionFromVoxelForm, voxelWorldForm } from '/MetaWorld/ProceduralVoxelWorld/VoxelAuthoringDefinition.mjs';
import insertVoxelWorld from '/ToolbarCallbacks/insert/insertVoxelWorld.mjs';
const ok=(v,m)=>{if(!v)throw Error(m);};
const tick=()=>new Promise(r=>setTimeout(r,25));
const terrain=()=>window.VRWorldContext?.objects.find(o=>o.userData.proceduralVoxelRuntime);
async function until(check){for(let i=0;i<300;i++){if(check())return;await tick();}throw Error('Session startup timed out');}
try {
  window.NodevisionState={currentMode:'HTMLediting',virtualWorldMode:'survival'};window.selectedFilePath='sandbox-test.html';
  const cell=document.getElementById('editor').closest('.panel-cell');cell.replaceChildren();window.activeCell=cell;
  await openPanelTabInCell(cell,{panelType:'FileView',panelClass:'ViewPanel',panelVars:{filePath:'sandbox-test.html'}},host=>host.textContent='Original page');
  const seed=planSandboxWorld(null,'sandbox-test.html',()=>123456).definition;delete seed.metadata.astronomy;
  let html='<html><body>Keep page<script id="nodevision-metaworld" type="application/json">'+JSON.stringify(seed)+'</script></body></html>';
  const native=window.fetch.bind(window),scripts={};
  for(const mode of ['Build','Play'])scripts[mode]=await(await native('/sandbox-builtins/Sandbox'+mode+'.NodevisionSession.js')).text();
  window.fetch=async(url,options)=>{
    const text=String(url);
    if(text.startsWith('/api/sessions/read')){const mode=text.includes('SandboxPlay')?'Play':'Build';return new Response(JSON.stringify({session:{id:'Sandbox'+mode+'.NodevisionSession.js',scope:'builtin',title:'Sandbox — '+mode,source:scripts[mode]}}));}
    if(text==='/Notebook/sandbox-test.html')return new Response(html);
    if(text==='/api/load-world')return new Response(JSON.stringify({worldDefinition:createDefaultHtmlWorld('sandbox-test.html')}));
    if(text==='/api/save'){html=JSON.parse(options.body).content;return new Response('{"success":true}');}
    if(text.includes('GameControllerSettings.json'))return new Response('{}');
    return native(url,options);
  };
  async function launch(mode){window.activeCell=cell;await startSession('builtin','Sandbox'+mode+'.NodevisionSession.js');await until(()=>terrain()?.children.length);}
  await launch('Build');let ctx=window.VRWorldContext,bridge=getActiveMetaWorldLayerBridge(),root=terrain();
  ok(window.NodevisionState.currentMode==='Virtual World Editing','Build editor mode');
  ok(root.userData.colliderRef.containsPlayer,'Sandbox retains finite boundary');
  const def=bridge.getVoxelWorldDefinition(root.userData.metaWorldLayerId),values=voxelWorldForm(def);values.seed='sandbox-regeneration';
  bridge.regenerateVoxelWorld(def.id,definitionFromVoxelForm(values,def));await until(()=>terrain()?.children.length);
  const newSeed=terrain().userData.proceduralVoxelRuntime.definition.generator.seed;
  ok(bridge.worldData.metadata.objectGroundOnly===true,'Sandbox gameplay metadata retained');
  bridge.addObjectLayer({id:'keep-box',type:'box',position:[2,30,2],size:[1,1,1]});
  ok(await ctx.saveVirtualWorldFile(),'Build save');
  const saved=JSON.parse(new DOMParser().parseFromString(html,'text/html').querySelector('#nodevision-metaworld').textContent);
  ok(saved.objects.filter(o=>o.type==='procedural-voxel-world').length===1&&saved.objects.length<5,'compact terrain save');
  root=terrain();await quitActiveSession();ok(root.children.length===0,'Build teardown frees chunks');
  await launch('Play');ctx=window.VRWorldContext;bridge=getActiveMetaWorldLayerBridge();root=terrain();
  ok(root.userData.proceduralVoxelRuntime.definition.generator.seed===newSeed,'Play reuses regenerated seed');
  ok(ctx.objects.some(o=>o.userData.metaWorldLayerId==='keep-box'),'Play preserves authored objects');
  ok(insertVoxelWorld()===false&&bridge.addVoxelWorld(def)===false&&bridge.regenerateVoxelWorld(def.id,def)===false,'Play prevents terrain authoring');
  ok(await ctx.saveVirtualWorldFile()===false,'Play prevents save');
  await quitActiveSession();ok(root.children.length===0&&!window.VRWorldContext,'Play teardown frees scene');
  document.getElementById('result').textContent='PASS: Sandbox Build/Play startup, terrain regeneration, compact save, seeded reload, unrelated objects, authoring permissions and resource teardown';
}catch(error){await quitActiveSession();document.getElementById('result').textContent='FAIL: '+error.stack;}
