// Nodevision/scripts/geographic-browser.mjs
// This browser regression exercises real worker import, shared dialogs, placement, history, rendering, and HTML persistence with locally served synthetic geographic assets.
import * as THREE from '/lib/three/three.module.js';
import { loadWorldFromFile } from '/PanelInstances/ViewPanels/GameViewDependencies/worldLoading.mjs';
import { saveCurrentWorldFile } from '/PanelInstances/ViewPanels/GameViewDependencies/worldSave.mjs';
import { getActiveMetaWorldLayerBridge } from '/MetaWorld/MetaWorldLayerState.mjs';
import { openVoxelWorldDialog } from '/MetaWorld/ProceduralVoxelWorld/VoxelWorldDialog.mjs';
import { openVoxelWorldToolSettings } from '/MetaWorld/ProceduralVoxelWorld/VoxelWorldTool.mjs';
import { voxelWorldPlacementDefinition } from '/MetaWorld/ProceduralVoxelWorld/VoxelWorldToolState.mjs';
import { parseRegions } from '/MetaWorld/Geographic/KmlRegions.mjs';
const ok=(v,m)=>{if(!v)throw Error(m);};
const wait=async fn=>{const start=performance.now();while(!fn()){if(performance.now()-start>15000)throw Error('Timed out: '+document.querySelector('[data-geographic-preview]')?.textContent);await new Promise(r=>setTimeout(r,20));}};
try {
  window.NodevisionState={currentMode:'Virtual World Editing'};
  const panel=document.getElementById('editor'),scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(75,1.6,.1,1000);
  const state={currentWorldPath:'page.html'},movementState={playerMode:'creative',playerHeight:1.75,environment:{},isGrounded:true};
  const context=window.VRWorldContext={THREE,scene,camera,panel,state,movementState,objects:[],colliders:[],lights:[],portals:[],collisionActions:[],useTargets:[],spawnPoints:[],waterVolumes:[],measurementVisuals:[],controls:{getObject:()=>camera},inventory:{getSelectedItem:()=>({id:'procedural-voxel-world'})}};
  const box={id:'authored-box',type:'box',position:[2,30,2],size:[1,1,1],color:'#ff0000',isSolid:true};
  let definition={name:'Geographic test',type:'world',worldType:'NodevisionMetaWorld',spawnPosition:{x:0,y:30,z:0},objects:[box]},savedHtml='';
  const originalFetch=window.fetch;
  window.fetch=async(url,options)=>{
    if(url==='/api/load-world')return {ok:true,json:async()=>({worldDefinition:structuredClone(definition)})};
    if(url==='/Notebook/page.html')return {ok:true,text:async()=>'<html><body><h1>Keep authored page</h1></body></html>'};
    if(url==='/api/save'){savedHtml=JSON.parse(options.body).content;return {ok:true,json:async()=>({success:true})};}
    return originalFetch(url,options);
  };
  await loadWorldFromFile('page.html',state,THREE);let bridge=getActiveMetaWorldLayerBridge();
  const form=()=>document.querySelector('[data-voxel-world-dialog]');
  const button=label=>[...form().querySelectorAll('button')].find(b=>b.textContent===label);
  const set=(name,value)=>{form().elements[name].value=value;form().elements[name].dispatchEvent(new Event('input'));};
  openVoxelWorldToolSettings(bridge);ok(form(),'inventory G settings dialog');
  set('terrainSource','geographic');form().elements.terrainSource.dispatchEvent(new Event('change'));
  set('geo_elevation','/Notebook/dem.tif');set('geo_landcover','/Notebook/cover.tif');set('geo_kml','/Notebook/regions.kml');
  button('Import / Preview').click();await wait(()=>form().querySelector('[data-geographic-preview]').textContent.startsWith('Ready.'));
  const previewText=form().querySelector('[data-geographic-preview]').textContent;ok(previewText.includes('16 × 16')&&previewText.includes('conservative bilinear-support'),'preview metadata');
  button('Apply Settings').click();ok(!form(),'shared tool configuration accepted');
  const placed=voxelWorldPlacementDefinition(bridge,{x:20,y:3,z:30});ok(placed.geographic.elevation.asset.path==='/Notebook/dem.tif','tool preserves portable recipe');
  bridge.addVoxelWorld(placed);let root=context.objects.find(o=>o.userData.proceduralVoxelRuntime),runtime=root.userData.proceduralVoxelRuntime;await runtime.ready;
  const g=runtime.generator;ok(g.getBiome(100,100)==='phrygana','real KML override');
  const start=performance.now();for(let i=0;i<600&&runtime.stats.loaded<2;i++){runtime.update(new THREE.Vector3(20,10,30));await new Promise(r=>requestAnimationFrame(r));}const chunkMs=performance.now()-start;
  const fingerprint=Array.from(g.generateChunk(1,0,1)).join(',');
  scene.add(new THREE.HemisphereLight(0xffffff,0x666666,2));camera.position.set(20,40,70);camera.lookAt(20,5,30);
  const renderer=new THREE.WebGLRenderer();renderer.setSize(400,300);panel.append(renderer.domElement);renderer.render(scene,camera);ok(renderer.info.render.triangles>0,'terrain renders');
  await saveCurrentWorldFile({state,movementState,objects:context.objects,lights:[]});
  const saved=JSON.parse(new DOMParser().parseFromString(savedHtml,'text/html').querySelector('script').textContent);
  ok(savedHtml.includes('Keep authored page')&&saved.objects.some(o=>o.id==='authored-box'),'save retains authored content');
  const id=root.userData.metaWorldLayerId;openVoxelWorldDialog(bridge,id);
  button('Verify saved source files').click();await wait(()=>form().querySelector('[data-geographic-preview]').textContent.includes('match their fingerprints'));
  await originalFetch('/test/change');button('Verify saved source files').click();await wait(()=>form().querySelector('[data-geographic-preview]').textContent.includes('Source changed'));
  ok(Array.from(g.generateChunk(1,0,1)).join(',')===fingerprint,'external changes never regenerate terrain');await originalFetch('/test/restore');
  set('seed','new seed');button('Regenerate').click();ok(!form(),'explicit regeneration');ok(bridge.undo(),'undo');ok(bridge.redo(),'redo');
  definition=saved;await loadWorldFromFile('page.html',state,THREE);bridge=getActiveMetaWorldLayerBridge();root=context.objects.find(o=>o.userData.proceduralVoxelRuntime);runtime=root.userData.proceduralVoxelRuntime;
  ok(Array.from(runtime.generator.generateChunk(1,0,1)).join(',')===fingerprint,'HTML reload matches terrain');ok(JSON.stringify(runtime.definition.geographic)===JSON.stringify(placed.geographic),'recipe preserved');ok(root.position.y===3,'placement preserved');
  bridge.removeObjectLayer(root.userData.metaWorldLayerId);openVoxelWorldDialog(bridge);set('terrainSource','geographic');form().elements.terrainSource.dispatchEvent(new Event('change'));set('geo_elevation','/Notebook/missing.tif');
  button('Import / Preview').click();await wait(()=>form().querySelector('[data-geographic-preview]').textContent.includes('missing or unavailable'));ok(context.objects.length===1,'failed import does not place terrain');
  set('geo_elevation','/Notebook/dem.tif');button('Import / Preview').click();button('Cancel import').click();await wait(()=>form().querySelector('[data-geographic-preview]').textContent.includes('cancelled'));
  button('Import / Preview').click();await wait(()=>form().querySelector('[data-geographic-preview]').textContent.startsWith('Ready.'));button('Generate').click();ok(!form(),'Insert path places imported terrain');
  const kml=await(await originalFetch('/Notebook/regions.kml')).text();ok(parseRegions(kml).length===2,'polygon parser');
  const withHole=kml.replace('</outerBoundaryIs>','</outerBoundaryIs><innerBoundaryIs><LinearRing><coordinates>23.049,39.349 23.051,39.349 23.051,39.351 23.049,39.351 23.049,39.349</coordinates></LinearRing></innerBoundaryIs>');ok(parseRegions(withHole)[0].rings.length===2,'KML holes retained');
  for(const source of [kml.replaceAll('phrygana','forest'),kml.replace('<Polygon>','<Point>'),kml.replace('<Document>','<Document><NetworkLink/>')]){let rejected=false;try{parseRegions(source);}catch{rejected=true;}ok(rejected,'unsupported KML rejected');}
  bridge.removeObjectLayer(context.objects.find(o=>o.userData.proceduralVoxelRuntime).userData.metaWorldLayerId);
  openVoxelWorldDialog(bridge);set('terrainSource','geographic');form().elements.terrainSource.dispatchEvent(new Event('change'));
  set('geo_elevation','/Notebook/large-dem.tif');set('geo_landcover','/Notebook/large-cover.tif');set('geo_crop','23.048,39.348,23.052,39.352');
  button('Import / Preview').click();set('geo_crop','23.049,39.349,23.051,39.351');button('Import / Preview').click();
  await wait(()=>form().querySelector('[data-geographic-preview]').textContent.startsWith('Ready.'));button('Generate').click();ok(!form(),'large-source crop placement');
  root=context.objects.find(o=>o.userData.proceduralVoxelRuntime);runtime=root.userData.proceduralVoxelRuntime;const cropped=runtime.definition.geographic;
  ok(cropped.version===2&&cropped.elevation.source.width===2048&&cropped.elevation.width<100,'only a cropped window persisted');
  ok(cropped.access.transferredBytes<2*1024*1024,'range reads avoid the 16 MiB source');ok(cropped.elevation.samples&&!cropped.elevation.data,'compact binary snapshot');
  const height=runtime.generator.getTerrainHeight(100,100);await saveCurrentWorldFile({state,movementState,objects:context.objects,lights:[]});
  definition=JSON.parse(new DOMParser().parseFromString(savedHtml,'text/html').querySelector('script').textContent);await originalFetch('/test/offline');
  await loadWorldFromFile('page.html',state,THREE);runtime=context.objects.find(o=>o.userData.proceduralVoxelRuntime).userData.proceduralVoxelRuntime;
  ok(runtime.generator.getTerrainHeight(100,100)===height,'offline reload does not access original sources');ok(context.objects.some(o=>o.userData.metaWorldLayerId==='authored-box'),'authored objects survive cropped offline reload');
  await originalFetch('/test/online');
  const {geographicBrowserBenchmark}=await import('/scripts/geographic-browser-benchmark.mjs');
  const benchmark=await geographicBrowserBenchmark({bridge:getActiveMetaWorldLayerBridge(),context,renderer,camera});
  ok(benchmark.worldMeters[0]>=5000&&benchmark.maxLoaded<=256&&benchmark.maxMeshBytes<=128*1024**2,'five-kilometer browser traversal stays bounded');
  renderer.dispose();for(const o of context.objects)o.userData.proceduralVoxelRuntime?.dispose();
  document.getElementById('result').textContent=`PASS: worker import, preview, KML, G settings, placement, rendering, undo/redo, HTML save/reload, missing source, cancellation, Insert; large tiled source, compact crop, rapid changes, offline reload; first two chunks ${chunkMs.toFixed(1)} ms\n${JSON.stringify(benchmark,null,2)}`;
}catch(error){document.getElementById('result').textContent='FAIL: '+error.stack;}
