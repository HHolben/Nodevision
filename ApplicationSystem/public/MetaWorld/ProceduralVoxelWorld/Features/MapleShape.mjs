// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/Features/MapleShape.mjs
// This module defines maple dimensions and its relatively upright branched silhouette using the shared broadleaf voxel sampler.
import { broadleafParameters, sampleBroadleaf } from './BroadleafShape.mjs';
import { treeMaterialIndices } from '../VoxelMaterialIds.mjs';
export const MAPLE = Object.freeze({height:[28,45],trunk:[1.8,2.5],crown:[10,14],crookedness:.35,branches:5,branchStart:.27,branchRadius:1.2});
const materials=treeMaterialIndices('Maple');
export const mapleParameters=seed=>broadleafParameters(seed,MAPLE);
export const sampleMapleVoxel=(x,y,z,seed,p)=>sampleBroadleaf(x,y,z,seed,p,materials);
