// Nodevision/scripts/vegetation-phase-c-native.mjs
// Runs the production GameView panel and its live render, input, inspector, and streaming loops with the actual global toolbar and production persistence endpoints.
import {enableFpsOverlay,disableFpsOverlay} from '/FpsOverlay.mjs';
import {setupPanel} from '/PanelInstances/ViewPanels/GameView.mjs';
import {createToolbar} from '/panels/createToolbar.mjs';
import {getActiveMetaWorldLayerBridge,selectMetaWorldObject} from '/MetaWorld/MetaWorldLayerState.mjs';
import {saveCurrentWorldFile} from '/PanelInstances/ViewPanels/GameViewDependencies/worldSave.mjs';
import {terrainDiagnostics} from '/MetaWorld/TerrainDiagnostics/Snapshot.mjs';
import {verifyInstalledGroundNormals} from './terrain-e3-native-probe.mjs';
const check=(v,m)=>{if(!v)throw Error(m);};
const wait=async(fn,label)=>{const end=performance.now()+120000;while(!fn()){if(performance.now()>end)throw Error(label);await new Promise(r=>setTimeout(r,25));}};
try{
 window.NodevisionState={currentMode:'Virtual World Editing',virtualWorldMode:'creative'};
 await createToolbar();const panel=document.getElementById('editor');Object.assign(panel.style,{width:'800px',height:'600px'});
 console.log('NV_TEST_PROGRESS','native GameView setup');await setupPanel(panel,{filePath:'world.html'});check(await panel.worldReady,'Native GameView startup');
 let ctx=window.VRWorldContext,root=ctx.objects.find(o=>o.userData.terrainRuntime),runtime=root.userData.terrainRuntime;await runtime.ready;runtime.setRenderDistance(8);
 enableFpsOverlay({persist:false});
 const source=JSON.stringify(runtime.serialize().geographic),id=runtime.definition.id;
 await wait(()=>runtime.manager.loaded.size>0,'Initial native terrain');
 selectMetaWorldObject(id);check(document.body.textContent.includes('Active representation: voxel'),'Native Y inspector source and active representation');
 const buttons=()=>[...document.querySelectorAll('button')];buttons().find(b=>b.textContent.trim()==='View').click();buttons().find(b=>b.textContent.trim().endsWith('Terrain Representation')).click();
 await wait(()=>document.querySelector('#sub-toolbar [aria-label="Terrain representation"]'),'Native toolbar control');
 await wait(()=>runtime.lod.snapshot().tiles>0,'Native coarse geometry');
 const controls=[...document.querySelectorAll('button')].find(b=>b.textContent==='Apply landscape settings');check(controls,'Native landscape settings');
 document.querySelector('[aria-label="Vegetation visibility (metres)"]').value='128';document.querySelector('[aria-label="Show distant vegetation"]').checked=true;document.querySelector('[aria-label="Terrain visibility (metres)"]').value='256';controls.click();check(runtime.definition.streaming.visibilityDistance===256,'Settings reach runtime');
 await wait(()=>runtime.vegetation.snapshot().representedTrees>0,'Native vegetation proxy geometry');
 const results=[],groundNormals=[];
 for(const value of ['polygonal','voxel','polygonal']){
  const old=root.children.filter(m=>m.geometry).map(m=>m.geometry.uuid),mode=document.querySelector('#sub-toolbar [aria-label="Terrain representation"]');mode.value=value;mode.dispatchEvent(new Event('change',{bubbles:true}));
  await wait(()=>!mode.disabled,'Native switch finishes');check(runtime.representation===value,'Native active renderer');check(root.children.filter(m=>m.geometry).every(m=>!old.includes(m.geometry.uuid)),'Native geometry replaced');
  check(JSON.stringify(runtime.serialize().geographic)===source,'Native geographic source preserved');results.push(terrainDiagnostics(ctx));
  if(value==='polygonal'){
   groundNormals.push(await verifyInstalledGroundNormals(runtime));
   const style=document.querySelector('#sub-toolbar [aria-label="Polygonal ground style"]');check(style&&!style.disabled,'Existing terrain controls expose ground style');style.value='smooth-natural';style.dispatchEvent(new Event('change',{bubbles:true}));
   await wait(()=>!style.disabled,'Ground style update finishes');check(runtime.polygonalGroundStyle==='smooth-natural','Smooth ground becomes active');const smooth=await verifyInstalledGroundNormals(runtime);check(smooth.changedNormalComponents>0,'Smooth ground reaches installed Editor buffers');groundNormals.push(smooth);
   if(groundNormals.length===2){
    let bridge=getActiveMetaWorldLayerBridge();bridge.undo();ctx=window.VRWorldContext;root=ctx.objects.find(o=>o.userData.terrainRuntime);runtime=root.userData.terrainRuntime;await runtime.ready;check(runtime.polygonalGroundStyle==='standard','Undo restores standard ground');
    bridge=getActiveMetaWorldLayerBridge();bridge.redo();ctx=window.VRWorldContext;root=ctx.objects.find(o=>o.userData.terrainRuntime);runtime=root.userData.terrainRuntime;await runtime.ready;check(runtime.polygonalGroundStyle==='smooth-natural','Redo restores smooth ground');await wait(()=>runtime.manager.loaded.size>0,'Redo detailed terrain');
   }
  }
 }
 check(terrainDiagnostics(ctx).frame?.samples>0,'Native render-loop frame diagnostics');
 await wait(()=>runtime.vegetation.snapshot().continuity.trackedFeatures>0,'E2 ownership rebuild after history');const continuity=runtime.vegetation.snapshot();check(continuity.continuity.trackedFeatures>0&&continuity.continuity.trackedFeatures<=4095,'E2 production feature ownership is bounded');check(continuity.transitionRegions<=4&&continuity.transitionBytes<=2*1048576,'E2 transition geometry stays bounded');check(continuity.continuity.durationMs===350,'E2 production controlled duration');check(!ctx.renderer?.info.programs?.some(p=>p.diagnostics?.runnable===false),'E2 production shaders compile');
 const timing=terrainDiagnostics(ctx).renderTiming;
 check(timing&&timing.updateCpuMs>=0&&timing.submissionCpuMs>=0,'Native update and renderer submission timings');
 check(timing.gpu.elapsedMs===null||timing.gpu.elapsedMs>=0,'GPU query time is measured or explicitly unavailable');
 check(timing.gpu.pending<=4,'Native GPU query queue remains bounded');
 check(await saveCurrentWorldFile({state:ctx.state,movementState:ctx.movementState,objects:ctx.objects,lights:ctx.lights}),'Native save');
 panel.cleanup();window.NodevisionState.currentMode='Virtual World Viewing';
 await setupPanel(panel,{filePath:'world.html',viewPermissions:{authoring:false}});check(await panel.worldReady,'Native Viewer reopen');ctx=window.VRWorldContext;root=ctx.objects.find(o=>o.userData.terrainRuntime);runtime=root.userData.terrainRuntime;
 await runtime.ready;check(runtime.definition.streaming.visibilityDistance===256&&runtime.definition.streaming.vegetationDistance===128&&runtime.definition.streaming.vegetationEnabled,'Viewer persists vegetation settings');check(runtime.representation==='polygonal','Native Viewer persisted mode');check(runtime.polygonalGroundStyle==='smooth-natural','Viewer persists smooth ground style');check(JSON.stringify(runtime.serialize().geographic)===source,'Native Viewer source preserved');
 await wait(()=>runtime.lod.snapshot().tiles>0,'Native Viewer renders persisted coarse geometry');
 await wait(()=>runtime.vegetation.snapshot().representedTrees>0,'Viewer vegetation geometry');
 await wait(()=>runtime.manager.loaded.size>0,'Viewer detailed terrain');groundNormals.push(await verifyInstalledGroundNormals(runtime));
 console.log('NV_TEST_PROGRESS','E3 installed Editor/Viewer normals',JSON.stringify(groundNormals));
 check(runtime.vegetation.snapshot().continuity.trackedFeatures>0,'E2 Viewer rebuilds transient feature ownership');console.log('NV_TEST_PROGRESS','E2 Editor/Viewer continuity',JSON.stringify(runtime.vegetation.snapshot().continuity));
 await fetch('/test/results',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({native:results,groundNormals})});
 disableFpsOverlay({persist:false});panel.cleanup();document.getElementById('result').textContent='PASS: production GameView panel, actual render loop, inspector, View controls, save and Viewer reopen';
}catch(error){document.getElementById('result').textContent='FAIL: '+error.stack;}
