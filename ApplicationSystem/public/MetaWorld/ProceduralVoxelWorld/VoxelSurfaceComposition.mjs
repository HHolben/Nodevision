// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelSurfaceComposition.mjs
// This module selects real canonical surface materials from water-relative elevation, coherent sediment variation and geology, with cold cover restricted to dry uplands.
import { noise } from './SeededVoxelNoise.mjs';
import { SAND_VOXEL, MUD_VOXEL, GRAVEL_VOXEL, SNOW_VOXEL } from './VoxelMaterialIds.mjs';
export const SHORE_PARAMETERS = Object.freeze({ dryMargin:2, shallowDepth:6, sedimentScale:96,
  sedimentSalt:15485863, wetThreshold:.56 });
export function surfaceMaterial({x,z,height,waterTop,limestone,biome,seed}){
  const p=SHORE_PARAMETERS,depth=waterTop-height;
  if(depth < -p.dryMargin)return biome.id==='snowy-pine-forest'?SNOW_VOXEL:1;
  const wet=noise(x/p.sedimentScale,z/p.sedimentScale,seed^p.sedimentSalt)>p.wetThreshold;
  if(depth>p.shallowDepth)return limestone?4:wet?MUD_VOXEL:3;
  return limestone?GRAVEL_VOXEL:wet?MUD_VOXEL:SAND_VOXEL;
}
