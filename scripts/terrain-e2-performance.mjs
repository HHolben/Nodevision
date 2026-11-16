// Nodevision/scripts/terrain-e2-performance.mjs
// Alternating pre-E2/current production terrain runtimes, both representations and repeatable movement. Keep software rendering, CPU preparation, delayed readiness and geometry identity as distinct measurements.
import * as THREE from '/lib/three/three.module.js';
import {createProceduralVoxelWorld as baseline} from '/baseline/MetaWorld/ProceduralVoxelWorld/ProceduralVoxelWorldRuntime.mjs';
import {createProceduralVoxelWorld as modified} from '/MetaWorld/ProceduralVoxelWorld/ProceduralVoxelWorldRuntime.mjs';
import {createGpuTimer} from '/MetaWorld/TerrainDiagnostics/GpuTimer.mjs';
import {geometryFingerprint} from './terrain-e3-runtime-metrics.mjs';
import {vegetationRegion} from '/MetaWorld/VegetationLOD/Sampling.mjs';
import {drainSteps} from '/MetaWorld/ProceduralVoxelWorld/ProgressiveTerrain.mjs';
import {validatePath} from '/MetaWorld/Paths/PathDefinition.mjs';
import {samplePath,ribbonForPath} from '/MetaWorld/Paths/PathGeometry.mjs';
const renderer=new THREE.WebGLRenderer({antialias:false});renderer.setSize(640,480);renderer.setPixelRatio(1);document.body.append(renderer.domElement);const timer=createGpuTimer(renderer),results=await(await fetch('/test/resume')).json(),geo=await(await fetch('/test/geographic')).json();
const summary=a=>{const s=[...a].sort((a,b)=>a-b);return a.length?{samples:a.length,mean:a.reduce((x,y)=>x+y,0)/a.length,p95:s[Math.floor(s.length*.95)],p99:s[Math.floor(s.length*.99)],max:s.at(-1)}:null;};
const save=complete=>fetch('/test/results',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({complete,results,environment:'Chromium SwiftShader, 640x480 pixel ratio 1; elapsed driver queries are not hardware GPU execution.',method:'Fresh runtime per case; two reversed-order trials for large/infinite with distant layers, one pair for other cases and disabled control. Settle queues then 60 warmup frames. Stationary180, movement phases60 each, stopped-late180. Fixed 0.06/0.18/0.6 m per frame. Rapid turn/teleport and stopped-late are deliberately separate from stationary LOD comparison. Stop phase pauses new detailed work for 30 frames while proxies prepare, then restores the existing work budget. GC/upload bytes unmeasured.'})});
try{
 for(const scenario of ['small','large','infinite','dense','geographic','authored'])for(const mode of ['voxel','polygonal'])for(const enabled of scenario==='large'?[false,true]:[true])for(let trial=0;trial<(enabled&&['large','infinite'].includes(scenario)?2:1);trial++)for(const variant of trial%2?['modified','baseline']:['baseline','modified']){
  if(new URLSearchParams(location.search).get('focus')&&(!enabled||`${scenario}-${mode}`!==new URLSearchParams(location.search).get('focus')))continue;
  if(results.some(r=>r.scenario===scenario&&r.mode===mode&&r.enabled===enabled&&r.trial===trial&&r.variant===variant))continue;
  console.log('NV_TEST_PROGRESS','E2 performance',scenario,mode,enabled,trial,variant);timer.begin(false);
  let def={id:'e2',type:'procedural-voxel-world',position:[0,0,0],size:[1000,128,2000],voxelSize:.25,representation:mode,generator:{id:'nodevision-terrain-v1',version:1,seed:42},chunks:{voxelsPerAxis:32,loadRadius:1},generation:{vegetation:true,caves:false,water:false},streaming:{enabled,vegetationEnabled:enabled,visibilityDistance:256,vegetationDistance:128}};
  if(scenario==='small')def.size=[50,128,50];if(scenario==='infinite')def.worldExtent={mode:'infinite'};if(scenario==='geographic')def={...geo,position:[0,0,0],representation:mode,streaming:def.streaming};
  const root=({baseline,modified}[variant])(THREE,def,[]),r=root.userData.terrainRuntime;await r.ready;r.setRenderDistance(8);let anchor=[20,20];
  if(scenario==='dense'){let count=-1;for(let z=0;z<6;z++)for(let x=0;x<6;x++){const region=drainSteps(vegetationRegion(r.generator,x,z));if(region.features.length>count){count=region.features.length;anchor=[x*32+16,z*32+16];}}}
  if(scenario==='infinite')anchor=[-20,-20];
  if(scenario==='geographic'){let found=false;for(let i=1;i<10&&!found;i++){const a=Math.min(def.size[0],def.size[2])*i/10;if(r.sampleTerrainSource(a,a).covered){anchor=[a,a];found=true;}}}
  const height=(x,z)=>r.generator.getTerrainHeight(Math.floor(x*4),Math.floor(z*4))*.25;
  if(scenario==='authored'){
   const [x,z]=anchor,y=height(x,z),path=validatePath({id:'bench-road',terrainInteraction:'grade',proceduralExclusion:true,interpolation:'straight',elevationMode:'authored',controlPoints:[[x-8,y,z],[x+8,y,z]],width:4});r.setPathConstraints([ribbonForPath(path,samplePath(THREE,path))]);
   const min=[x+4,y-2,z+4],max=[x+8,y+8,z+8];r.setConstructions([{bounds:{min,max},extent:{min,max},cuts:[{min,max}],sample:()=>null}]);
  }
  const scene=new THREE.Scene();scene.background=new THREE.Color(0xc7d8e2);scene.add(root,new THREE.HemisphereLight(0xffffff,0x495745,.8));const sun=new THREE.DirectionalLight(0xffffff,2.2);sun.position.set(-20,35,-10);scene.add(sun);const camera=new THREE.PerspectiveCamera(70,4/3,.1,600);camera.position.set(anchor[0],height(...anchor)+3,anchor[1]);camera.lookAt(anchor[0]+30,camera.position.y,anchor[1]+30);
  const started=performance.now();let drained=false;
  while(performance.now()-started<90000){for(let i=0;i<5;i++)r.update(camera.position);const v=r.vegetation.snapshot();if(!r.lod.snapshot().queue&&!v.queue&&!r.manager.queue.length&&!r.manager.pending&&!v.transitionRegions){drained=true;break;}await new Promise(resolve=>setTimeout(resolve,0));}
  if(!drained)throw Error('Preparation did not drain: '+JSON.stringify(r.vegetation.snapshot()));const preparationMs=performance.now()-started;
  for(let i=0;i<60;i++){r.update(camera.position);r.vegetation.prepareView(camera);renderer.render(scene,camera);await new Promise(requestAnimationFrame);}
  const sourceBounds=[[anchor[0]*4-128,0,anchor[1]*4-128],[anchor[0]*4+128,r.generator.dimensions[1],anchor[1]*4+128]],identity=()=>JSON.stringify(r.generator.features.query(...sourceBounds).map(f=>[f.id,f.species,f.seed,f.origin,f.variant,f.parameters]).sort((a,b)=>a[0].localeCompare(b[0]))),sourceIdentity=identity();
  const fingerprint=await geometryFingerprint(root),initial=r.vegetation.snapshot(),phases={};let offset=0;
  for(const phase of ['stationary','walking','running','fast','backtracking','turning','teleport','stopped-late']){
   let target=null,paused=null;
   if(phase==='teleport'){camera.position.x=anchor[0]+(scenario==='small'?18:scenario==='infinite'?10000:100);camera.position.z=anchor[1]+(scenario==='small'?10:scenario==='infinite'?10000:100);camera.position.y=height(camera.position.x,camera.position.z)+3;}
   if(phase==='stopped-late'&&scenario!=='small'){
    const x=camera.position.x+40,z=camera.position.z+40,features=r.generator.features.query([x*4-64,0,z*4-64],[x*4+64,r.generator.dimensions[1],z*4+64]);target=features.find(f=>f.origin[1]>0);if(target){camera.position.set(target.origin[0]*.25+2,target.origin[1]*.25+3,target.origin[2]*.25+2);camera.lookAt(target.origin[0]*.25,target.origin[1]*.25+4,target.origin[2]*.25);}
    if(r.manager.options){paused=r.manager.options.maxSteps;r.manager.options.maxSteps=0;}
   }
   const count=phase==='stationary'||phase==='stopped-late'?180:60,frame=[],update=[],prepare=[],submit=[],driver=[],continuity=[];let calls=0,triangles=0,lastSamples=timer.snapshot().samples,previous=performance.now();timer.begin(false);
   for(let i=0;i<count;i++){
    if(phase==='walking')offset+=.06;if(phase==='running')offset+=.18;if(phase==='fast')offset+=.6;if(phase==='backtracking')offset=Math.max(0,offset-.84);
    if(['walking','running','fast','backtracking'].includes(phase)){camera.position.x=anchor[0]+offset;camera.position.z=anchor[1]+offset;camera.position.y=height(camera.position.x,camera.position.z)+3;}
    if(phase==='turning')camera.rotation.y+=Math.PI/30;
    if(phase==='stopped-late'&&i===30&&r.manager.options)r.manager.options.maxSteps=paused;
    const start=performance.now();r.update(camera.position);const u=performance.now();r.vegetation.prepareView(camera);const p=performance.now();timer.begin(true);renderer.render(scene,camera);timer.end();const d=performance.now();update.push(u-start);prepare.push(p-u);submit.push(d-p);calls+=renderer.info.render.calls;triangles+=renderer.info.render.triangles;
    await new Promise(requestAnimationFrame);const now=performance.now();if(now-previous>5000)throw Error('Host interruption; repeat affected case');frame.push(now-previous);previous=now;const q=timer.snapshot();if(q.samples>lastSamples&&q.elapsedMs!==null)driver.push(q.elapsedMs);lastSamples=q.samples;
    if(phase==='stopped-late'&&i%10===0)continuity.push({frame:i,target:target?.id,detail:target?r.vegetation.ownership?.value(target.id)??null:null,...r.vegetation.ownership?.snapshot()});
   }
   if(phase==='stopped-late'&&r.manager.options)r.manager.options.maxSteps=paused;
   phases[phase]={frameMs:summary(frame),updateMs:summary(update),prepareMs:summary(prepare),submitMs:summary(submit),driverMs:summary(driver),drawCallsMean:calls/count,trianglesMean:triangles/count,vegetation:r.vegetation.snapshot(),meshCache:r.meshCache.snapshot(),residentGeometryBytes:r.stats.residentBytes,continuity};
  }
  const sourceIdentityRestored=identity()===sourceIdentity;if(!sourceIdentityRestored)throw Error('Source identity changed after travel');
  const pair=results.find(a=>a.scenario===scenario&&a.mode===mode&&a.enabled===enabled&&a.trial===trial&&a.variant!==variant);if(pair&&pair.fingerprint.geometry!==fingerprint.geometry)throw Error('Detailed geometry/source differs from baseline');
  results.push({scenario,mode,enabled,trial,variant,preparationMs,drained,fingerprint,sourceIdentityRestored,initial,phases});await save(false);r.dispose();renderer.render(new THREE.Scene(),camera);
 }
 await save(true);document.querySelector('#result').textContent='PASS: E2 production streaming and performance matrix';
}catch(error){document.querySelector('#result').textContent='FAIL: '+error.stack;}finally{timer.dispose();renderer.dispose();}
