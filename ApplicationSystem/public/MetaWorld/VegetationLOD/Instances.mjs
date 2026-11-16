// Nodevision/ApplicationSystem/public/MetaWorld/VegetationLOD/Instances.mjs
// Batches source cells and anchored trunk envelopes by canonical material. Feature IDs survive compaction and frustum filtering; owned transition resources remain separate from the shared box geometry and palette.
import {frustumInstances} from './FrustumInstances.mjs';
import {colorBatches} from '../Rendering/ColorBatches.mjs';
import {vegetationDither,vegetationTransitionActive} from './Dither.mjs';
import {voxelTrunkBoxes} from './Trunks.mjs';
import {mergeProxyBoxes} from './Boxes.mjs';
export function vegetationInstances(THREE,data,geometry,materials,floor,transition=null){
 const group=new THREE.Group(),buckets=new Map(),matrix=new THREE.Matrix4(),scale=new THREE.Vector3(),rotation=new THREE.Quaternion(),position=new THREE.Vector3();
 const renderCells=voxelTrunkBoxes(data.cells);
 const palette=colorBatches(materials,new Set(renderCells.map(c=>c.material-1)));
 for(const c of mergeProxyBoxes(renderCells,data.step,materials)){const batch=palette.mapping.get(c.material-1);if(!batch)continue;if(!buckets.has(batch))buckets.set(batch,[]);buckets.get(batch).push(c);}
 const meshes=[],owned=[],refs=new Map();
 if(transition)for(const f of data.region.features)if(data.identities.some(i=>i.id===f.id))refs.set(f.id,transition.ownership.retain(f,'proxy'));
 for(const [batch,cells] of buckets){
  const material=transition?vegetationDither(batch.material,transition.ownership.texture,{proxy:true,fade:transition.fade,direction:transition.direction}):batch.material;if(transition)owned.push(material);
  const mesh=new THREE.InstancedMesh(geometry,material,cells.length);
  const treeIds=new THREE.InstancedBufferAttribute(new Uint16Array(cells.length),1);if(transition){mesh.geometry=geometry.clone();mesh.geometry.setAttribute('nvTree',treeIds);}mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  // Pack only visible owners into the draw range; hidden detail must not consume vertex work.
  mesh.userData.vegetationProxy=true;group.add(mesh);
  const pack=visible=>{let count=0;for(const c of visible){const size=c.size||[data.step,data.step,data.step];position.set(...c.p.map((v,a)=>(v+size[a]/2)*.25+(a===1?floor:0)));scale.fromArray(size.map(n=>n*.25));matrix.compose(position,rotation,scale);mesh.setMatrixAt(count,matrix);if(transition)treeIds.array[count]=refs.get(c.id)||0;if(batch.colored)mesh.setColorAt(count,materials[c.material-1].color);count++;}mesh.count=count;if(transition)treeIds.needsUpdate=true;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;};
  const culling=frustumInstances(THREE,mesh,pack,floor,data.step);
  meshes.push({mesh,cells,culling,baseMaterial:batch.material,transitionMaterial:material,signature:''});
 }
 function mask(ready){
  let represented=0,boxCount=0;const ids=new Set();
  for(const batch of meshes){
   const flags=batch.cells.map(c=>!ready(c.chunk,c.id)),signature=flags.map(v=>v?'1':'0').join('');
   if(signature!==batch.signature){
    batch.signature=signature;
    batch.culling.setCells(batch.cells.filter((c,i)=>flags[i]));
   }
   batch.mesh.visible=flags.some(Boolean);
   flags.forEach((v,i)=>{if(v){represented+=batch.cells[i].sourceCount||1;boxCount++;ids.add(batch.cells[i].id);}});
  }
  return {cells:represented,boxes:boxCount,ids};
 }
 mask(()=>false);
 return {group,data,mask,cullingSnapshot(){const stats={scans:0,bufferRewrites:0,culled:0};for(const b of meshes){const s=b.culling.snapshot();for(const key of Object.keys(stats))stats[key]+=s[key];}return stats;},prepareView(camera){const fading=vegetationTransitionActive(transition,refs);group.updateWorldMatrix(true,false);for(const b of meshes){b.mesh.material=fading?b.transitionMaterial:b.baseMaterial;b.culling.prepare(camera,group.matrixWorld);}},shaderMeshes:()=>({dither:meshes.filter(b=>b.mesh.material.userData.vegetationDither).length,opaque:meshes.filter(b=>!b.mesh.material.userData.vegetationDither).length}),instanceCount:()=>meshes.reduce((n,b)=>n+b.mesh.count,0),gpuBytes:()=>meshes.reduce((n,b)=>n+b.mesh.instanceMatrix.array.byteLength+(b.mesh.instanceColor?.array.byteLength||0)+Object.values(b.mesh.geometry.attributes).reduce((s,a)=>s+a.array.byteLength,0)+(b.mesh.geometry.index?.array.byteLength||0),0),bytes:data.cells.length*76,drawCalls:()=>meshes.filter(b=>b.mesh.visible&&b.mesh.count>0).length,
  dispose(){palette.dispose();for(const m of owned)m.dispose();for(const id of refs.keys())transition.ownership.release(id,'proxy');for(const {mesh,culling} of meshes){culling.dispose();if(transition)mesh.geometry.dispose();mesh.dispose();}group.removeFromParent();}};
}
