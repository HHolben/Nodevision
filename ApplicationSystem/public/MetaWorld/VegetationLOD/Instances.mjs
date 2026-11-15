// Nodevision/ApplicationSystem/public/MetaWorld/VegetationLOD/Instances.mjs
// This module batches proxy cells by canonical material using shared box geometry. Each cell belongs to one detailed chunk, allowing an exact residency handoff without anonymous authored objects or proxy colliders.
import {frustumInstances} from './FrustumInstances.mjs';
import {colorBatches} from '../Rendering/ColorBatches.mjs';
import {mergeProxyBoxes} from './Boxes.mjs';
export function vegetationInstances(THREE,data,geometry,materials,floor){
 const group=new THREE.Group(),buckets=new Map(),matrix=new THREE.Matrix4(),scale=new THREE.Vector3(),rotation=new THREE.Quaternion(),position=new THREE.Vector3();
 const palette=colorBatches(materials,new Set(data.cells.map(c=>c.material-1)));
 for(const c of mergeProxyBoxes(data.cells,data.step,materials)){const batch=palette.mapping.get(c.material-1);if(!batch)continue;if(!buckets.has(batch))buckets.set(batch,[]);buckets.get(batch).push(c);}
 const meshes=[];
 for(const [batch,cells] of buckets){
  const mesh=new THREE.InstancedMesh(geometry,batch.material,cells.length);mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  // Pack only visible owners into the draw range; hidden detail must not consume vertex work.
  mesh.userData.vegetationProxy=true;group.add(mesh);
  const pack=visible=>{let count=0;for(const c of visible){const size=c.size||[data.step,data.step,data.step];position.set(...c.p.map((v,a)=>(v+size[a]/2)*.25+(a===1?floor:0)));scale.fromArray(size.map(n=>n*.25));matrix.compose(position,rotation,scale);mesh.setMatrixAt(count,matrix);if(batch.colored)mesh.setColorAt(count,materials[c.material-1].color);count++;}mesh.count=count;mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;};
  const culling=frustumInstances(THREE,mesh,pack,floor,data.step);
  meshes.push({mesh,cells,culling,signature:''});
 }
 function mask(ready){
  let represented=0,boxCount=0;const ids=new Set();
  for(const batch of meshes){
   const flags=batch.cells.map(c=>!ready(c.chunk)),signature=flags.map(v=>v?'1':'0').join('');
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
 return {group,data,mask,cullingSnapshot(){const stats={scans:0,bufferRewrites:0,culled:0};for(const b of meshes){const s=b.culling.snapshot();for(const key of Object.keys(stats))stats[key]+=s[key];}return stats;},prepareView(camera){group.updateWorldMatrix(true,false);for(const b of meshes)b.culling.prepare(camera,group.matrixWorld);},bytes:data.cells.length*76,drawCalls:()=>meshes.filter(b=>b.mesh.visible&&b.mesh.count>0).length,
  dispose(){palette.dispose();for(const {mesh,culling} of meshes){culling.dispose();mesh.dispose();}group.removeFromParent();}};
}
