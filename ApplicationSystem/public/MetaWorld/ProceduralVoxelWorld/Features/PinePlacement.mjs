// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/Features/PinePlacement.mjs
// This module places seeded pine candidates on suitable dry gentle terrain and declares conservative feature bounds for local spatial queries.
import { hash, noise } from '../SeededVoxelNoise.mjs';
import { TERRAIN_V1 } from '../VoxelTerrainParameters.mjs';
import { BIOMES } from "../VoxelBiomes.mjs";
import { SNOW_VOXEL } from "../VoxelMaterialIds.mjs";
import { PINE_SHAPE, pineParameters, samplePineVoxel } from './PineShape.mjs';
export const PINE_PLACEMENT = Object.freeze({ cellSize:24, reach:PINE_SHAPE.maxRadius, salt:982451653,
  densityScale:192, maximumSlope:3, suitableMaterials:[1,2,SNOW_VOXEL] });
export function createPinePlacement(base,seed) {
  const p=PINE_PLACEMENT;
  return { cellSize:p.cellSize, reach:p.reach, maxHeight:PINE_SHAPE.maxHeight,
    candidate(rx,rz){
      const localSeed=(hash(rx,rz,seed^p.salt)*2147483647)|0;
      const x=rx*p.cellSize+Math.min(p.cellSize-1,Math.floor(hash(1,0,localSeed)*p.cellSize));
      const z=rz*p.cellSize+Math.min(p.cellSize-1,Math.floor(hash(2,0,localSeed)*p.cellSize));
      const forest=noise(x/p.densityScale,z/p.densityScale,seed^p.salt);
      const biome=base.getBiome?.(x,z)==='snowy-pine-forest'?BIOMES.snowy:BIOMES.temperate;
      if(forest<biome.forestThreshold||hash(3,0,localSeed)>biome.pineBase+biome.pineField*forest)return null;
      const y=base.getTerrainHeight(x,z),parameters=pineParameters(localSeed),r=p.reach;
      if(x-r<0||z-r<0||x+r>=base.dimensions[0]||z+r>=base.dimensions[2]||y+parameters.height>base.dimensions[1])return null;
      if(y<=TERRAIN_V1.waterLevelVoxelY||!p.suitableMaterials.includes(base.getVoxel(x,y-1,z)))return null;
      const heights=[[3,0],[-3,0],[0,3],[0,-3]].map(([dx,dz])=>base.getTerrainHeight(x+dx,z+dz));
      if(Math.max(y,...heights)-Math.min(y,...heights)>p.maximumSlope)return null;
      return { id:`pine:${rx},${rz}`,seed:localSeed,origin:[x,y,z],parameters,
        min:[x-r,y,z-r],max:[x+r+1,y+parameters.height,z+r+1],
        sample(vx,vy,vz){return samplePineVoxel(vx-x,vy-y,vz-z,localSeed,parameters);} };
    }
  };
}
