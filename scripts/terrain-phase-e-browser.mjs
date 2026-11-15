// Nodevision/scripts/terrain-phase-e-browser.mjs
// Profiles identical finite landscapes with independent distant terrain and vegetation switches, separating generation, settled updates, drawing, movement and backtracking.
import * as THREE from '/lib/three/three.module.js';
import {createProceduralVoxelWorld} from '/MetaWorld/ProceduralVoxelWorld/ProceduralVoxelWorldRuntime.mjs';
const renderer=new THREE.WebGLRenderer({antialias:false});renderer.setSize(640,480);document.body.append(renderer.domElement);
const summary=a=>({mean:a.reduce((s,n)=>s+n,0)/a.length,p99:[...a].sort((a,b)=>a-b)[Math.min(a.length-1,Math.floor(a.length*.99))],p95:[...a].sort((a,b)=>a-b)[Math.floor(a.length*.95)],max:Math.max(...a)});
const results=[],geo=await (await fetch('/test/geographic')).json(),scenarios=[{name:'small',size:[50,50]},{name:'large',size:[1000,2000]},{name:'infinite',size:[1000,2000],infinite:true},{name:'forest',size:[1000,2000],infinite:true,forest:true},{name:'geographic',size:[geo.size[0],geo.size[2]],geographic:true}];
try{
 for(const scenario of scenarios)for(const mode of ['voxel','polygonal'])for(const flags of [[false,false],[true,false],[false,true],[true,true]]){
  const size=scenario.size;let anchor=scenario.forest?512:20;console.log('NV_TEST_PROGRESS',scenario.name,mode,flags.join(','));
  let def={id:'profile',type:'procedural-voxel-world',size:[size[0],64,size[1]],position:[0,0,0],representation:mode,voxelSize:.25,generator:{id:'nodevision-terrain-v1',version:1,seed:42},chunks:{voxelsPerAxis:32,loadRadius:1},generation:{vegetation:true,caves:false,water:false},streaming:{enabled:flags[0],vegetationEnabled:flags[1],visibilityDistance:512,vegetationDistance:128}};
  if(scenario.infinite)def.worldExtent={mode:'infinite'};if(scenario.forest)def.startingBiome='snowy-pine-forest';if(scenario.geographic)def={...geo,position:[0,0,0],representation:mode,streaming:def.streaming};
  const root=createProceduralVoxelWorld(THREE,def,[]),r=root.userData.terrainRuntime;await r.ready;r.setRenderDistance(8);
  const scene=new THREE.Scene();scene.add(root,new THREE.AmbientLight(0xffffff,2));const camera=new THREE.PerspectiveCamera(70,640/480,.1,800);
  if(scenario.geographic){let found=false;for(let z=1;z<10&&!found;z++)for(let x=1;x<10&&!found;x++){const p=[size[0]*x/10,size[1]*z/10];if(r.sampleTerrainSource(...p).covered){anchor=Math.min(...p);found=true;}}}
  const ground=r.generator.getTerrainHeight(anchor*4,anchor*4)*.25;camera.position.set(anchor,ground+8,anchor);camera.lookAt(anchor+70,ground,anchor+70);
  let columnCalls=0;const column=r.manager.columnReady.bind(r.manager);r.manager.columnReady=(...args)=>{columnCalls++;return column(...args);};
  const coarse=r.lod.update,vegetation=r.vegetation.update;let lodMs=0,vegetationMs=0;
  r.lod.update=(...a)=>{const t=performance.now();coarse(...a);lodMs+=performance.now()-t;};r.vegetation.update=(...a)=>{const t=performance.now();vegetation(...a);vegetationMs+=performance.now()-t;};
  const started=performance.now();let steps=0,first=null,drained=false;
  // Yield between bounded batches without coupling generation time to the display refresh rate.
  while(steps<3000&&performance.now()-started<20000){
   for(let i=0;i<10;i++){r.update(camera.position);steps++;if(r.lod.snapshot().tiles)first??=performance.now()-started;}
   const s=r.lod.snapshot(),v=r.vegetation.snapshot();if(!s.queue&&!v.queue&&!r.manager.queue.length&&!r.manager.pending){drained=true;break;}
   await new Promise(r=>setTimeout(r,0));
  }
  const startupMs=performance.now()-started,phases={};
  for(const phase of ['settled','walking','running','backtracking','repeat','turning','teleport','negative','far']){
   const update=[],draw=[],interval=[],columnsBefore=columnCalls,lodBefore=lodMs,vegBefore=vegetationMs;let previous=performance.now(),calls=0,triangles=0;
   const frames=phase==='settled'?36:12,before={...r.stats};
   for(let i=0;i<frames;i++){
    const delta=phase==='walking'?i*.4:phase==='running'?i*1.2:phase==='backtracking'?(12-i)*1.2:phase==='repeat'?i*1.2:0;camera.position.x=anchor+delta;camera.position.z=anchor+delta;
    if(phase==='turning')camera.lookAt(anchor+Math.cos(i/12*Math.PI*2)*70,ground,anchor+Math.sin(i/12*Math.PI*2)*70);
    if(['teleport','negative','far'].includes(phase)&&scenario.infinite){const p=phase==='teleport'?256:phase==='negative'?-128:10000;camera.position.x=p;camera.position.z=p;}

    const t=performance.now();r.update(camera.position);update.push(performance.now()-t);
    const d=performance.now();renderer.render(scene,camera);draw.push(performance.now()-d);calls=Math.max(calls,renderer.info.render.calls);triangles=Math.max(triangles,renderer.info.render.triangles);
    await new Promise(requestAnimationFrame);const now=performance.now();interval.push(now-previous);previous=now;
   }
   phases[phase]={generationCpuMs:r.stats.generationMs-before.generationMs,meshingCpuMs:r.stats.meshingMs-before.meshingMs,generated:r.stats.generated-before.generated,evicted:r.stats.evicted-before.evicted,cache:r.meshCache?.snapshot()??null,updateMs:summary(update),drawSubmitMs:summary(draw),frameMs:summary(interval),columnChecks:columnCalls-columnsBefore,lodMs:lodMs-lodBefore,vegetationMs:vegetationMs-vegBefore,drawCalls:calls,triangles};
  }
  results.push({scenario:scenario.name,size,anchor,mode,distantTerrain:flags[0],distantVegetation:flags[1],startupMs,firstCoarseMs:first,steps,drained,phases,lod:r.lod.snapshot(),vegetation:r.vegetation.snapshot(),chunks:r.manager.loaded.size,geometry:renderer.info.memory.geometries,bytes:r.stats.residentBytes});
  await fetch('/test/results',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({results,complete:false,gpuMs:null,gcMs:null})});
  r.dispose();renderer.render(new THREE.Scene(),camera);
 }
 await fetch('/test/results',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({results,complete:true,gpuMs:null,gcMs:null,platform:'Headless Chromium SwiftShader, 640x480. GPU execution and GC pauses not measured; draw submission is not GPU execution time.'})});
 document.getElementById('result').textContent='PASS: Phase E performance matrix';
}catch(e){document.getElementById('result').textContent='FAIL: '+e.stack;}finally{renderer.dispose();}
