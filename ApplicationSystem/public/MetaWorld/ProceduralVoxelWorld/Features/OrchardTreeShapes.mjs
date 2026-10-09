// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/Features/OrchardTreeShapes.mjs
// This module defines fruitless apple, pear and cherry silhouettes using the shared broadleaf sampler and each species' canonical wood, bark and foliage.
import { broadleafParameters, sampleBroadleaf } from './BroadleafShape.mjs';
import { treeMaterialIndices } from '../VoxelMaterialIds.mjs';

// Apples spread low, pears grow taller and narrower, and cherries have a raised branching crown.
export const ORCHARD_CONFIGS=Object.freeze({
  Apple:{height:[20,29],trunk:[1.6,2.2],crown:[9,12],crookedness:.8,branches:6,branchStart:.19,branchRadius:1.1},
  Pear:{height:[28,39],trunk:[1.7,2.3],crown:[7,10],crookedness:.2,branches:5,branchStart:.3,branchRadius:1.1},
  Cherry:{height:[25,37],trunk:[1.7,2.4],crown:[10,13],crookedness:.45,branches:5,branchStart:.33,branchRadius:1.2},
});
export const ORCHARD_SHAPES=Object.freeze(Object.fromEntries(Object.entries(ORCHARD_CONFIGS).map(([species,config])=>{
  const materials=treeMaterialIndices(species);
  return [species,[seed=>broadleafParameters(seed,config),(x,y,z,seed,p)=>sampleBroadleaf(x,y,z,seed,p,materials)]];
})));
