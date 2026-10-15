// Nodevision/scripts/aegean-seasons-browser.mjs
// This focused session regression verifies that procedural-object authoring preserves the actual Sandbox Build and Play lifecycle, compact persistence, and temporary authoring permissions without depending on fixed tree-foliage fixtures.
import { AEGEAN_DEFAULTS } from '/MetaWorld/Aegean/AegeanDefinition.mjs';
import { startSession, quitActiveSession } from '/Sessions/SessionController.mjs';
import { openPanelTabInCell } from '/panels/panelTabs.mjs';
import { getActiveMetaWorldLayerBridge } from '/MetaWorld/MetaWorldLayerState.mjs';
import { planSandboxWorld } from '/MetaWorld/SandboxWorldPlanner.mjs';
import { createDefaultHtmlWorld } from '/MetaWorld/DefaultHtmlWorld.mjs';
import { definitionFromVoxelForm, voxelWorldForm } from '/MetaWorld/ProceduralVoxelWorld/VoxelAuthoringDefinition.mjs';
import insertVoxelWorld from '/ToolbarCallbacks/insert/insertVoxelWorld.mjs';
import insertPath from '/ToolbarCallbacks/insert/insertPath.mjs';
const ok=(v,m)=>{if(!v)throw Error(m);};
const tick=()=>new Promise(r=>setTimeout(r,25));
const terrain=()=>window.VRWorldContext?.objects.find(o=>o.userData.proceduralVoxelRuntime);
async function until(check){for(let i=0;i<300;i++){if(check())return;await tick();}throw Error('Session startup timed out');}
try {
  window.NodevisionState={currentMode:'HTMLediting',virtualWorldMode:'survival'};window.selectedFilePath='sandbox-test.html';
  const cell=document.getElementById('editor').closest('.panel-cell');cell.replaceChildren();window.activeCell=cell;
  await openPanelTabInCell(cell,{panelType:'FileView',panelClass:'ViewPanel',panelVars:{filePath:'sandbox-test.html'}},host=>host.textContent='Original page');
  const seed=planSandboxWorld(null,'sandbox-test.html',()=>123456).definition;
  seed.metadata.astronomy={model:'earth',observer:{latitude:37.5,longitude:25},clock:{mode:'saved',initialTime:'2026-02-28T21:59:59Z',timezone:'Europe/Athens',timeScale:0},bodies:[{id:'sun',type:'sun',intensity:2}],stars:{enabled:false}};
  const field=seed.objects.find(o=>o.type==='procedural-voxel-world');
  Object.assign(field,{position:[-64,0,-64],size:[128,80,128],heightLimits:{min:-16,max:64},chunks:{voxelsPerAxis:32,loadRadius:1},environment:{...AEGEAN_DEFAULTS,seasonMode:'calendar'}});
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
  ok(insertPath()===true,'Build offers Insert Path');ctx.cancelPathDrawing();
  const road=bridge.updatePath(null,{controlPoints:[[0,15,0],[12,15,0]],surfaceMaterial:'gravel'});
  await until(()=>ctx.astronomy&&terrain().userData.proceduralVoxelRuntime.seasonState.season==='winter');
  ctx.pause();
  const runtime=terrain().userData.proceduralVoxelRuntime,identity=terrain(),materials=runtime.materials;
  const generatorIdentity=JSON.stringify(runtime.definition.generator),sourceEnvironment=JSON.stringify(runtime.definition.environment);
  const samples=[[240,240],[256,256],[280,260]].map(([x,z])=>runtime.generator.getTerrainHeight(x,z));
  for(const [date,season] of [['2026-03-01T12:00:00Z','spring'],['2026-06-01T12:00:00Z','summer'],['2026-12-01T12:00:00Z','winter']]){
    ok(ctx.astronomy.clock.jumpTo(Date.parse(date)),'calendar advances to '+season);
    await until(()=>runtime.seasonState.season===season);
    ok(terrain()===identity&&runtime.materials===materials,'season retains terrain root/material pool');
    ok(ctx.movementState.paused,'season sampling respects paused simulation while streaming');
  }
  ok(JSON.stringify([[240,240],[256,256],[280,260]].map(([x,z])=>runtime.generator.getTerrainHeight(x,z)))===JSON.stringify(samples),'path grading and terrain heights stay fixed');
  ok(JSON.stringify(runtime.definition.generator)===generatorIdentity&&JSON.stringify(runtime.definition.environment)===sourceEnvironment,'clock changes do not rewrite authored generation settings');
  bridge.regenerateVoxelWorld(def.id,runtime.serialize());
  await until(()=>terrain().userData.proceduralVoxelRuntime.seasonState.season==='winter');
  ok(terrain().userData.proceduralVoxelRuntime.definition.protectedRegions.some(r=>r.id==='authored:keep-box'&&r.environment.season==='winter'),'regeneration captures the visible calendar season under newly authored objects');
  ok(await ctx.saveVirtualWorldFile(),'Build save');
  const saved=JSON.parse(new DOMParser().parseFromString(html,'text/html').querySelector('#nodevision-metaworld').textContent);
  ok(saved.objects.filter(o=>o.type==='procedural-voxel-world').length===1&&saved.objects.length<6,'compact terrain save');
  ok(saved.objects.some(o=>o.id===road.id&&o.type==='physical-path'),'Build saves the authored path');
  ok(saved.objects.find(o=>o.id===field.id).environment.seasonMode==='calendar','calendar mode survives save');
  ok(saved.metadata.astronomy.clock.timezone==='Europe/Athens'&&saved.metadata.astronomy.observer.latitude===37.5,'existing clock and observer settings preserved');
  ok(Date.parse(saved.metadata.astronomy.clock.savedTime)>=Date.parse('2026-12-01T12:00:00Z'),'advanced world date saved');
  root=terrain();await quitActiveSession();ok(root.children.length===0,'Build teardown frees chunks');
  await launch('Play');ctx=window.VRWorldContext;bridge=getActiveMetaWorldLayerBridge();root=terrain();
  ok(root.userData.proceduralVoxelRuntime.definition.generator.seed===newSeed,'Play reuses regenerated seed');
  await until(()=>root.userData.proceduralVoxelRuntime.seasonState.season==='winter');
  ok(ctx.astronomy.clock.timezone==='Europe/Athens','Play reopens saved calendar');
  ctx.astronomy.clock.jumpTo(Date.parse('2027-03-01T12:00:00Z'));
  await until(()=>root.userData.proceduralVoxelRuntime.seasonState.season==='spring');
  ok(ctx.objects.some(o=>o.userData.metaWorldLayerId==='keep-box'),'Play preserves authored objects');
  ok(ctx.objects.some(o=>o.userData.metaWorldLayerId===road.id&&o.userData.pathRuntime),'Play loads physical paths');
  ok(insertPath()===false&&bridge.updatePath(road.id,{width:4})===false,'Play prevents path authoring');
  ok(insertVoxelWorld()===false&&bridge.addVoxelWorld(def)===false&&bridge.regenerateVoxelWorld(def.id,def)===false,'Play prevents terrain authoring');
  ok(await ctx.saveVirtualWorldFile()===false,'Play prevents save');
  await quitActiveSession();ok(root.children.length===0&&!window.VRWorldContext,'Play teardown frees scene');
  document.getElementById('result').textContent='PASS: Calendar-driven Aegean seasons in actual Build/Play, paused date jumps, stable terrain/materials/paths, saved date and mode, authoring permissions and teardown';
}catch(error){await quitActiveSession();document.getElementById('result').textContent='FAIL: '+error.stack;}
