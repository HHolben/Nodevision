// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelMountainSurface.mjs
// This module chooses exposed mountain rock and an irregular canonical snow cap without replacing underground material cells.
import { noise } from './SeededVoxelNoise.mjs';
import { SNOW_VOXEL } from './VoxelMaterialIds.mjs';
export const MOUNTAIN_SURFACE = Object.freeze({ rockElevation:140, snowLine:240, snowVariation:32,
  snowScale:160, snowSalt:67867967, coldOffset:24, cliffSlope:1.2, transition:8 });
export function mountainSurface({x,z,height,slope,biome,limestone,seed}){
  const p=MOUNTAIN_SURFACE;
  if(height<=p.rockElevation)return null;
  const rock=limestone?4:3;
  if(slope>=p.cliffSlope)return rock;
  const line=p.snowLine+(noise(x/p.snowScale,z/p.snowScale,seed^p.snowSalt)-.5)*p.snowVariation
    -(biome.id==='snowy-pine-forest'?p.coldOffset:0);
  if(height>=line)return SNOW_VOXEL;
  if(height>=line-p.transition||slope>.65)return rock;
  return null;
}
