// Nodevision/ApplicationSystem/public/MetaWorld/Paths/PathClearance.mjs
// Evaluates finite, directional excavation envelopes against the upstream occupancy without baking modifications into terrain or treating distant ground and water as support.
import {VOXEL_MATERIAL_IDS,LEGACY_VOXEL_MATERIAL_COUNT,isLiquidVoxel} from '../ProceduralVoxelWorld/VoxelMaterialIds.mjs';
export const pathMaterialId=value=>({dirt:'soil',paved:'stone',gravel:'LimestoneGravel'})[value]||value;
export function pathVoxelMaterial(value){const id=VOXEL_MATERIAL_IDS.indexOf(pathMaterialId(value));if(id<=0||id>=LEGACY_VOXEL_MATERIAL_COUNT||isLiquidVoxel(id))throw Error('Excavation requires a solid material from the terrain voxel palette. Use overlay for other materials.');return id;}
export function clearanceAt(path,x,z){
  const d=path.def,limit=d.width/2+Math.max(d.leftClearance||0,d.rightClearance||0),near=path.nearest(x,z,limit+.001);
  const exact=path.heightAt(x,z);if(Number.isFinite(exact))return {height:exact,surface:true};
  if(!Number.isFinite(near.height)||near.distance>limit||near.endOutside)return null;
  const side=near.signedDistance,reach=d.width/2+(side>=0?d.leftClearance||0:d.rightClearance||0);
  if(near.distance>reach)return null;
  return {height:near.height,surface:false};
}
export function pathColumn(path,x,z,origin,upstream){
  const hit=clearanceAt(path,origin[0]+(x+.5)*.25,origin[2]+(z+.5)*.25);if(!hit)return null;
  const target=(hit.height-origin[1])/.25,top=Math.floor(target+1e-7),floor=top-1,id=upstream(x,floor,z);
  return {path,top,floor,supported:hit.surface&&id!==0&&!isLiquidVoxel(id),surface:hit.surface,material:pathVoxelMaterial(path.def.surfaceMaterial),
    low:Math.floor(target-(path.def.lowerClearance||0)*4+1e-7),high:Math.ceil(target+(path.def.upperClearance||0)*4-1e-7)};
}
export function applyPathColumn(operations,y,value){
  for(const op of operations){
    if(isLiquidVoxel(value))continue;
    if(op.supported&&y===op.floor)value=op.material;
    else if(y>=op.low&&y<op.high)value=0;
  }return value;
}
