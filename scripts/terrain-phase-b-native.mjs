// Nodevision/scripts/terrain-phase-b-native.mjs
// Runs the production GameView panel and its live render, input, inspector, and streaming loops with the actual global toolbar and production persistence endpoints.
import {enableFpsOverlay,disableFpsOverlay} from '/FpsOverlay.mjs';
import {setupPanel} from '/PanelInstances/ViewPanels/GameView.mjs';
import {createToolbar} from '/panels/createToolbar.mjs';
import {getActiveMetaWorldLayerBridge,selectMetaWorldObject} from '/MetaWorld/MetaWorldLayerState.mjs';
import {saveCurrentWorldFile} from '/PanelInstances/ViewPanels/GameViewDependencies/worldSave.mjs';
import {terrainDiagnostics} from '/MetaWorld/TerrainDiagnostics/Snapshot.mjs';
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
 document.querySelector('[aria-label="Terrain visibility (metres)"]').value='256';controls.click();check(runtime.definition.streaming.visibilityDistance===256,'Settings reach runtime');
 const results=[];
 for(const value of ['polygonal','voxel','polygonal']){
  const old=root.children.filter(m=>m.geometry).map(m=>m.geometry.uuid),mode=document.querySelector('#sub-toolbar [aria-label="Terrain representation"]');mode.value=value;mode.dispatchEvent(new Event('change',{bubbles:true}));
  await wait(()=>!mode.disabled,'Native switch finishes');check(runtime.representation===value,'Native active renderer');check(root.children.filter(m=>m.geometry).every(m=>!old.includes(m.geometry.uuid)),'Native geometry replaced');
  check(JSON.stringify(runtime.serialize().geographic)===source,'Native geographic source preserved');results.push(terrainDiagnostics(ctx));
 }
 check(terrainDiagnostics(ctx).frame?.samples>0,'Native render-loop frame diagnostics');
 check(await saveCurrentWorldFile({state:ctx.state,movementState:ctx.movementState,objects:ctx.objects,lights:ctx.lights}),'Native save');
 panel.cleanup();window.NodevisionState.currentMode='Virtual World Viewing';
 await setupPanel(panel,{filePath:'world.html',viewPermissions:{authoring:false}});check(await panel.worldReady,'Native Viewer reopen');ctx=window.VRWorldContext;root=ctx.objects.find(o=>o.userData.terrainRuntime);runtime=root.userData.terrainRuntime;
 await runtime.ready;check(runtime.definition.streaming.visibilityDistance===256,'Viewer persists LOD settings');check(runtime.representation==='polygonal','Native Viewer persisted mode');check(JSON.stringify(runtime.serialize().geographic)===source,'Native Viewer source preserved');
 await wait(()=>runtime.lod.snapshot().tiles>0,'Native Viewer renders persisted coarse geometry');
 await fetch('/test/results',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({native:results})});
 disableFpsOverlay({persist:false});panel.cleanup();document.getElementById('result').textContent='PASS: production GameView panel, actual render loop, inspector, View controls, save and Viewer reopen';
}catch(error){document.getElementById('result').textContent='FAIL: '+error.stack;}
