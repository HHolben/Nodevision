// Nodevision/ApplicationSystem/public/MetaWorld/VegetationLOD/Instances.mjs
// This module batches proxy cells by canonical material using shared box geometry. Each cell belongs to one detailed chunk, allowing an exact residency handoff without anonymous authored objects or proxy colliders.
import {mergeProxyBoxes} from './Boxes.mjs';
export function vegetationInstances(THREE,data,geometry,materials,floor){
 const group=new THREE.Group(),buckets=new Map(),matrix=new THREE.Matrix4(),scale=new THREE.Vector3(),rotation=new THREE.Quaternion(),position=new THREE.Vector3();
 for(const c of mergeProxyBoxes(data.cells,data.step,materials)){if(!buckets.has(c.material))buckets.set(c.material,[]);buckets.get(c.material).push(c);}
 const meshes=[];
 for(const [material,cells] of buckets){
  if(!materials[material-1])continue;
  const mesh=new THREE.InstancedMesh(geometry,materials[material-1],cells.length);mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  // Recompute bounds when a residency mask changes, so ordinary frustum culling stays valid.
  mesh.userData.vegetationProxy=true;group.add(mesh);meshes.push({mesh,cells,signature:''});
 }
 function mask(ready){
  let represented=0,boxCount=0;const ids=new Set();
  for(const batch of meshes){
   const flags=batch.cells.map(c=>!ready(c.chunk)),signature=flags.map(v=>v?'1':'0').join('');
   if(signature!==batch.signature){
    batch.signature=signature;
    batch.cells.forEach((c,i)=>{const size=c.size||[data.step,data.step,data.step];position.set(...c.p.map((v,a)=>(v+size[a]/2)*.25+(a===1?floor:0)));scale.fromArray(size.map(n=>flags[i]?n*.25:0));matrix.compose(position,rotation,scale);batch.mesh.setMatrixAt(i,matrix);});
    batch.mesh.instanceMatrix.needsUpdate=true;batch.mesh.computeBoundingSphere();
   }
   batch.mesh.visible=flags.some(Boolean);
   flags.forEach((v,i)=>{if(v){represented+=batch.cells[i].sourceCount||1;boxCount++;ids.add(batch.cells[i].id);}});
  }
  return {cells:represented,boxes:boxCount,ids};
 }
 mask(()=>false);
 return {group,data,mask,bytes:data.cells.length*64,drawCalls:()=>meshes.filter(b=>b.mesh.visible).length,
  dispose(){for(const {mesh} of meshes)mesh.dispose();group.removeFromParent();}};
}
