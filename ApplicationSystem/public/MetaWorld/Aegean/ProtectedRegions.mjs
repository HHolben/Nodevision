// Nodevision/ApplicationSystem/public/MetaWorld/Aegean/ProtectedRegions.mjs
// This module preserves bounded terrain recipes beneath authored content and excludes procedural vegetation without baking world-sized voxel snapshots.
import { createCoastalField } from './CoastalField.mjs';
import { validateAegean } from './AegeanDefinition.mjs';
export function validateProtectedRegions(def) {
  const regions=def.protectedRegions;if(regions===undefined)return;
  if(!def.environment||!Array.isArray(regions)||regions.length>256)throw Error('Aegean protection requires at most 256 regions.');
  for(const r of regions){
    if(typeof r.id!=='string'||!Array.isArray(r.min)||!Array.isArray(r.max)||r.min.length!==2||r.max.length!==2||![...r.min,...r.max].every(Number.isInteger)||r.min.some((v,i)=>v<0||r.max[i]<=v||r.max[i]>def.size[i===0?0:2]*4))throw Error('Invalid protected terrain region.');
    if(!Number.isInteger(r.seed)||r.seed< -2147483648||r.seed>2147483647)throw Error('Invalid protection seed.');
    if(!r.environment)throw Error('Protected terrain requires its original environment definition.');
    validateAegean({...def,environment:r.environment});
    if(r.generation!==undefined&&(!r.generation||Object.entries(r.generation).some(([key,value])=>!['water','vegetation','caves'].includes(key)||typeof value!=='boolean')))throw Error('Invalid protected generation flags.');
  }
}
export function createProtectedField(def,dimensions,coast) {
  const regions=(def.protectedRegions||[]).map(r=>({...r,field:createCoastalField({...def,generator:{...def.generator,seed:r.seed},environment:r.environment,generation:r.generation||def.generation},dimensions)}));
  return {sample(x,z){
    const region=regions.find(r=>x>=r.min[0]&&z>=r.min[1]&&x<r.max[0]&&z<r.max[1]);
    return region?region.field.sample(x,z):coast.sample(x,z);
  },clear(){coast.clear();for(const r of regions)r.field.clear();},sea:coast.sea};
}
export function excludesProtectedFeature(def,feature) {
  return feature&&(def.protectedRegions||[]).some(r=>feature.min[0]<r.max[0]&&feature.max[0]>r.min[0]&&feature.min[2]<r.max[1]&&feature.max[2]>r.min[1]);
}
export function preserveAuthoredGround(THREE,current,next,objects) {
  if(!current.environment)return next;
  const regions=structuredClone(current.protectedRegions||[]);
  if(!next.environment)throw Error('Remove Aegean protection explicitly before changing environment type.');
  if(regions.length&&(next.size.some((n,i)=>n!==current.size[i])||next.heightLimits?.min!==current.heightLimits?.min))throw Error('Protected Aegean terrain cannot be resized or change its minimum height.');
  for(const object of objects){
    if(object.userData?.proceduralVoxelRuntime||object.userData?.pathRuntime)continue;
    object.updateMatrixWorld(true);const bounds=new THREE.Box3().setFromObject(object);if(bounds.isEmpty())continue;
    const min=[bounds.min.x,bounds.min.z].map((v,i)=>Math.max(0,Math.floor((v-current.position[i===0?0:2]-2)*4)));
    const max=[bounds.max.x,bounds.max.z].map((v,i)=>Math.min(current.size[i===0?0:2]*4,Math.ceil((v-current.position[i===0?0:2]+2)*4)));
    if(min.some((v,i)=>v>=max[i]))continue;
    if(regions.some(r=>r.min.every((v,i)=>v<=min[i]&&r.max[i]>=max[i])))continue;
    regions.push({id:'authored:'+String(object.userData.metaWorldLayerId||object.uuid),min,max,seed:current.generator.seed,environment:structuredClone(current.environment),generation:structuredClone(current.generation||{})});
  }
  if(regions.length&&(next.size.some((n,i)=>n!==current.size[i])||next.heightLimits?.min!==current.heightLimits?.min))throw Error('Authored Aegean content prevents resizing or changing minimum height during regeneration.');
  next.protectedRegions=regions;validateProtectedRegions(next);return next;
}
