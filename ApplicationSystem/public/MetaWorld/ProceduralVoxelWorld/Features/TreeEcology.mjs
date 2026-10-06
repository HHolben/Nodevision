// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/Features/TreeEcology.mjs
// This module assigns tree species to coherent habitat regions and centralizes elevation and slope limits without per-candidate species lotteries.
import { noise } from '../SeededVoxelNoise.mjs';
export const TREE_ECOLOGY=Object.freeze({cellSize:48,jitter:4,reach:24,broadleafLine:180,pineLine:240,coldPineLine:216,
  mapleSlope:.5,oakSlope:.5,pineSlope:.75,speciesScale:384,speciesSalt:86028121});
export function treeSpeciesAt(x,z,base,seed){
  const height=base.getTerrainHeight(x,z),cold=base.getBiome(x,z)==='snowy-pine-forest',p=TREE_ECOLOGY;
  if(height>=(cold?p.coldPineLine:p.pineLine))return null;
  if(cold||height>=p.broadleafLine)return 'Pine';
  const habitat=noise(x/p.speciesScale,z/p.speciesScale,seed^p.speciesSalt);
  return habitat<.3?'Pine':habitat<.64?'Maple':'Oak';
}
