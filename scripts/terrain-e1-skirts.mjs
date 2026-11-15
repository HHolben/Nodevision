// Nodevision/scripts/terrain-e1-isolate.mjs
// Uses settled production terrain to isolate resolution, shading, traversal and independent distant-layer costs with alternating repeated trials.
import {skirtFilter} from '/scripts/terrain-e1-skirt-filter.mjs';
import * as THREE from '/lib/three/three.module.js';
import {createProceduralVoxelWorld} from '/MetaWorld/ProceduralVoxelWorld/ProceduralVoxelWorldRuntime.mjs';
import {createGpuTimer} from '/MetaWorld/TerrainDiagnostics/GpuTimer.mjs';
const renderer=new THREE.WebGLRenderer({antialias:false});renderer.setPixelRatio(1);renderer.setSize(640,480);document.body.append(renderer.domElement);
const timer=createGpuTimer(renderer),results=[],summary=a=>{const s=[...a].sort((a,b)=>a-b);return {mean:a.reduce((a,b)=>a+b,0)/a.length,p95:s[Math.floor(s.length*.95)],p99:s[Math.floor(s.length*.99)]};};
try{
 const root=createProceduralVoxelWorld(THREE,{id:'profile',type:'procedural-voxel-world',size:[1000,64,2000],position:[0,0,0],representation:'polygonal',worldExtent:{mode:'infinite'},voxelSize:.25,generator:{id:'nodevision-terrain-v1',version:1,seed:42},chunks:{voxelsPerAxis:32,loadRadius:1},generation:{vegetation:true,caves:false,water:false},streaming:{enabled:true,vegetationEnabled:true,visibilityDistance:512,vegetationDistance:128}},[]);
 const r=root.userData.terrainRuntime;await r.ready;r.setRenderDistance(8);const scene=new THREE.Scene();scene.add(root,new THREE.AmbientLight(0xffffff,2));const camera=new THREE.PerspectiveCamera(70,640/480,.1,800),h=r.generator.getTerrainHeight(80,80)*.25;camera.position.set(20,h+8,20);camera.lookAt(90,h,90);
 const start=performance.now();let drained=false;
 while(performance.now()-start<60000){for(let i=0;i<10;i++)r.update(camera.position);if(!r.lod.snapshot().queue&&!r.vegetation.snapshot().queue&&!r.manager.queue.length&&!r.manager.pending){drained=true;break;}await new Promise(r=>setTimeout(r,0));}if(!drained)throw Error('Queues failed to drain');
 const layers=root.children.filter(o=>o.isGroup),basic=new THREE.MeshBasicMaterial({color:0x888888}),materials=r.materials.map(m=>({type:m.type,color:m.color?.getHexString(),map:!!m.map,transparent:m.transparent,roughness:m.roughness,metalness:m.metalness,side:m.side}));
 for(let i=0;i<60;i++){r.update(camera.position);renderer.render(scene,camera);await new Promise(requestAnimationFrame);}
 const filtered=[];root.traverse(mesh=>{if(mesh.userData.terrainLOD)filtered.push({mesh,data:skirtFilter(mesh.geometry,mesh.material)});});
 for(let trial=0;trial<3;trial++)for(const variant of trial%2?['pairedSkirts','original']:['original','pairedSkirts']){
  for(const {mesh,data} of filtered){mesh.geometry.setIndex(variant==='original'?data.original:data.filtered);mesh.geometry.groups=(variant==='original'?data.originalGroups:data.groups).map(g=>({...g}));}
  console.log('NV_TEST_PROGRESS',trial,variant,filtered.reduce((n,e)=>n+e.data.removedTriangles,0));
  renderer.setSize(variant==='halfResolution'?320:640,variant==='halfResolution'?240:480);scene.overrideMaterial=variant==='basic'?basic:null;
  const frame=[],update=[],submit=[],gpu=[];let calls=0,triangles=0;
  for(let i=0;i<180;i++){
   const t=performance.now();if(variant!=='noUpdate')r.update(camera.position);const u=performance.now();
   for(const layer of layers){if(layer.name==='Vegetation distance detail')layer.visible=!['neither','terrain'].includes(variant);else layer.visible=!['neither','vegetation'].includes(variant);}
   timer.begin(true);renderer.render(scene,camera);timer.end();const d=performance.now();await new Promise(requestAnimationFrame);
   if(i>=60){frame.push(performance.now()-t);update.push(u-t);submit.push(d-u);const q=timer.snapshot();if(q.elapsedMs!==null)gpu.push(q.elapsedMs);calls=renderer.info.render.calls;triangles=renderer.info.render.triangles;}
  }
  results.push({trial,variant,frame:summary(frame),update:summary(update),submit:summary(submit),gpu:gpu.length?summary(gpu):null,calls,triangles});
  await fetch('/test/results',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({results,materials,drained,complete:false,timer:timer.snapshot(),layers:layers.map(l=>l.name)})});
 }
 r.dispose();basic.dispose();await fetch('/test/results',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({results,materials,drained,complete:true,timer:timer.snapshot(),layers:layers.map(l=>l.name)})});document.querySelector('#result').textContent='PASS: E1 skirt isolation';
}catch(e){document.querySelector('#result').textContent='FAIL: '+e.stack;}finally{timer.dispose();renderer.dispose();}
