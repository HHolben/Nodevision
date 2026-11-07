// Nodevision/scripts/terrain-phase-a-benchmarks.mjs
// Measures current and baseline terrain runtimes with identical software-rendered camera traces, separating startup, streaming, CPU mesh work, switching, and resident resources.
import * as THREE from '/lib/three/three.module.js';
import { terrainDiagnostics } from '/MetaWorld/TerrainDiagnostics/Snapshot.mjs';
import { fromArrayBuffer, writeArrayBuffer } from '/vendor/geographic/reader.mjs';
import { rasterMetadata } from '/MetaWorld/Geographic/RasterMetadata.mjs';
import { importCrop } from '/MetaWorld/Geographic/WindowImport.mjs';
import { finishRecipe } from '/MetaWorld/Geographic/RecipeV2.mjs';
import { validatePath } from '/MetaWorld/Paths/PathDefinition.mjs';
import { ribbonForPath, samplePath } from '/MetaWorld/Paths/PathGeometry.mjs';
const average=v=>v.reduce((a,b)=>a+b,0)/(v.length||1),p95=v=>[...v].sort((a,b)=>a-b)[Math.floor(v.length*.95)]||0;
const frame=()=>new Promise(requestAnimationFrame);
const base={id:'terrain',type:'procedural-voxel-world',position:[0,0,0],size:[32,32,32],voxelSize:.25,generator:{id:'nodevision-terrain-v1',version:1,seed:42},chunks:{voxelsPerAxis:32,loadRadius:1},generation:{vegetation:false,water:false,caves:false}};
async function cases(){
  const values=new Float32Array(64*64);for(let z=0;z<64;z++)for(let x=0;x<64;x++)values[x+64*z]=100+x*.0625+z*.03125;
  const image=await (await fromArrayBuffer(writeArrayBuffer(values,{width:64,height:64,ModelPixelScale:[.5,.5,0],ModelTiepoint:[0,0,0,675000,4362000,0],GTModelTypeGeoKey:1,ProjectedCSTypeGeoKey:32634,GTRasterTypeGeoKey:1,SampleFormat:[3],BitsPerSample:[32]}))).getImage();
  const settings={crop:rasterMetadata(image).bounds,fitCoverage:true};
  const geographic=finishRecipe(await importCrop({image,asset:async()=>({path:'/Notebook/synthetic-dem.tif',sha256:'a'.repeat(64)}),stats:()=>({})},settings),settings);
  const original=await (await fetch('/test/original')).json(),supplied=original.objects.find(o=>o.terrainSource==='geographic');
  return [{name:'small-procedural',definition:base},{name:'synthetic-geotiff',definition:{...base,terrainSource:'geographic',geographic,size:geographic.size}},
    {name:'supplied-geographic',definition:supplied},{name:'4km-procedural',definition:{...base,size:[4096,64,4096]}},
    {name:'excavation-and-object',definition:base,edited:true}];
}
async function measure(create,item,version){
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(60,4/3,.1,2000),colliders=[];
  const renderer=new THREE.WebGLRenderer();renderer.setSize(640,480);document.getElementById('editor').replaceChildren(renderer.domElement);
  const start=performance.now(),root=create(THREE,{...structuredClone(item.definition),streaming:{enabled:false}},colliders),runtime=root.userData.terrainRuntime;scene.add(root);await runtime.ready;
  runtime.setRenderDistance(8);const startupMs=performance.now()-start;
  const marker=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial({color:'orange'}));marker.position.copy(root.position).add(new THREE.Vector3(12,20,12));scene.add(marker);
  const applyEdits=runtime=>{if(item.edited){
    const path=validatePath({id:'cut',controlPoints:[[2,3,12],[28,3,12]],width:2,terrainInteraction:'excavate',elevationMode:'authored',interpolation:'straight'});
    runtime.setPathConstraints([ribbonForPath(path,samplePath(THREE,path))]);
    const bounds={min:[10,0,10],max:[13,16,13]};runtime.setConstructions([{bounds,cuts:[bounds],sample:()=>null}], [bounds]);
  }};
  applyEdits(runtime);
  scene.add(new THREE.HemisphereLight(0xffffff,0x888888,3));
  const context={THREE,scene,camera,renderer,objects:[root,marker]},point=root.position.clone().add(new THREE.Vector3(12,20,12));
  point.y=Math.max(point.y,(runtime.sampleTerrainSource(point.x,point.z).elevation || 0)+6);
  camera.position.copy(point).add(new THREE.Vector3(0,25,35));camera.lookAt(point);
  const render=()=>{runtime.update(point);renderer.render(scene,camera);};
  let firstVisibleMs=null;const fillStart=performance.now();
  do {await frame();render();if(firstVisibleMs===null&&root.children.some(m=>m.visible))firstVisibleMs=performance.now()-start;} while((runtime.manager.queue.length||runtime.manager.pending||!runtime.manager.loaded.size)&&performance.now()-fillStart<60000);
  const fillMs=performance.now()-start,fillComplete=!runtime.manager.queue.length&&!runtime.manager.pending,rows=[];
  for(const mode of ['voxel','polygonal']){
    const switchStart=performance.now();if(mode!==runtime.representation){let done=false;const switching=runtime.setRepresentation(mode).finally(()=>{done=true;});while(!done){await frame();render();}await switching;}const switchMs=performance.now()-switchStart;
    const stationary=[],moving=[];let last=await frame();const began=performance.now(),generated=runtime.stats.generated;
    for(let i=0;i<120;i++){
      const now=await frame();(i<60?stationary:moving).push(now-last);last=now;
      if(i>=60)point.x=root.position.x+12+(i-60)*.25;
      camera.position.copy(point).add(new THREE.Vector3(0,25,35));camera.lookAt(point);render();
    }
    const diagnostic=terrainDiagnostics(context);rows.push({version,case:item.name,mode,startupMs,firstVisibleMs,fillMs,fillComplete,switchMs,
      stationaryFrameMs:average(stationary),stationaryP95Ms:p95(stationary),movingFrameMs:average(moving),movingP95Ms:p95(moving),
      generationThroughput:(runtime.stats.generated-generated)/((performance.now()-began)/1000),...diagnostic});
    point.copy(root.position).add(new THREE.Vector3(12,20,12));point.y=Math.max(point.y,(runtime.sampleTerrainSource(point.x,point.z).elevation||0)+6);
  }
  const backStart=performance.now();let backDone=false;const back=runtime.setRepresentation('voxel').finally(()=>{backDone=true;});while(!backDone){await frame();render();}await back;
  rows[0].switchMs=performance.now()-backStart;
  runtime.setRenderDistance(64);
  for(let i=0;i<120;i++){await frame();point.x=root.position.x+12+i*.5;render();}
  rows[0].maximumDistanceProbe=terrainDiagnostics(context);
  runtime.dispose();
  // Measure a fresh polygonal runtime as well as the initial voxel runtime.
  const coldStart=performance.now(),coldRoot=create(THREE,{...structuredClone(item.definition),representation:'polygonal',streaming:{enabled:false}},colliders),cold=coldRoot.userData.terrainRuntime;
  scene.add(coldRoot);await cold.ready;cold.setRenderDistance(8);applyEdits(cold);
  const coldStartupMs=performance.now()-coldStart;point.copy(coldRoot.position).add(new THREE.Vector3(12,20,12));point.y=Math.max(point.y,(cold.sampleTerrainSource(point.x,point.z).elevation||0)+6);
  camera.position.copy(point).add(new THREE.Vector3(0,25,35));camera.lookAt(point);let coldFirst=null;
  do{await frame();cold.update(point);renderer.render(scene,camera);if(coldFirst===null&&coldRoot.children.length)coldFirst=performance.now()-coldStart;}while((cold.manager.queue.length||cold.manager.pending||!cold.manager.loaded.size)&&performance.now()-coldStart<60000);
  Object.assign(rows[1],{startupMs:coldStartupMs,firstVisibleMs:coldFirst,fillMs:performance.now()-coldStart,fillComplete:!cold.manager.queue.length&&!cold.manager.pending});
  cold.dispose();marker.geometry.dispose();marker.material.dispose();renderer.dispose();return rows;
}
try{
  const definitions=await cases(),results=[];
  for(const version of ['baseline','current']){
    const prefix=version==='baseline'?'/baseline':'';
    const {createProceduralVoxelWorld}=await import(`${prefix}/MetaWorld/ProceduralVoxelWorld/ProceduralVoxelWorldRuntime.mjs`);
    for(const item of definitions){console.log('NV_TEST_PROGRESS',version,item.name);results.push(...await measure(createProceduralVoxelWorld,item,version));}
  }
  await fetch('/test/results',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({environment:{userAgent:navigator.userAgent,viewport:[640,480],renderer:'Chromium SwiftShader; software rendering, not desktop GPU performance',radius:1,movement:'.25 m/frame along +X for 60 frames after 60 stationary frames; nominal 15 m/s at 60 fps'},benchmarks:results})});
  document.getElementById('result').textContent='PASS: Phase A baseline/current benchmark matrix\n'+JSON.stringify(results.map(r=>({version:r.version,case:r.case,mode:r.mode,fillMs:r.fillMs,switchMs:r.switchMs})),null,2);
}catch(error){document.getElementById('result').textContent='FAIL: '+error.stack;}
