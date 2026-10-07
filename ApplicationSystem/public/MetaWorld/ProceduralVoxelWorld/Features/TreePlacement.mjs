// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/Features/TreePlacement.mjs
// This shared placement provider assigns one bounded tree per owned cell using coherent habitat, canonical ground, dry elevation and species-specific slope constraints.
import { MOSS_VOXEL } from '../VoxelMaterialIds.mjs';
import { hash, noise } from '../SeededVoxelNoise.mjs';
import { BIOMES } from '../VoxelBiomes.mjs';
import { TERRAIN_V1 } from '../VoxelTerrainParameters.mjs';
import { pineParameters, samplePineVoxel } from './PineShape.mjs';
import { mapleParameters, sampleMapleVoxel } from './MapleShape.mjs';
import { oakParameters, sampleOakVoxel } from './OakShape.mjs';
import { TREE_ECOLOGY as P, treeSpeciesAt } from './TreeEcology.mjs';
import { magnoliaParameters, sampleMagnoliaVoxel } from './MagnoliaShape.mjs';
const shapes={Magnolia:[magnoliaParameters,sampleMagnoliaVoxel],Pine:[pineParameters,samplePineVoxel],Maple:[mapleParameters,sampleMapleVoxel],Oak:[oakParameters,sampleOakVoxel]};
export function createTreePlacement(base,seed){
  return {cellSize:P.cellSize,reach:P.reach,maxHeight:53,candidate(rx,rz){
    const treeSeed=(hash(rx,rz,seed^982451653)*2147483647)|0;
    const x=rx*P.cellSize+24+Math.floor((hash(1,0,treeSeed)*2-1)*P.jitter);
    const z=rz*P.cellSize+24+Math.floor((hash(2,0,treeSeed)*2-1)*P.jitter);
    const y=base.getTerrainHeight(x,z),species=treeSpeciesAt(x,z,base,seed);if(!species)return null;
    const cold=base.getBiome(x,z)==='snowy-pine-forest',biome=cold?BIOMES.snowy:BIOMES.temperate;
    const forest=noise(x/192,z/192,seed^982451653);
    if(forest<biome.forestThreshold||hash(3,0,treeSeed)>biome.pineBase+biome.pineField*forest)return null;
    const slope=base.getSlope(x,z);if(slope>P[species.toLowerCase()+'Slope'])return null;
    if(y<(base.getWaterTop?.(x,z)??TERRAIN_V1.waterLevelVoxelY+1)||![1,2,12,MOSS_VOXEL].includes(base.getVoxel(x,y-1,z)))return null;
    const [parametersFor,sample]=shapes[species],parameters=parametersFor(treeSeed),r=species==='Pine'?12:Math.ceil(parameters.crownRadius*1.34);
    if(x-r<0||z-r<0||x+r>=base.dimensions[0]||z+r>=base.dimensions[2]||y+parameters.height>base.dimensions[1])return null;
    return {id:`${species.toLowerCase()}:${rx},${rz}`,species,seed:treeSeed,origin:[x,y,z],parameters,
      min:[x-r,y,z-r],max:[x+r+1,y+parameters.height,z+r+1],sample:(vx,vy,vz)=>sample(vx-x,vy-y,vz-z,treeSeed,parameters)};
  }};
}
