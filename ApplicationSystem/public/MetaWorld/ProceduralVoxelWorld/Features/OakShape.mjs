// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/Features/OakShape.mjs
// This module defines thicker crooked oak trunks, heavy lower branches and spreading foliage lobes through the shared broadleaf sampler.
import { broadleafParameters, sampleBroadleaf } from './BroadleafShape.mjs';
import { treeMaterialIndices } from '../VoxelMaterialIds.mjs';
export const OAK = Object.freeze({height:[32,53],trunk:[2.6,3.5],crown:[12,17],crookedness:1.1,branches:6,branchStart:.22,branchRadius:1.8});
const materials=treeMaterialIndices('Oak');
export const oakParameters=seed=>broadleafParameters(seed,OAK);
export const sampleOakVoxel=(x,y,z,seed,p)=>sampleBroadleaf(x,y,z,seed,p,materials);
