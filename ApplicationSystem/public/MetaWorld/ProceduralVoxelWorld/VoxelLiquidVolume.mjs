// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelLiquidVolume.mjs
// This adapter resolves procedural liquid cells to their canonical swimming metadata without per-cell volume allocation or solid collision.
import { worldToVoxel } from './VoxelCoordinates.mjs';
export function createVoxelLiquidVolume(root,runtime,entries,isDisposed){
  const volumes=new Map(entries.filter(e=>e?.matterState==='liquid').map(e=>[e.materialId,{
    target:root,object3d:root,MatterState:e.matterState,materialId:e.materialId,physicsMaterialId:e.physicsMaterialId,
    materialFile:e.materialFile,materialDefinition:e.materialDefinition,buoyancyScale:e.collider.buoyancyScale
  }]));
  function sampleAt(point){
    if(isDisposed()||!root.visible)return null;
    const cell=worldToVoxel([point.x,point.y,point.z],root.position.toArray());
    return volumes.get(runtime.getVoxelMaterial(...cell)?.materialId)||null;
  }
  return Object.assign(volumes.get('water'),{sampleAt,containsPoint:point=>Boolean(sampleAt(point))});
}
