// Nodevision/scripts/vegetation-phase-c-benchmarks.mjs
// This real-renderer comparison measures bounded vegetation state availability along deterministic routes. Continuous frustum/range eligibility separates absent-to-detail changes from entry; occlusion and exact image-space popping remain unmeasured.
import * as THREE from '/lib/three/three.module.js';
import {createProceduralVoxelWorld as current} from '/MetaWorld/ProceduralVoxelWorld/ProceduralVoxelWorldRuntime.mjs';
import {createProceduralVoxelWorld as baseline} from '/baseline/MetaWorld/ProceduralVoxelWorld/ProceduralVoxelWorldRuntime.mjs';
import {AEGEAN_SPECIES} from '/MetaWorld/Aegean/PlantPlacement.mjs';
import {terrainBenchmarkCases} from './terrain-benchmark-fixtures.mjs';
const results=[],renderer=new THREE.WebGLRenderer({antialias:false});renderer.setSize(640,480);document.body.append(renderer.domElement);
const percentile=(values,p)=>[...values].sort((a,b)=>a-b)[Math.floor((values.length-1)*p)];
try{
 const fixtures=await terrainBenchmarkCases(),base={...fixtures[0].definition,size:[256,128,256],generator:{id:'nodevision-terrain-v1',version:1,seed:123456},generation:{vegetation:true,water:false,caves:false}};
 const cases=[{name:'small-procedural',definition:base},{name:'dense-forest',definition:{...base,environment:{id:'aegean',version:1,vegetationDensity:1,season:'summer',seasonMode:'manual',landform:'peninsula',geology:'metamorphic',seaLevel:8,uplandOak:true,mountains:false}}},
  {...fixtures[1],definition:{...fixtures[1].definition,generation:{vegetation:true,water:false,caves:false}}},fixtures[2],{name:'4km-forest',definition:{...base,size:[4096,128,4096]}},{name:'construction-cut',definition:base,edited:true},{name:'authored-landmark',definition:base,authored:true}];
 for(const fixture of cases)for(const mode of ['voxel','polygonal'])for(const version of ['B','C']){
  console.log('NV_TEST_PROGRESS',fixture.name,mode,version);
  const def=structuredClone(fixture.definition);def.representation=mode;def.streaming={...def.streaming,vegetationDistance:128};
  const root=(version==='B'?baseline:current)(THREE,def,[]);const r=root.userData.terrainRuntime;if(!await r.ready)throw Error('Runtime assets');r.setRenderDistance(8);
  const scene=new THREE.Scene();scene.add(root,new THREE.AmbientLight(0xffffff,2));const camera=new THREE.PerspectiveCamera(70,640/480,.1,600);
  const offset=root.position,center=[Math.min(80,def.size[0]/5),Math.min(32,def.size[2]/5)];
  if(fixture.edited){const min=[offset.x+center[0]-8,offset.y,offset.z+center[1]-8],max=[min[0]+16,offset.y+def.size[1],min[2]+16];r.setConstructions([{bounds:{min,max},extent:{min,max},cuts:[{min,max}],sample:()=>null}]);}
  let landmark;if(fixture.authored){landmark=new THREE.Mesh(new THREE.ConeGeometry(2,8,8),new THREE.MeshBasicMaterial({color:'magenta'}));landmark.position.set(offset.x+center[0],offset.y+30,offset.z+center[1]);landmark.userData={id:'mnemonic-tree',association:'lesson-alpha'};scene.add(landmark);}
  // The same authoritative candidates are enumerated in both versions, before timing. This warms placement equally.
  const features=r.generator.features.query([Math.max(0,center[0]-100)*4,0,Math.max(0,center[1]-100)*4],[Math.min(def.size[0],center[0]+160)*4,r.generator.dimensions[1],Math.min(def.size[2],center[1]+160)*4]);
  const expected=[...new Map(features.map(f=>[f.id,f])).values()].filter(f=>!AEGEAN_SPECIES[f.species]||AEGEAN_SPECIES[f.species].category==='tree').map(f=>{const anchors=[];for(let z=f.min[2];z<f.max[2];z+=4)for(let y=f.min[1];y<f.max[1];y+=4)for(let x=f.min[0];x<f.max[0];x+=4){const material=r.generator.getFeatureVoxel(x,y,z,[f]);if(material)anchors.push({cell:[x,y,z],material});}return {...f,anchors:anchors.filter((_,i)=>i%Math.max(1,Math.ceil(anchors.length/64))===0)};}).filter(f=>f.anchors.length),previous=new Map(),frames=[],appearanceDistances=[],delays=[],coarseAt=new Map();
  let eligible=0,represented=0,absentToDetail=0,entries=0,transitions=0,first=null,maxCalls=0,maxTriangles=0,maxGeometry=0,maxQueue=0;
  const start=performance.now();
  for(let frame=0;frame<180;frame++){
   const begin=performance.now(),travel=frame<30?0:frame<90?(frame-30)*.18:frame<120?10.8+(frame-90)*.6:frame<150?28.8-(frame-120)*.6:60;
   const x=Math.min(def.size[0]-2,center[0]+travel),z=Math.min(def.size[2]-2,center[1]+(frame>=150?32:0));
   const ground=r.generator.getTerrainHeight(Math.floor(x*4),Math.floor(z*4))*.25+(def.heightLimits?.min||0);
   camera.position.set(offset.x+x,offset.y+ground+5,offset.z+z);camera.lookAt(offset.x+x+30,offset.y+ground+2,offset.z+z+30);camera.updateMatrixWorld();
   r.update(camera.position);renderer.render(scene,camera);
   const frustum=new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
   const proxy=new Map(r.vegetation?.states().map(s=>[s.id,s])||[]);
   for(const f of expected){
    const p=new THREE.Vector3(offset.x+f.origin[0]*.25,offset.y+(def.heightLimits?.min||0)+(f.min[1]+f.max[1])*.125,offset.z+f.origin[2]*.25),distance=p.distanceTo(camera.position),inside=distance<120&&frustum.intersectsSphere(new THREE.Sphere(p,(f.max[1]-f.min[1])*.125));
    // Count actual sampled feature occupancy in installed detailed meshes, including partially loaded crowns.
    const detailed=f.anchors.some(a=>{const [vx,vy,vz]=a.cell,c=[vx,vy,vz].map(v=>Math.floor(v/32)),entry=r.manager.loaded.get(c.join(','));return entry?.mesh?.visible&&entry.data?.[(vx-c[0]*32)+32*((vy-c[1]*32)+32*(vz-c[2]*32))]===a.material;});
    const state=detailed?0:proxy.get(f.id)?.level>0?proxy.get(f.id).level:null,old=previous.get(f.id);
    if(inside){eligible++;if(state!==null){represented++;first??=performance.now()-start;}
     if(old?.inside&&old.state===null&&state===0)absentToDetail++;
     if(state!==null&&old?.state===null)appearanceDistances.push(distance);
     if(!old?.inside)entries++;
     if(state!==null&&old?.state!==null&&old?.state!==undefined&&state!==old.state)transitions++;
     if(state>0&&!coarseAt.has(f.id))coarseAt.set(f.id,performance.now());if(state===0&&coarseAt.has(f.id)){delays.push(performance.now()-coarseAt.get(f.id));coarseAt.delete(f.id);}
    }previous.set(f.id,{inside,state});
   }
   const s=r.vegetation?.snapshot();maxQueue=Math.max(maxQueue,s?.queue||0);maxCalls=Math.max(maxCalls,renderer.info.render.calls);maxTriangles=Math.max(maxTriangles,renderer.info.render.triangles);maxGeometry=Math.max(maxGeometry,renderer.info.memory.geometries);
   frames.push(performance.now()-begin);await new Promise(requestAnimationFrame);
  }
  const stats=r.vegetation?.snapshot()||null;
  if(landmark&&(landmark.userData.id!=='mnemonic-tree'||landmark.parent!==scene))throw Error('Authored identity changed');
  results.push({fixture:fixture.name,mode,version,expectedIdentities:expected.length,eligibleSamples:eligible,representedSamples:represented,representedFraction:eligible?represented/eligible:null,absentToDetailed:absentToDetail,frustumOrRangeEntries:entries,lodTransitions:transitions,firstRepresentationMs:first,meanAppearanceDistance:appearanceDistances.length?appearanceDistances.reduce((a,b)=>a+b)/appearanceDistances.length:null,coarseToDetailMs:delays.length?percentile(delays,.5):null,meanFrameMs:frames.reduce((a,b)=>a+b)/frames.length,p95FrameMs:percentile(frames,.95),maxDrawCalls:maxCalls,maxTriangles,maxGeometry,maxQueue,vegetation:stats});
  r.dispose();if(landmark){landmark.geometry.dispose();landmark.material.dispose();}renderer.render(new THREE.Scene(),camera);
 }
 await fetch('/test/results',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({results,notes:'Single sequential SwiftShader run. CPU frame measurement includes state instrumentation. Feature inventory warmed equally. Object-state coverage is not pixel coverage; occlusion is not classified. Detailed presence uses up to 64 authoritative occupancy anchors per identity; partial crowns count. Proxies are object-state presence, not pixel coverage. Null denotes no qualifying observations.'})});
 document.getElementById('result').textContent='PASS: Phase B/C real-renderer vegetation comparison';
}catch(error){document.getElementById('result').textContent='FAIL: '+error.stack;}finally{renderer.dispose();}
