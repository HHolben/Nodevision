// Nodevision/scripts/terrain-e2-isolation.mjs
// One settled world, two vegetation systems, unchanged camera/terrain/materials. Swap only proxy ownership or shared box buffer submission to distinguish geometry cost from instancing-resource behavior and software-driver variability.
import * as THREE from '/lib/three/three.module.js';
import {createProceduralVoxelWorld} from '/baseline/MetaWorld/ProceduralVoxelWorld/ProceduralVoxelWorldRuntime.mjs';
import {createVegetationLOD as oldVegetation} from '/baseline/MetaWorld/VegetationLOD/Runtime.mjs';
import {createVegetationLOD as newVegetation} from '/MetaWorld/VegetationLOD/Runtime.mjs';
const renderer=new THREE.WebGLRenderer({antialias:false});renderer.setSize(640,480);renderer.setPixelRatio(1);document.body.append(renderer.domElement);const results=[];
const def={id:'isolation',type:'procedural-voxel-world',position:[0,0,0],size:[1000,128,2000],voxelSize:.25,representation:'voxel',generator:{id:'nodevision-terrain-v1',version:1,seed:42},chunks:{voxelsPerAxis:32,loadRadius:1},generation:{vegetation:true,caves:false,water:false},streaming:{enabled:true,vegetationEnabled:false,visibilityDistance:256,vegetationDistance:128}},root=createProceduralVoxelWorld(THREE,def,[]),r=root.userData.terrainRuntime;await r.ready;r.setRenderDistance(8);
const camera=new THREE.PerspectiveCamera(70,4/3,.1,600),height=r.generator.getTerrainHeight(80,80)*.25;camera.position.set(20,height+3,20);camera.lookAt(50,height+3,50);const scene=new THREE.Scene();scene.background=new THREE.Color(0xc7d8e2);scene.add(root,new THREE.HemisphereLight(0xffffff,0x495745,.8));const sun=new THREE.DirectionalLight(0xffffff,2.2);sun.position.set(-20,35,-10);scene.add(sun);
const summary=a=>{const s=[...a].sort((a,b)=>a-b);return {mean:a.reduce((s,n)=>s+n,0)/a.length,p95:s[Math.floor(s.length*.95)],samples:a.length};};
try{
 const started=performance.now();while(performance.now()-started<60000){for(let i=0;i<5;i++)r.update(camera.position);if(!r.lod.snapshot().queue&&!r.manager.queue.length&&!r.manager.pending)break;await new Promise(resolve=>setTimeout(resolve,0));}
 const materials=[...r.manager.loaded.values()].find(e=>e.mesh).mesh.material,settings={...r.lod.settings,vegetationEnabled:true},systems=[];
 for(const [name,create] of [['baseline',oldVegetation],['modified',newVegetation]]){
  const before=new Set(root.children),system=create(THREE,root,r.definition,r.generator,r.manager,()=>materials,null),start=performance.now();while(performance.now()-start<60000){for(let i=0;i<5;i++)system.update(camera.position,settings);const s=system.snapshot();if(!s.queue&&!s.transitionRegions)break;await new Promise(resolve=>setTimeout(resolve,0));}
  const group=root.children.find(o=>!before.has(o));group.visible=false;system.prepareView(camera);systems.push({name,system,group});
 }
 let originalGeometry=null;systems[0].group.traverse(o=>{if(o.isInstancedMesh&&!originalGeometry)originalGeometry=o.geometry;});if(!originalGeometry)throw Error('No original proxy geometry');const replacements=[];systems[1].group.traverse(o=>{if(o.isInstancedMesh)replacements.push([o,o.geometry]);});
 for(let trial=0;trial<2;trial++)for(const variant of trial?['shared','modified','baseline']:['baseline','modified','shared']){
  for(const item of systems)item.group.visible=item.name===(variant==='baseline'?'baseline':'modified');for(const [mesh,geometry] of replacements)mesh.geometry=variant==='shared'?originalGeometry:geometry;
  const selected=systems[variant==='baseline'?0:1];selected.system.prepareView(camera);console.log('NV_TEST_PROGRESS','E2 submission isolation',trial,variant,JSON.stringify(selected.system.snapshot().shaderMeshes));
  for(let i=0;i<45;i++){renderer.render(scene,camera);await new Promise(requestAnimationFrame);}const frames=[];let calls=0,triangles=0,previous=performance.now();
  for(let i=0;i<180;i++){renderer.render(scene,camera);calls+=renderer.info.render.calls;triangles+=renderer.info.render.triangles;await new Promise(requestAnimationFrame);const now=performance.now();frames.push(now-previous);previous=now;}
  results.push({trial,variant,frameMs:summary(frames),calls:calls/180,triangles:triangles/180,vegetation:selected.system.snapshot()});
 }
 for(const [mesh,geometry] of replacements)mesh.geometry=geometry;
 await fetch('/test/results',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({complete:true,results,method:'Same settled voxel world and camera, 45 warmup/180 measured frames per variant, reverse-order second trial. Modified uses own per-batch box clones; shared uses the exact same old shared box GPU buffers while retaining new matrices/materials/visibility. No runtime updates inside timings.'})});
 systems.forEach(s=>s.system.dispose());r.dispose();document.querySelector('#result').textContent='PASS: E2 same-scene submission isolation';
}catch(error){document.querySelector('#result').textContent='FAIL: '+error.stack;}finally{renderer.dispose();}
