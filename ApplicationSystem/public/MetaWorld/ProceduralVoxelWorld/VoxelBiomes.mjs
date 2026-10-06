// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelBiomes.mjs
// This module classifies broad seeded climate regions and supplies shared biome-specific pine density parameters for development V1.
import { noise } from './SeededVoxelNoise.mjs';
export const BIOME_PARAMETERS = Object.freeze({ scale:768, seedSalt:13271, coldThreshold:.61 });
export const BIOMES = Object.freeze({
  temperate:Object.freeze({id:'temperate',name:'Temperate Rolling Hills',forestThreshold:.35,pineBase:.12,pineField:.48}),
  snowy:Object.freeze({id:'snowy-pine-forest',name:'Snowy Pine Forest',forestThreshold:0,pineBase:.7,pineField:.25})
});
export function biomeAt(x,z,seed){
  const p=BIOME_PARAMETERS;
  return noise(x/p.scale,z/p.scale,seed^p.seedSalt)>p.coldThreshold?BIOMES.snowy:BIOMES.temperate;
}
