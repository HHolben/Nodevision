// Nodevision/scripts/terrain-e3-visual.mjs
// Controlled actual WebGL comparisons use identical source, scale, camera, light and materials. Unlit/flat/wire images isolate geometry from vertex shading; heightfield LOD and an experimental quarter-metre grid remain diagnostic references only.
import * as THREE from '/lib/three/three.module.js';
import {surfaceNetSteps} from '/MetaWorld/TerrainRepresentation/SurfaceNets.mjs';
import {naturalGroundNormals} from '/MetaWorld/TerrainRepresentation/GroundNormals.mjs';
import {heightfieldSteps} from '/MetaWorld/TerrainLOD/Heightfield.mjs';
import {createTileMesh} from '/MetaWorld/TerrainLOD/TileMesh.mjs';
import {drainSteps} from '/MetaWorld/ProceduralVoxelWorld/ProgressiveTerrain.mjs';
import {voxelIndex} from '/MetaWorld/ProceduralVoxelWorld/VoxelCoordinates.mjs';
import {createGpuTimer} from '/MetaWorld/TerrainDiagnostics/GpuTimer.mjs';
import {surfaceFixture} from './terrain-e3-fixtures.mjs';
import {surfaceMetrics} from './terrain-e3-metrics.mjs';
const renderer=new THREE.WebGLRenderer({antialias:false,preserveDrawingBuffer:true});renderer.setPixelRatio(1);renderer.setSize(800,500);document.body.append(renderer.domElement);
const timer=createGpuTimer(renderer),records=[],references=new Map(),mats=[new THREE.MeshStandardMaterial({color:0x3f8f46,roughness:.55}),new THREE.MeshStandardMaterial({color:0x3f8f46,roughness:.55}),new THREE.MeshStandardMaterial({color:0x3f8f46,roughness:.55})];
const styles={lit:mats[0],neutral:new THREE.MeshStandardMaterial({color:0x888888,roughness:.55}),unlit:new THREE.MeshBasicMaterial({color:0x888888}),normals:new THREE.MeshNormalMaterial(),wire:new THREE.MeshBasicMaterial({color:0x335533,wireframe:true}),flat:new THREE.MeshStandardMaterial({color:0x888888,roughness:.55,flatShading:true})};
function geometry(result){const g=new THREE.BufferGeometry();for(const [name,size] of [['position',3],['normal',3],['uv',2]])g.setAttribute(name,new THREE.Float32BufferAttribute(result[{position:'positions',normal:'normals',uv:'uvs'}[name]],size));g.setIndex(result.indices);for(const group of result.groups)g.addGroup(group.start,group.count,group.materialIndex);return g;}
function near(f,smooth){
 const group=new THREE.Group(),entries=[];let extractionMs=0,generationMs=0;
 for(let z=0;z<4;z++)for(let x=0;x<4;x++){
  const hs=[f.base.getTerrainHeight(x*32,z*32),f.base.getTerrainHeight(x*32+31,z*32),f.base.getTerrainHeight(x*32,z*32+31),f.base.getTerrainHeight(x*32+31,z*32+31)];
  for(let y=Math.max(0,Math.floor(Math.min(...hs)/32)-1);y<=Math.floor(Math.max(...hs)/32);y++){
   const t=performance.now(),data=new Uint8Array(32768);for(let zz=0;zz<32;zz++)for(let yy=0;yy<32;yy++)for(let xx=0;xx<32;xx++)data[voxelIndex(xx,yy,zz)]=f.getVoxel(x*32+xx,y*32+yy,z*32+zz);generationMs+=performance.now()-t;
   const start=performance.now(),result=drainSteps(surfaceNetSteps(data,[x,y,z],f.getVoxel,smooth?naturalGroundNormals(f,[x,y,z]):null));extractionMs+=performance.now()-start;
   if(!result.indices.length)continue;const g=geometry(result),mesh=new THREE.Mesh(g,mats);mesh.position.set(x*8,y*8,z*8);group.add(mesh);entries.push({geometry:g,offset:mesh.position.toArray()});
  }
 }
 return {group,entries,extractionMs,generationMs};
}
function heightfield(f,level){const start=performance.now(),tile=createTileMesh(THREE,drainSteps(heightfieldSteps(f,f.definition,0,0,level)),mats);return {group:tile.mesh,entries:[{geometry:tile.mesh.geometry}],extractionMs:performance.now()-start,generationMs:0,dispose:()=>tile.dispose()};}
function fineHeightfield(f){
 const start=performance.now(),p=[],n=[],indices=[],count=129;
 for(let z=0;z<count;z++)for(let x=0;x<count;x++){
  const px=Math.min(31.875,x*.25),pz=Math.min(31.875,z*.25),sample=(x,z)=>f.terrainSampler.sample(Math.max(0,Math.min(31.875,x)),Math.max(0,Math.min(31.875,z))).elevation;
  const dx=sample(px+.25,pz)-sample(px-.25,pz),dz=sample(px,pz+.25)-sample(px,pz-.25),l=Math.hypot(dx,.5,dz);p.push(x*.25,sample(px,pz),z*.25);n.push(-dx/l,.5/l,-dz/l);
 }
 for(let z=0;z<count-1;z++)for(let x=0;x<count-1;x++){const i=z*count+x;indices.push(i,i+count,i+count+1,i,i+count+1,i+1);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(n,3));g.setIndex(indices);return {group:new THREE.Mesh(g,mats[0]),entries:[{geometry:g}],extractionMs:performance.now()-start,generationMs:0};
}
const summary=a=>{const s=[...a].sort((a,b)=>a-b);return a.length?{samples:a.length,mean:a.reduce((s,n)=>s+n,0)/a.length,p95:s[Math.floor(a.length*.95)],max:s.at(-1)}:null;};
try{
 for(const name of ['gentle','steep','edited']){
  const f=surfaceFixture(name),scene=new THREE.Scene();scene.background=new THREE.Color(0xc7d8e2);scene.add(new THREE.HemisphereLight(0xffffff,0x495745,.8));const sun=new THREE.DirectionalLight(0xffffff,2.2);sun.position.set(-20,35,-10);scene.add(sun);
  const camera=new THREE.PerspectiveCamera(62,800/500,.1,150);camera.position.set(5,f.analytic(5,5)+2,5);camera.lookAt(20,f.analytic(20,20),20);
  for(const variant of ['original','modified','lod1','lod2','heightfield025']){
   console.log('NV_TEST_PROGRESS',name,variant);const built=variant==='original'?near(f,false):variant==='modified'?near(f,true):variant==='heightfield025'?fineHeightfield(f):heightfield(f,variant==='lod1'?1:2);scene.add(built.group);
   const measured=surfaceMetrics(built.entries,f),pictures={},unchanged={};
   for(const [style,material] of Object.entries(styles)){
    scene.overrideMaterial=material;renderer.render(scene,camera);const data=renderer.domElement.toDataURL('image/png'),key=name+':'+style;
    if(variant==='original')references.set(key,data);if(variant==='modified'&&['unlit','wire','flat'].includes(style)){unchanged[style]=references.get(key)===data;if(!unchanged[style])throw Error('Normal-only correction changed '+style+' render');}
    const filename=name+'-'+variant+'-'+style+'.png';await fetch('/test/image',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:filename,data})});pictures[style]='TerrainE3Visuals/'+filename;
   }
   scene.overrideMaterial=styles.lit;timer.begin(false);for(let i=0;i<30;i++){renderer.render(scene,camera);await new Promise(requestAnimationFrame);}
   timer.begin(false);const frames=[],submit=[],gpu=[];let previous=performance.now(),last=timer.snapshot().samples,calls=0,triangles=0;
   for(let i=0;i<90;i++){const t=performance.now();timer.begin(true);renderer.render(scene,camera);timer.end();submit.push(performance.now()-t);calls=renderer.info.render.calls;triangles=renderer.info.render.triangles;await new Promise(requestAnimationFrame);const now=performance.now();if(now-previous>5000)throw Error('Host interruption');frames.push(now-previous);previous=now;const q=timer.snapshot();if(q.samples>last&&q.elapsedMs!==null)gpu.push(q.elapsedMs);last=q.samples;}
   records.push({name,variant,...measured,extractionMs:built.extractionMs,generationMs:built.generationMs,frameMs:summary(frames),submissionMs:summary(submit),driverMs:summary(gpu),calls,submittedTriangles:triangles,pictures,unchangedGeometryRenders:unchanged});
   await fetch('/test/results',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({complete:false,records,environment:'Chromium SwiftShader, 800x500, pixel ratio 1; identical camera and materials within each scene. Existing quantized sampler; analytic fixture is only the known error reference.'})});
   scene.remove(built.group);if(built.dispose)built.dispose();else built.entries.forEach(e=>e.geometry.dispose());
  }
 }
 await fetch('/test/results',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({complete:true,records,environment:'Chromium SwiftShader, 800x500; software elapsed queries are not hardware GPU times. Diagnostic frames only, not a production FPS guarantee.'})});document.querySelector('#result').textContent='PASS: E3 controlled visual comparisons';
}catch(error){document.querySelector('#result').textContent='FAIL: '+error.stack;}finally{timer.dispose();renderer.dispose();}
