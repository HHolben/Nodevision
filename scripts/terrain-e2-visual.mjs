// Nodevision/scripts/terrain-e2-visual.mjs
// Actual WebGL delayed multi-chunk handoff of one authoritative tree in both modes. Framebuffer silhouette metrics distinguish partial installation, an instant swap and a controlled stationary transition.
import * as THREE from '/lib/three/three.module.js';
import {createVoxelGenerator} from '/MetaWorld/ProceduralVoxelWorld/VoxelTerrainGenerator.mjs';
import {vegetationRegion,vegetationCells} from '/MetaWorld/VegetationLOD/Sampling.mjs';
import {vegetationCells as oldCells} from '/baseline/MetaWorld/VegetationLOD/Sampling.mjs';
import {vegetationInstances as oldInstances} from '/baseline/MetaWorld/VegetationLOD/Instances.mjs';
import {vegetationInstances} from '/MetaWorld/VegetationLOD/Instances.mjs';
import {polygonalVegetationSteps,polygonalVegetation} from '/MetaWorld/VegetationLOD/Polygonal.mjs';
import {vegetationOwnership} from '/MetaWorld/VegetationLOD/Ownership.mjs';
import {vegetationDetail} from '/MetaWorld/VegetationLOD/Detail.mjs';
import {surfaceNetSteps} from '/MetaWorld/TerrainRepresentation/SurfaceNets.mjs';
import {meshVoxelChunkSteps} from '/MetaWorld/ProceduralVoxelWorld/VoxelChunkMesher.mjs';
import {finishTerrainChunk} from '/MetaWorld/ProceduralVoxelWorld/FinishTerrainChunk.mjs';
import {voxelIndex} from '/MetaWorld/ProceduralVoxelWorld/VoxelCoordinates.mjs';
import {drainSteps} from '/MetaWorld/ProceduralVoxelWorld/ProgressiveTerrain.mjs';
import {featureMaterialPriority,treeMaterialIndices} from '/MetaWorld/ProceduralVoxelWorld/VoxelMaterialIds.mjs';
const renderer=new THREE.WebGLRenderer({antialias:false,preserveDrawingBuffer:true});renderer.setSize(640,480);renderer.setPixelRatio(1);document.body.append(renderer.domElement);
const results=[],definition={id:'tree',size:[512,128,512],position:[0,0,0],voxelSize:.25,generator:{seed:42},generation:{vegetation:true,water:false,caves:false}},generator=createVoxelGenerator(definition);
let region,feature;for(let z=0;z<8&&!feature;z++)for(let x=0;x<8&&!feature;x++){const r=drainSteps(vegetationRegion(generator,x,z));feature=r.features.find(f=>f.species==='Pine'&&f.max[1]-f.min[1]>24);if(feature)region=r;}
if(!feature)throw Error('Spanning tree fixture missing');const f=feature;region={...region,features:[f],min:f.min.map((v,a)=>a===1?0:Math.floor(v/128)*128),max:f.max.map((v,a)=>a===1?generator.dimensions[1]:Math.ceil(v/128)*128)};
const source={...generator,features:{query:()=>[f]},getRenderVoxel:(x,y,z)=>generator.getFeatureVoxel(x,y,z,[f])},materials=Array.from({length:256},()=>new THREE.MeshStandardMaterial({color:0x4b8b46,roughness:.8}));for(const id of treeMaterialIndices(f.species).slice(0,2))materials[id-1].color.setHex(0x70523b);
const box=new THREE.BoxGeometry(),center=new THREE.Vector3(...f.min.map((v,a)=>(v+f.max[a])*.125)),camera=new THREE.PerspectiveCamera(45,4/3,.1,200);camera.position.copy(center).add(new THREE.Vector3(10,2,17));camera.lookAt(center);
function scene(root){const s=new THREE.Scene();s.background=new THREE.Color(0xc7d8e2);s.add(root,new THREE.HemisphereLight(0xffffff,0x495745,1.2));const light=new THREE.DirectionalLight(0xffffff,2);light.position.set(-20,35,10);s.add(light);return s;}
function pixels(){const a=new Uint8Array(640*480*4),gl=renderer.getContext();gl.readPixels(0,0,640,480,gl.RGBA,gl.UNSIGNED_BYTE,a);return a;}
const mask=a=>Uint8Array.from({length:a.length/4},(_,i)=>Math.abs(a[i*4]-199)+Math.abs(a[i*4+1]-216)+Math.abs(a[i*4+2]-226)>24?1:0);
function compare(a,b){let union=0,intersection=0,changed=0,color=0;const ma=mask(a),mb=mask(b);for(let i=0;i<ma.length;i++){union+=ma[i]||mb[i];intersection+=ma[i]&&mb[i];changed+=ma[i]!==mb[i];for(let c=0;c<3;c++)color+=Math.abs(a[i*4+c]-b[i*4+c]);}return {silhouetteIoU:union?intersection/union:1,changedSilhouetteFraction:union?changed/union:0,meanChannelChange:color/(ma.length*3)};}
async function capture(name,s){renderer.render(s,camera);const p=pixels();await fetch('/test/image',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:name+'.png',data:renderer.domElement.toDataURL('image/png')})});return p;}
try{
 for(const mode of ['voxel','polygonal'])for(const variant of ['baseline','modified']){
  console.log('NV_TEST_PROGRESS','E2 visual',mode,variant);let time=0;const root=new THREE.Group(),s=scene(root),manager={loaded:new Map(),invalidated:new Set(),columnLevels:new Map()},ownership=vegetationOwnership(THREE,manager,{now:()=>time}),detail=vegetationDetail(THREE,source,ownership);ownership.tick(f.origin[0]*.25,f.origin[2]*.25,true);
  let data=drainSteps((variant==='baseline'?oldCells:vegetationCells)(generator,region,1));if(mode==='polygonal'&&variant==='modified')data=drainSteps(polygonalVegetationSteps(data));
  const config={ownership,fade:{value:1},direction:{value:0}},proxy=variant==='baseline'?oldInstances(THREE,data,box,materials,0):mode==='polygonal'?polygonalVegetation(THREE,data,materials,0,config):vegetationInstances(THREE,data,box,materials,0,config);root.add(proxy.group);const entries=[];
  for(let z=Math.floor(f.min[2]/32);z<=Math.floor((f.max[2]-1)/32);z++)for(let y=Math.floor(f.min[1]/32);y<=Math.floor((f.max[1]-1)/32);y++)for(let x=Math.floor(f.min[0]/32);x<=Math.floor((f.max[0]-1)/32);x++){
   const cell=[x,y,z],buffer=new Uint16Array(32768);for(let zz=0;zz<32;zz++)for(let yy=0;yy<32;yy++)for(let xx=0;xx<32;xx++)buffer[voxelIndex(xx,yy,zz)]=source.getRenderVoxel(x*32+xx,y*32+yy,z*32+zz);
   const result=drainSteps((mode==='polygonal'?surfaceNetSteps:meshVoxelChunkSteps)(buffer,cell,source.getRenderVoxel)),entry=finishTerrainChunk(THREE,root,{materials},0,definition,cell,result,0,0,true);entry.cell=cell;if(variant==='modified')detail.attach(entry,cell);entries.push(entry);
  }
  const distances=[];proxy.group.visible=false;
  for(const [label,distance,level] of [['distant',60,2],['intermediate',32,1],['near',20,1]]){
   let sample=drainSteps((variant==='baseline'?oldCells:vegetationCells)(generator,region,level));if(mode==='polygonal'&&variant==='modified')sample=drainSteps(polygonalVegetationSteps(sample));
   const testProxy=variant==='baseline'?oldInstances(THREE,sample,box,materials,0):mode==='polygonal'?polygonalVegetation(THREE,sample,materials,0,config):vegetationInstances(THREE,sample,box,materials,0,config);root.add(testProxy.group);camera.position.copy(center).add(new THREE.Vector3(10,2,17).normalize().multiplyScalar(distance));camera.lookAt(center);
   testProxy.prepareView(camera);const image=await capture(`${mode}-${variant}-${label}`,s),structure=sample.cells.filter(c=>!(mode==='voxel'&&c.voxelHidden)).map(c=>mode==='voxel'&&c.voxelBox?{...c,...c.voxelBox}:c).filter(c=>featureMaterialPriority(c.material)>=2&&c.p[1]<f.origin[1]+4);
   const axis=structure.length?[0,2].map(a=>structure.reduce((n,c)=>n+(c.p[a]+(c.size?.[a]??sample.step)/2)*.25,0)/structure.length):null;
   distances.push({label,distance,level,cells:sample.cells.length,coverage:mask(image).reduce((a,b)=>a+b,0),trunkAxisOffsetM:axis?Math.hypot(axis[0]-f.origin[0]*.25,axis[1]-f.origin[2]*.25):null});testProxy.dispose();
  }
  proxy.group.visible=true;camera.position.copy(center).add(new THREE.Vector3(10,2,17));camera.lookAt(center);
  const partial=entries.filter(e=>e.mesh).sort((a,b)=>a.mesh.position.distanceTo(camera.position)-b.mesh.position.distanceTo(camera.position))[0];
  const proxyTriangles=proxy.triangles?.()??proxy.group.children.reduce((n,m)=>n+m.count*12,0);const frames=[];let previous=null,first=null;
  for(const t of [0,60,120,200,240,280,320,360,400,440,480,520,560,600,700]){
   time=t;const count=t<60?0:t<200?Math.ceil(entries.length/2):entries.length;for(const e of entries){if(t<60||t<200&&e.mesh&&e!==partial)continue;if(e.mesh)e.mesh.visible=true;manager.loaded.set(e.cell.join(','),e);}
   if(variant==='modified'){ownership.tick(f.origin[0]*.25,f.origin[2]*.25,true);proxy.mask((_,id)=>ownership.value(id)>=1);}else proxy.mask(key=>manager.loaded.has(key));
   detail.sync();proxy.prepareView(camera);const p=await capture(`${mode}-${variant}-${String(t).padStart(3,'0')}`,s),coverage=mask(p).reduce((a,b)=>a+b,0);if(!coverage)throw Error('Blank tree frame');frames.push({timeMs:t,coverage,detailFraction:variant==='modified'?ownership.value(f.id):count/entries.length,change:previous?compare(previous,p):null});previous=p;first??=p;
  }
  results.push({mode,variant,id:f.id,species:f.species,seed:f.seed,origin:f.origin,min:f.min,max:f.max,chunks:entries.length,drawableChunks:entries.filter(e=>e.mesh).length,distances,proxyCells:data.cells.length,proxyTriangles,frames,firstToDetailed:compare(first,previous),continuity:ownership.snapshot(),classifiedVertices:entries.reduce((n,e)=>n+(e.mesh?.geometry.attributes.nvTree?Array.from(e.mesh.geometry.attributes.nvTree.array).filter(Boolean).length:0),0)});
  proxy.dispose();for(const e of entries){e.mesh?.userData.disposeVegetation?.();e.mesh?.geometry.dispose();}detail.dispose();ownership.dispose();root.clear();
 }
 await fetch('/test/results',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({complete:true,results,environment:'Chromium WebGL, 640x480, SwiftShader; deterministic clock and stationary camera; partial chunks at 60 ms, all chunks at 200 ms. Visual time is stepped, not an FPS benchmark.'})});document.querySelector('#result').textContent='PASS: E2 rendered delayed tree transitions in both representations';
}catch(error){document.querySelector('#result').textContent='FAIL: '+error.stack;}finally{box.dispose();materials.forEach(m=>m.dispose());renderer.dispose();}
