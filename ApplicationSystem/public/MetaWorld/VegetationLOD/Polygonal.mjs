// Nodevision/ApplicationSystem/public/MetaWorld/VegetationLOD/Polygonal.mjs
// Extract coarse feature occupancy with the same Surface Nets algorithm as nearby polygonal trees. Region/material batching removes internal box faces; no independent tree generator or per-tree scene hierarchy is introduced.
import {surfaceNetSteps} from '../TerrainRepresentation/SurfaceNets.mjs';
import {voxelIndex} from '../ProceduralVoxelWorld/VoxelCoordinates.mjs';
import {colorBatches} from '../Rendering/ColorBatches.mjs';
import {featureCulling} from './FeatureCulling.mjs';
import {vegetationDither,vegetationTransitionActive} from './Dither.mjs';
export function* polygonalVegetationSteps(data){
 const cells=new Map(data.cells.map(c=>[c.p.map(n=>Math.floor(n/data.step)).join(','),c])),chunks=new Set();
 for(const c of data.cells)chunks.add(c.p.map(n=>Math.floor(n/data.step/32)).join(','));
 const results=[],get=(x,y,z)=>cells.get(`${x},${y},${z}`)?.material||0;
 for(const key of chunks){
  const cell=key.split(',').map(Number),buffer=new Uint16Array(32768);
  for(let z=0;z<32;z++)for(let y=0;y<32;y++){for(let x=0;x<32;x++)buffer[voxelIndex(x,y,z)]=get(cell[0]*32+x,cell[1]*32+y,cell[2]*32+z);yield;}
  const result=yield*surfaceNetSteps(buffer,cell,get),ids=[];
  for(let i=0;i<result.positions.length;i+=3){
   const p=[0,1,2].map(a=>Math.floor(cell[a]*32+result.positions[i+a]*4-.5));let owner=null;
   for(let z=0;z<2&&!owner;z++)for(let y=0;y<2&&!owner;y++)for(let x=0;x<2&&!owner;x++)owner=cells.get(`${p[0]+x},${p[1]+y},${p[2]+z}`);
   ids.push(owner?.id||'');
  }
  results.push({cell,result,ids});yield;
 }
 return {...data,polygonal:results};
}
export function polygonalVegetation(THREE,data,materials,floor,transition){
 const palette=colorBatches(materials,new Set(data.cells.map(c=>c.material-1)),true),refs=new Map(),owned=[];
 for(const f of data.region.features)if(data.identities.some(i=>i.id===f.id))refs.set(f.id,transition.ownership.retain(f,'proxy'));
 const p=[],n=[],uv=[],colors=[],ids=[],owners=[],buckets=new Map();
 for(const part of data.polygonal)for(const group of part.result.groups){
  const batch=palette.mapping.get(group.materialIndex);if(!batch)continue;const mapping=new Map(),color=batch.colored?materials[group.materialIndex].color:null;
  if(!buckets.has(batch.index))buckets.set(batch.index,[]);const bucket=buckets.get(batch.index);
  for(let at=group.start;at<group.start+group.count;at++){
   const i=part.result.indices[at];if(!mapping.has(i)){
    mapping.set(i,p.length/3);for(let a=0;a<3;a++){p.push((part.cell[a]*8+part.result.positions[i*3+a])*data.step+(a===1?floor:0));n.push(part.result.normals[i*3+a]);}
    uv.push(part.result.uvs[i*2]*data.step,part.result.uvs[i*2+1]*data.step);colors.push(color?.r??1,color?.g??1,color?.b??1);ids.push(refs.get(part.ids[i])||0);owners.push(part.ids[i]);
   }bucket.push(mapping.get(i));
  }
 }
 const geometry=new THREE.BufferGeometry();for(const [name,array,size] of [['position',p,3],['normal',n,3],['uv',uv,2],['color',colors,3]])geometry.setAttribute(name,new THREE.Float32BufferAttribute(array,size));geometry.setAttribute('nvTree',new THREE.Uint16BufferAttribute(ids,1));geometry.computeBoundingSphere();
 const stableMaterials=palette.batches.map(b=>b.material);
 const mesh=new THREE.Mesh(geometry,palette.batches.map(b=>{const m=vegetationDither(b.material,transition.ownership.texture,{proxy:true,fade:transition.fade,direction:transition.direction});owned.push(m);return m;})),group=new THREE.Group();group.add(mesh);mesh.userData.vegetationProxy=true;
 data={...data,polygonal:true};
 const culling=featureCulling(THREE,data.region.features,floor,data.step*.25);let view=null,currentReady=()=>false;const cullingStats={scans:0,bufferRewrites:0,culled:0};
 let signature=null,visible=null;
 function mask(ready){
  currentReady=ready;const flags=new Map(data.identities.map(f=>[f.id,!ready('',f.id)])),key=data.identities.map(f=>`${+flags.get(f.id)}${+(!view||view.has(f.id))}`).join('');if(key===signature)return visible;signature=key;
  const index=[],active=new Set();geometry.clearGroups();for(const [material,list] of buckets){const start=index.length;for(let i=0;i<list.length;i+=3){const tri=list.slice(i,i+3);if(tri.some(v=>flags.get(owners[v])&&(!view||view.has(owners[v])))){index.push(...tri);for(const v of tri)active.add(owners[v]);}}if(index.length>start)geometry.addGroup(start,index.length-start,material);}
  geometry.setIndex(index);cullingStats.bufferRewrites++;mesh.visible=index.length>0;const ownedIds=new Set([...flags].filter(([,v])=>v).map(([id])=>id));visible={cells:data.cells.filter(c=>ownedIds.has(c.id)).length,boxes:0,ids:ownedIds};return visible;
 }
 mask(()=>false);return {group,data,mask,bytes:data.cells.length*76+Object.values(geometry.attributes).reduce((s,a)=>s+a.array.byteLength,0)+(geometry.index?.array.byteLength||0),gpuBytes:()=>Object.values(geometry.attributes).reduce((n,a)=>n+a.array.byteLength,0)+(geometry.index?.array.byteLength||0),triangles:()=>geometry.index.count/3,drawCalls:()=>mesh.visible?geometry.groups.length:0,prepareView(camera){mesh.material=vegetationTransitionActive(transition,refs)?owned:stableMaterials;if(stableMaterials.some(m=>m.displacementMap))return;group.updateWorldMatrix(true,false);const next=culling.prepare(camera,group.matrixWorld);if(next!==undefined){view=next;cullingStats.culled=view?data.identities.length-data.identities.filter(f=>view.has(f.id)).length:0;mask(currentReady);}},cullingSnapshot:()=>({...cullingStats,scans:culling.snapshot().scans}),dispose(){for(const id of refs.keys())transition.ownership.release(id,'proxy');for(const m of owned)m.dispose();palette.dispose();geometry.dispose();group.removeFromParent();}};
}
