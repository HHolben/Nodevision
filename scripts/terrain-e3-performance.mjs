// Nodevision/scripts/terrain-e3-performance.mjs
// Alternate original and corrected normals in actual shared terrain runtimes. Both/disabled distant layers, stationary/moving phases and geometry fingerprints separate shading preparation cost from unchanged rendering workload.
import * as THREE from '/lib/three/three.module.js';
import {createProceduralVoxelWorld as baseline} from '/baseline/MetaWorld/ProceduralVoxelWorld/ProceduralVoxelWorldRuntime.mjs';
import {createProceduralVoxelWorld as modified} from '/MetaWorld/ProceduralVoxelWorld/ProceduralVoxelWorldRuntime.mjs';
import {createGpuTimer} from '/MetaWorld/TerrainDiagnostics/GpuTimer.mjs';
import * as baselineThree from '/baseline/lib/three/three.module.js';
import {geometryFingerprint} from './terrain-e3-runtime-metrics.mjs';
const renderer=new THREE.WebGLRenderer({antialias:false});renderer.setPixelRatio(1);renderer.setSize(640,480);document.body.append(renderer.domElement);
const timer=createGpuTimer(renderer),results=await(await fetch('/test/resume')).json(),geo=await(await fetch('/test/geographic')).json();
const summary=a=>{const sorted=[...a].sort((a,b)=>a-b);return a.length?{samples:a.length,mean:a.reduce((s,v)=>s+v,0)/a.length,p95:sorted[Math.floor(a.length*.95)],p99:sorted[Math.floor(a.length*.99)],max:sorted.at(-1)}:null;};
const save=complete=>fetch('/test/results',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({complete,results,environment:'Chromium SwiftShader, 640x480, pixel ratio 1; software elapsed queries are not hardware GPU timings.',method:'Fresh runtime per case; 60 warmup frames; 180 stationary and 90 frames each walking, running and backtracking. Frame-stepped movement: 0.06 and 0.18 m/frame, not wall-clock player speed. Three alternating pairs for large/infinite both-layer cases; one pair for controls and small/geographic cases. Async GPU samples counted only when newly completed. Geometry/normal fingerprints outside timings.',gcMs:null,uploadBytes:null})});
try{
 if(baselineThree.Material!==THREE.Material)throw Error('Baseline must share the Three.js module identity');
 for(const scenario of ['small','large','infinite','geographic'])for(const flags of [[false,false],[true,true]])for(let trial=0;trial<(flags[0]&&['large','infinite'].includes(scenario)?3:1);trial++)for(const variant of trial%2?['modified','baseline']:['baseline','modified']){
  if(results.some(r=>r.scenario===scenario&&r.trial===trial&&r.variant===variant&&r.terrain===flags[0]&&r.vegetation===flags[1]))continue;
  console.log('NV_TEST_PROGRESS',scenario,flags.join(','),trial,variant);timer.begin(false);
  let def={id:'profile',type:'procedural-voxel-world',size:[1000,64,2000],position:[0,0,0],representation:'polygonal',polygonalGroundStyle:'smooth-natural',voxelSize:.25,generator:{id:'nodevision-terrain-v1',version:1,seed:42},chunks:{voxelsPerAxis:32,loadRadius:1},generation:{vegetation:true,caves:false,water:false},streaming:{enabled:flags[0],vegetationEnabled:flags[1],visibilityDistance:512,vegetationDistance:128}};
  if(scenario==='infinite')def.worldExtent={mode:'infinite'};if(scenario==='small')def.size=[50,64,50];if(scenario==='geographic')def={...geo,position:[0,0,0],representation:'polygonal',polygonalGroundStyle:'smooth-natural',streaming:def.streaming};
  const root=({baseline,modified}[variant])(THREE,def,[]),r=root.userData.terrainRuntime;await r.ready;r.setRenderDistance(8);
  const scene=new THREE.Scene();scene.background=new THREE.Color(0xc7d8e2);scene.add(root,new THREE.HemisphereLight(0xffffff,0x495745,.8));const sun=new THREE.DirectionalLight(0xffffff,2.2);sun.position.set(-20,35,-10);scene.add(sun);const camera=new THREE.PerspectiveCamera(70,4/3,.1,800);let anchor=20;if(scenario==='geographic'){let found=false;for(let i=1;i<10&&!found;i++){const p=Math.min(def.size[0],def.size[2])*i/10;if(r.sampleTerrainSource(p,p).covered){anchor=p;found=true;}}}const ground=r.generator.getTerrainHeight(Math.floor(anchor*4),Math.floor(anchor*4))*.25;
  camera.position.set(anchor,ground+3,anchor);camera.lookAt(anchor+30,ground,anchor+30);
  const started=performance.now();let drained=false;
  while(performance.now()-started<60000){for(let i=0;i<10;i++)r.update(camera.position);if(!r.lod.snapshot().queue&&!r.vegetation.snapshot().queue&&!r.manager.queue.length&&!r.manager.pending){drained=true;break;}await new Promise(resolve=>setTimeout(resolve,0));}
  if(!drained)throw Error('Preparation failed to drain');const preparationMs=performance.now()-started;
  for(let i=0;i<60;i++){r.update(camera.position);r.vegetation.prepareView(camera);renderer.render(scene,camera);await new Promise(requestAnimationFrame);}
  const fingerprint=await geometryFingerprint(root);
  let coarseVertices=0,coarseIndices=0;root.getObjectByName('Terrain distance detail')?.traverse(o=>{if(o.isMesh){coarseVertices+=o.geometry.attributes.position.count;coarseIndices+=o.geometry.index.count;}});
  const phases={};let offset=0;
  for(const phase of ['stationary','walking','running','backtracking']){
   timer.begin(false);const frames=phase==='stationary'?180:90,frame=[],update=[],prepare=[],submit=[],gpu=[];let calls=0,triangles=0,lastSamples=timer.snapshot().samples,previous=performance.now();const before={...r.stats},lodBefore=r.lod.snapshot();
   for(let i=0;i<frames;i++){
    if(phase==='walking')offset+=.06;if(phase==='running')offset+=.18;if(phase==='backtracking')offset=Math.max(0,offset-.24);
    camera.position.x=anchor+offset;camera.position.z=anchor+offset;
    const start=performance.now();r.update(camera.position);const u=performance.now();r.vegetation.prepareView(camera);const p=performance.now();timer.begin(true);renderer.render(scene,camera);timer.end();const d=performance.now();
    update.push(u-start);prepare.push(p-u);submit.push(d-p);calls+=renderer.info.render.calls;triangles+=renderer.info.render.triangles;
    await new Promise(requestAnimationFrame);const now=performance.now();if(now-previous>5000)throw Error('Host interruption: rerun entire affected pair');frame.push(now-previous);previous=now;const q=timer.snapshot();if(q.samples>lastSamples&&q.elapsedMs!==null)gpu.push(q.elapsedMs);lastSamples=q.samples;
   }
   const lodAfter=r.lod.snapshot();phases[phase]={frameMs:summary(frame),updateMs:summary(update),prepareMs:summary(prepare),submitMs:summary(submit),driverMs:summary(gpu),drawCallsMean:calls/frames,trianglesMean:triangles/frames,generationMs:r.stats.generationMs-before.generationMs,meshingMs:r.stats.meshingMs-before.meshingMs,generated:r.stats.generated-before.generated,cache:r.meshCache.snapshot(),lodCpuMs:lodAfter.coarseCpuMs-lodBefore.coarseCpuMs,maskCpuMs:lodAfter.maskCpuMs-lodBefore.maskCpuMs,planningCpuMs:lodAfter.planningCpuMs-lodBefore.planningCpuMs};
  }
  const pair=results.find(other=>other.scenario===scenario&&other.terrain===flags[0]&&other.vegetation===flags[1]&&other.trial===trial&&other.variant!==variant);
  if(pair&&pair.fingerprint.geometry!==fingerprint.geometry)throw Error('Normal correction changed stationary geometry/materials');
  if(pair&&(pair.phases.stationary.drawCallsMean!==phases.stationary.drawCallsMean||pair.phases.stationary.trianglesMean!==phases.stationary.trianglesMean))throw Error('Stationary draw/triangle counts differ; invalid normal-only comparison');
  results.push({scenario,terrain:flags[0],vegetation:flags[1],trial,variant,preparationMs,drained,fingerprint,coarseVertices,coarseIndices,phases,lod:r.lod.snapshot(),vegetationStats:r.vegetation.snapshot(),timer:timer.snapshot()});await save(false);r.dispose();renderer.render(new THREE.Scene(),camera);
 }
 await save(true);document.querySelector('#result').textContent='PASS: E3 before/after production terrain performance';
}catch(error){document.querySelector('#result').textContent='FAIL: '+error.stack;}finally{timer.dispose();renderer.dispose();}
