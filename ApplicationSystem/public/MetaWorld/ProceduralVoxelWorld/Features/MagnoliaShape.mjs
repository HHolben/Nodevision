// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/Features/MagnoliaShape.mjs
// This module creates spreading magnolias with pale blossoms distributed across their canonical leafy crowns.
import { broadleafParameters, sampleBroadleaf } from './BroadleafShape.mjs';
import { treeMaterialIndices, VOXEL_MATERIAL_IDS } from '../VoxelMaterialIds.mjs';
import { hash } from '../SeededVoxelNoise.mjs';
const config={height:[24,37],trunk:[1.7,2.4],crown:[11,15],crookedness:.6,branches:6,branchStart:.2,branchRadius:1.2};
const materials=treeMaterialIndices('Magnolia'),blossom=VOXEL_MATERIAL_IDS.indexOf('MagnoliaBlossom');
export const magnoliaParameters=seed=>broadleafParameters(seed,config);
export function sampleMagnoliaVoxel(x,y,z,seed,p){
  const value=sampleBroadleaf(x,y,z,seed,p,materials);
  return value===materials[2]&&hash(Math.floor(x/2)+Math.floor(y/2)*37,Math.floor(z/2),seed)>.83?blossom:value;
}
