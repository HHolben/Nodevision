// Nodevision/scripts/terrain-e1-vertex-isolate.mjs
// Isolate vertex indexing in one settled scene per world. Reconstruct the exact active quad stream with four vertices per quad, then alternate that layout with candidate shared vertices while holding materials, triangle order, bounds, ownership and runtime constant.
import * as THREE from '/lib/three/three.module.js';
import {createProceduralVoxelWorld} from '/MetaWorld/ProceduralVoxelWorld/ProceduralVoxelWorldRuntime.mjs';
import {createGpuTimer} from '/MetaWorld/TerrainDiagnostics/GpuTimer.mjs';
function unshare(source){
 const geometry=new THREE.BufferGeometry(),ids=[],indices=source.index.array;
 for(let i=0;i<indices.length;i+=6)ids.push(indices[i],indices[i+1],indices[i+2],indices[i+5]);
 for(const [name,attribute] of Object.entries(source.attributes)){
  const data=new attribute.array.constructor(ids.length*attribute.itemSize);
  ids.forEach((id,i)=>data.set(attribute.array.subarray(id*attribute.itemSize,(id+1)*attribute.itemSize),i*attribute.itemSize));
  geometry.setAttribute(name,new THREE.BufferAttribute(data,attribute.itemSize,attribute.normalized));
 }
 const expanded=[];for(let i=0;i<ids.length;i+=4)expanded.push(i,i+1,i+2,i,i+2,i+3);geometry.setIndex(expanded);
 geometry.groups=source.groups.map(g=>({...g}));geometry.boundingSphere=source.boundingSphere.clone();geometry.boundingBox=source.boundingBox?.clone()??null;
 for(let i=0;i<indices.length;i++)for(const name of Object.keys(source.attributes)){
  const a=source.attributes[name],b=geometry.attributes[name];for(let c=0;c<a.itemSize;c++)if(a.array[indices[i]*a.itemSize+c]!==b.array[geometry.index.array[i]*b.itemSize+c])throw Error('Triangle attribute stream changed');
 }
 return geometry;
}
const renderer=new THREE.WebGLRenderer({antialias:false});renderer.setPixelRatio(1);renderer.setSize(640,480);document.body.append(renderer.domElement);
const timer=createGpuTimer(renderer),results=[],summary=a=>{const s=[...a].sort((a,b)=>a-b);return a.length?{samples:a.length,mean:a.reduce((s,v)=>s+v,0)/a.length,p95:s[Math.floor(a.length*.95)],p99:s[Math.floor(a.length*.99)],max:s.at(-1)}:null;};
const save=complete=>fetch('/test/results',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({complete,results,method:'One settled production runtime per world, no runtime updates during isolation; unchanged active triangle attribute stream verified exactly, same material objects and full tile bounds. Three order-reversed trials; all four layer combinations, 45 warmup and 180 measured frames each. Newly completed elapsed-query samples only; readbacks outside timings.',environment:'Chromium SwiftShader, 640x480, pixel ratio 1. Software driver elapsed, not hardware GPU timing.'})});
try{
 for(const scenario of ['large','infinite']){
  const definition={id:'isolate',type:'procedural-voxel-world',size:[1000,64,2000],position:[0,0,0],representation:'polygonal',voxelSize:.25,generator:{id:'nodevision-terrain-v1',version:1,seed:42},chunks:{voxelsPerAxis:32,loadRadius:1},generation:{vegetation:true,caves:false,water:false},streaming:{enabled:true,vegetationEnabled:true,visibilityDistance:512,vegetationDistance:128}};
  if(scenario==='infinite')definition.worldExtent={mode:'infinite'};
  const root=createProceduralVoxelWorld(THREE,definition,[]),r=root.userData.terrainRuntime;await r.ready;r.setRenderDistance(8);
  const scene=new THREE.Scene();scene.add(root,new THREE.AmbientLight(0xffffff,2));const camera=new THREE.PerspectiveCamera(70,4/3,.1,800),h=r.generator.getTerrainHeight(80,80)*.25;camera.position.set(20,h+8,20);camera.lookAt(90,h,90);
  const start=performance.now();let drained=false;
  while(performance.now()-start<60000){for(let i=0;i<10;i++)r.update(camera.position);if(!r.lod.snapshot().queue&&!r.vegetation.snapshot().queue&&!r.manager.queue.length&&!r.manager.pending){drained=true;break;}await new Promise(resolve=>setTimeout(resolve,0));}if(!drained)throw Error('Queues did not drain');
  r.vegetation.prepareView(camera);const terrain=root.getObjectByName('Terrain distance detail'),vegetation=root.getObjectByName('Vegetation distance detail'),meshes=[];
  terrain.traverse(mesh=>{if(mesh.isMesh)meshes.push({mesh,shared:mesh.geometry,unshared:unshare(mesh.geometry)});});
  if(meshes.reduce((n,e)=>n+e.shared.attributes.position.count,0)>=meshes.reduce((n,e)=>n+e.unshared.attributes.position.count,0))throw Error('Vertex reuse candidate is not active');
  for(let trial=0;trial<3;trial++)for(const flags of trial%2?[[true,true],[true,false],[false,true],[false,false]]:[[false,false],[false,true],[true,false],[true,true]]){
   let reference=null;
   for(const variant of trial%2?['shared','unshared']:['unshared','shared']){
    console.log('NV_TEST_PROGRESS',scenario,trial,flags.join(','),variant);terrain.visible=flags[0];vegetation.visible=flags[1];for(const entry of meshes)entry.mesh.geometry=entry[variant];
    timer.begin(false);for(let i=0;i<45;i++){renderer.render(scene,camera);await new Promise(requestAnimationFrame);}
    const target=new THREE.WebGLRenderTarget(160,120),pixels=new Uint8Array(160*120*4);renderer.setRenderTarget(target);renderer.render(scene,camera);renderer.readRenderTargetPixels(target,0,0,160,120,pixels);renderer.setRenderTarget(null);target.dispose();
    let changedPixels=null;if(reference){changedPixels=0;for(let i=0;i<pixels.length;i+=4)if(pixels.slice(i,i+3).some((v,j)=>v!==reference[i+j]))changedPixels++;if(changedPixels)throw Error('Layout changed rendered pixels');}else reference=pixels;
    timer.begin(false);const frame=[],submit=[],gpu=[];let previous=performance.now(),lastSamples=timer.snapshot().samples,calls=0,triangles=0;
    for(let i=0;i<180;i++){
     const t=performance.now();timer.begin(true);renderer.render(scene,camera);timer.end();submit.push(performance.now()-t);calls=renderer.info.render.calls;triangles=renderer.info.render.triangles;
     await new Promise(requestAnimationFrame);const now=performance.now();frame.push(now-previous);previous=now;const q=timer.snapshot();if(q.samples>lastSamples&&q.elapsedMs!==null)gpu.push(q.elapsedMs);lastSamples=q.samples;
    }
    if(Math.max(...frame)>5000)throw Error('Host interruption: rerun isolation');
    results.push({scenario,trial,terrain:flags[0],vegetation:flags[1],variant,changedPixels,frameMs:summary(frame),submitMs:summary(submit),driverMs:summary(gpu),calls,triangles});await save(false);
   }
  }
  for(const entry of meshes){entry.mesh.geometry=entry.shared;entry.unshared.dispose();}r.dispose();renderer.render(new THREE.Scene(),camera);
 }
 await save(true);document.querySelector('#result').textContent='PASS: E1 same-scene vertex isolation';
}catch(error){document.querySelector('#result').textContent='FAIL: '+error.stack;}finally{timer.dispose();renderer.dispose();}
