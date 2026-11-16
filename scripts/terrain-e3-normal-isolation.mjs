// Nodevision/scripts/terrain-e3-normal-isolation.mjs
// Swap only normal buffers in one fully settled production scene, holding all geometry, materials, camera and uniforms constant. Unlit controls ignore the buffers and expose software-driver/host variation independently of shading values.
import * as THREE from '/lib/three/three.module.js';
import {createProceduralVoxelWorld} from '/MetaWorld/ProceduralVoxelWorld/ProceduralVoxelWorldRuntime.mjs';
import {surfaceNetSteps} from '/MetaWorld/TerrainRepresentation/SurfaceNets.mjs';
import {drainSteps} from '/MetaWorld/ProceduralVoxelWorld/ProgressiveTerrain.mjs';
import {createGpuTimer} from '/MetaWorld/TerrainDiagnostics/GpuTimer.mjs';
const renderer=new THREE.WebGLRenderer({antialias:false});renderer.setPixelRatio(1);renderer.setSize(640,480);document.body.append(renderer.domElement);
const geo=await(await fetch('/test/geographic')).json();
const timer=createGpuTimer(renderer),results=[],basic=new THREE.MeshBasicMaterial({color:0x3f8f46});
const summary=a=>{const s=[...a].sort((a,b)=>a-b);return a.length?{mean:a.reduce((n,v)=>n+v,0)/a.length,p95:s[Math.floor(s.length*.95)],samples:a.length,max:s.at(-1)}:null;};
const save=complete=>fetch('/test/results',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({complete,results,method:'One settled production runtime per world; only normal BufferAttributes swap; no runtime updates. Three reversed-order pairs, 45 warmup and 180 measured frames per condition; lit and unlit controls. Newly completed async GPU samples only.',environment:'Chromium SwiftShader, 640x480, pixel ratio 1. Driver queries are software execution, not hardware GPU measurements.'})});
try{
 for(const scenario of ['large','infinite','geographic']){
  let def={id:'normals',type:'procedural-voxel-world',size:[1000,64,2000],position:[0,0,0],voxelSize:.25,representation:'polygonal',polygonalGroundStyle:'smooth-natural',generator:{id:'nodevision-terrain-v1',version:1,seed:42},chunks:{voxelsPerAxis:32,loadRadius:1},generation:{vegetation:true,water:false,caves:false},streaming:{enabled:true,vegetationEnabled:true,visibilityDistance:512,vegetationDistance:128}};if(scenario==='infinite')def.worldExtent={mode:'infinite'};if(scenario==='geographic')def={...geo,position:[0,0,0],representation:'polygonal',polygonalGroundStyle:'smooth-natural',streaming:def.streaming};
  const root=createProceduralVoxelWorld(THREE,def,[]),r=root.userData.terrainRuntime;await r.ready;r.setRenderDistance(8);
  const scene=new THREE.Scene();scene.background=new THREE.Color(0xc7d8e2);scene.add(root,new THREE.HemisphereLight(0xffffff,0x495745,.8));const sun=new THREE.DirectionalLight(0xffffff,2.2);sun.position.set(-20,35,-10);scene.add(sun);
  let anchor=20;if(scenario==='geographic')for(let i=1;i<10;i++){const p=Math.min(def.size[0],def.size[2])*i/10;if(r.sampleTerrainSource(p,p).covered){anchor=p;break;}}const ground=r.generator.getTerrainHeight(Math.floor(anchor*4),Math.floor(anchor*4))*.25,camera=new THREE.PerspectiveCamera(70,4/3,.1,800);camera.position.set(anchor,ground+3,anchor);camera.lookAt(anchor+30,ground,anchor+30);
  const started=performance.now();let drained=false;while(performance.now()-started<60000){for(let i=0;i<10;i++)r.update(camera.position);if(!r.lod.snapshot().queue&&!r.vegetation.snapshot().queue&&!r.manager.queue.length&&!r.manager.pending){drained=true;break;}await new Promise(resolve=>setTimeout(resolve,0));}if(!drained)throw Error('Queues failed to drain');r.vegetation.prepareView(camera);
  const meshes=[];for(const entry of r.manager.loaded.values())if(entry.mesh){
   const g=entry.mesh.geometry,raw=drainSteps(surfaceNetSteps(entry.data,entry.cell,r.generator.getRenderVoxel));
   if(raw.normals.length!==g.attributes.normal.array.length)throw Error('Normal-only isolation geometry mismatch');for(let i=0;i<raw.positions.length;i++)if(Math.fround(raw.positions[i])!==g.attributes.position.array[i])throw Error('Vertex positions changed');
   meshes.push({geometry:g,baseline:new THREE.Float32BufferAttribute(raw.normals,3),modified:g.attributes.normal});
  }
  for(let trial=0;trial<3;trial++)for(const shading of trial%2?['unlit','lit']:['lit','unlit'])for(const variant of trial%2?['modified','baseline']:['baseline','modified']){
   console.log('NV_TEST_PROGRESS',scenario,trial,shading,variant);scene.overrideMaterial=shading==='unlit'?basic:null;for(const mesh of meshes)mesh.geometry.setAttribute('normal',mesh[variant]);
   timer.begin(false);for(let i=0;i<45;i++){renderer.render(scene,camera);await new Promise(requestAnimationFrame);}
   timer.begin(false);const frame=[],gpu=[],submit=[];let previous=performance.now(),last=timer.snapshot().samples,calls=0,triangles=0;
   for(let i=0;i<180;i++){const t=performance.now();timer.begin(true);renderer.render(scene,camera);timer.end();submit.push(performance.now()-t);calls=renderer.info.render.calls;triangles=renderer.info.render.triangles;await new Promise(requestAnimationFrame);const now=performance.now();if(now-previous>5000)throw Error('Host interruption');frame.push(now-previous);previous=now;const q=timer.snapshot();if(q.samples>last&&q.elapsedMs!==null)gpu.push(q.elapsedMs);last=q.samples;}
   results.push({scenario,trial,shading,variant,frameMs:summary(frame),driverMs:summary(gpu),submissionMs:summary(submit),calls,triangles});await save(false);
  }
  for(const mesh of meshes)mesh.geometry.setAttribute('normal',mesh.modified);r.dispose();renderer.render(new THREE.Scene(),camera);
 }
 await save(true);document.querySelector('#result').textContent='PASS: E3 same-scene normal buffer isolation';
}catch(error){document.querySelector('#result').textContent='FAIL: '+error.stack;}finally{timer.dispose();renderer.dispose();basic.dispose();}
