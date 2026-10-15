// Nodevision/ApplicationSystem/public/MetaWorld/Text/TextMaterialCache.mjs
// This module shares catalog material requests and identical sign surface materials while reference-counting their GPU lifetimes.
import {resolveWorldObjectMaterial} from '../Materials/WorldObjectMaterialResolver.mjs';
const definitions=new Map(),surfaces=new Map(),owners=new WeakMap();
export function textMaterialInfo(id) {
 if(!definitions.has(id))definitions.set(id,resolveWorldObjectMaterial(id));
 return definitions.get(id);
}
export function acquireTextSurfaceMaterial(THREE,id,color,def) {
 const key=JSON.stringify([id,color,def.roughness,def.metalness,def.opacity,def.materialProperties]);let entry=surfaces.get(key);
 if(!entry){
  const material=new THREE.MeshStandardMaterial({color,roughness:def.roughness,metalness:def.metalness,opacity:def.opacity,transparent:def.opacity<1,side:THREE.DoubleSide});
  entry={key,material,users:0};surfaces.set(key,entry);owners.set(material,entry);
  if(id)textMaterialInfo(id).then(info=>{if(!entry.users)return;const r=info.rendering;material.color.set(r.color||color);if(def.materialProperties){material.roughness=r.roughness??def.roughness;material.metalness=r.metalness??def.metalness;}}).catch(()=>{});
 }
 entry.users++;return entry.material;
}
export function releaseTextSurfaceMaterial(material) {
 const entry=owners.get(material);if(!entry)return false;
 if(--entry.users===0){material.dispose();owners.delete(material);surfaces.delete(entry.key);}return true;
}
export const textSurfaceMaterialCacheSize=()=>surfaces.size;
