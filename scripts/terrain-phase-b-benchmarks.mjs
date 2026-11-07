// Nodevision/scripts/terrain-phase-b-benchmarks.mjs
// Compares Phase A and Phase B with deterministic movement and frustum-filtered ground probes. Coverage measures actual triangle intersections separately from frame rate and full-detail readiness.
import * as THREE from '/lib/three/three.module.js';
import {terrainBenchmarkCases} from '/scripts/terrain-benchmark-fixtures.mjs';
import {terrainDiagnostics} from '/MetaWorld/TerrainDiagnostics/Snapshot.mjs';
import {validatePath} from '/MetaWorld/Paths/PathDefinition.mjs';
import {ribbonForPath,samplePath} from '/MetaWorld/Paths/PathGeometry.mjs';
const frame=()=>new Promise(requestAnimationFrame),mean=a=>a.reduce((s,v)=>s+v,0)/(a.length||1),p95=a=>[...a].sort((a,b)=>a-b)[Math.min(a.length-1,Math.floor(a.length*.95))];
function coverage(terrain,camera){
 const runtime=terrain.userData.terrainRuntime,point=camera.userData.player,frustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
 const meshes=[];terrain.traverse(o=>{if(o.isMesh&&o.visible&&o.parent.visible)meshes.push(o);});
 let eligible=0,covered=0,detailed=0;
 for(const dx of [-24,0,24])for(const dz of [0,8,24,48,96,192]){
  const x=point.x+dx,z=point.z+dz,s=runtime.sampleTerrainSource(x,z);if(!s.covered||!Number.isFinite(s.elevation))continue;
  const at=new THREE.Vector3(x,s.elevation,z);if(!frustum.containsPoint(at))continue;eligible++;
  const ray=new THREE.Raycaster(new THREE.Vector3(x,s.elevation+32,z),new THREE.Vector3(0,-1,0),0,64);
  if(ray.intersectObjects(meshes,false).length)covered++;
  const cx=Math.floor((x-terrain.position.x)/8),cz=Math.floor((z-terrain.position.z)/8);
  if(runtime.manager.columnReady?.(cx,cz)||!runtime.manager.columnReady&&[...runtime.manager.loaded.values()].some(e=>e.cell[0]===cx&&e.cell[2]===cz))detailed++;
 }
 return {eligible,covered,missing:eligible-covered,detailed};
}
async function measure(create,item,version,mode){
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(70,4/3,.1,2000),renderer=new THREE.WebGLRenderer();renderer.setSize(640,480);document.getElementById('editor').replaceChildren(renderer.domElement);
 const colliders=[],began=performance.now(),root=create(THREE,{...structuredClone(item.definition),representation:mode,...(version==='phase-b-reactive'?{streaming:{predictive:false}}:{})},colliders),runtime=root.userData.terrainRuntime;scene.add(root);await runtime.ready;runtime.setRenderDistance(16);
 if(item.edited){const path=validatePath({id:'road',controlPoints:[[2,3,12],[28,3,12]],width:2,terrainInteraction:'excavate',elevationMode:'authored',interpolation:'straight'});runtime.setPathConstraints([ribbonForPath(path,samplePath(THREE,path))],{minX:0,maxX:32,minZ:8,maxZ:16});const bounds={min:[10,0,10],max:[13,16,13]};runtime.setConstructions([{bounds,cuts:[bounds],sample:()=>null}],[bounds]);}
 scene.add(new THREE.HemisphereLight(0xffffff,0x888888,3));const point=root.position.clone().add(new THREE.Vector3(Math.min(32,item.definition.size[0]/4),20,Math.min(24,item.definition.size[2]/4))),initial=point.clone();
 const durations=[],probes=[],readiness=[];let entered=0,preparedOnEntry=0,lastColumn=null;let last=await frame(),firstCoarse=null,firstDetail=null;
 for(let i=0;i<240;i++){
  const now=await frame();durations.push(now-last);last=now;
  // Stationary, slow/normal walking, running, rapid motion, and bounded backtracking.
  const speed=i<40?0:i<80?.025:i<120?.075:i<160?.15:i<200?.5:(i%16<8?.5:-.5);
  if(item.turns){point.x+=speed*(i%32<16?1:-1);point.z+=Math.abs(speed)*.5;}else point.z+=speed;
  point.x=Math.max(root.position.x+1,Math.min(root.position.x+item.definition.size[0]-1,point.x));point.z=Math.max(root.position.z+1,Math.min(root.position.z+item.definition.size[2]-1,point.z));
  point.y=Math.max(root.position.y+20,(runtime.sampleTerrainSource(point.x,point.z).elevation||0)+4);
  camera.position.copy(point).add(new THREE.Vector3(0,28,-25));camera.lookAt(point.clone().add(new THREE.Vector3(0,-4,48)));camera.userData.player=point;
  const column=[Math.floor((point.x-root.position.x)/8),Math.floor((point.z-root.position.z)/8)];if(lastColumn&&column.join(',')!==lastColumn){entered++;if(runtime.manager.columnReady?.(...column))preparedOnEntry++;}lastColumn=column.join(',');
  runtime.update(point);renderer.render(scene,camera);
  if(root.getObjectByName('Terrain distance detail')?.children.some(m=>m.visible&&m.geometry.index.count))firstCoarse??=performance.now()-began;
  if([...runtime.manager.loaded.values()].some(e=>e.mesh?.visible))firstDetail??=performance.now()-began;
  if(i%12===0){probes.push({frame:i,...coverage(root,camera)});readiness.push(Number.isFinite(colliders[0].sampleGroundY(point.x,point.z)));}
 }
 const context={THREE,camera,renderer,objects:[root]},diagnostics=terrainDiagnostics(context),eligible=probes.reduce((s,p)=>s+p.eligible,0),covered=probes.reduce((s,p)=>s+p.covered,0);
 const result={version,case:item.name,mode,enteredColumns:entered,preparedOnEntry:runtime.manager.columnReady?preparedOnEntry:null,firstCoarseMs:firstCoarse,firstDetailMs:firstDetail,meanFrameMs:mean(durations),p95FrameMs:p95(durations),coverage:eligible?covered/eligible:null,eligibleProbes:eligible,missingProbes:eligible-covered,collisionReadyFraction:mean(readiness.map(Number)),probes,diagnostics,travelMeters:point.distanceTo(new THREE.Vector3(initial.x,point.y,initial.z))};
 runtime.dispose();renderer.dispose();return result;
}
try{
 const cases=await terrainBenchmarkCases();cases.push({...cases[3],name:'rapid-direction-changes',turns:true});const rows=[];
 for(const version of ['phase-a','phase-b','phase-b-reactive']){const {createProceduralVoxelWorld}=await import(`${version==='phase-a'?'/baseline':''}/MetaWorld/ProceduralVoxelWorld/ProceduralVoxelWorldRuntime.mjs`);
  for(const item of (version==='phase-b-reactive'?cases.filter(c=>c.name==='4km-procedural'||c.turns):cases))for(const mode of ['voxel','polygonal']){console.log('NV_TEST_PROGRESS',version,item.name,mode);rows.push(await measure(createProceduralVoxelWorld,item,version,mode));}
 }
 await fetch('/test/results',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({environment:{userAgent:navigator.userAgent,viewport:[640,480],renderer:'SwiftShader software renderer'},metric:'Downward rays at a fixed forward ground grid, excluding points outside source coverage and camera frustum. Includes skirts; not a viewport pixel percentage. Detail readiness uses complete columns in Phase B and any resident column in Phase A.',rows})});
 document.getElementById('result').textContent='PASS: Phase B movement coverage benchmark '+JSON.stringify(rows.map(r=>({version:r.version,case:r.case,mode:r.mode,coverage:r.coverage,missing:r.missingProbes})),null,2);
}catch(error){document.getElementById('result').textContent='FAIL: '+error.stack;}
