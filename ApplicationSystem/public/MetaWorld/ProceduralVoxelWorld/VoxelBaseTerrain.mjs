// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelBaseTerrain.mjs
// This module produces deterministic finite heightfield terrain without depending on rendering or scene state.

import { CHUNK_SIZE, chunkToVoxel, containsVoxel, voxelDimensions, voxelIndex } from "./VoxelCoordinates.mjs";
import { voxelMaterialId, WATER_VOXEL, MUD_VOXEL } from "./VoxelMaterialIds.mjs";
import { TERRAIN_V1 as P } from "./VoxelTerrainParameters.mjs";
import { biomeAt } from "./VoxelBiomes.mjs";
import { surfaceMaterial } from "./VoxelSurfaceComposition.mjs";
import { noise } from "./SeededVoxelNoise.mjs";
export function createBaseTerrain(def) {
  const dimensions = voxelDimensions(def.size), seed = def.generator.seed;
  function getTerrainHeight(x, z) {
    if (x < 0 || z < 0 || x >= dimensions[0] || z >= dimensions[2]) return 0;
    return Math.min(dimensions[1], Math.max(1, Math.floor(P.baseHeight + P.broadHeight * noise(x / P.broadScale, z / P.broadScale, seed) + P.detailHeight * noise(x / P.detailScale, z / P.detailScale, seed ^ P.detailSeedSalt))));
  }
  const columns=new Array(4096);
  function materialColumn(x, z) {
    const key=(x&127)+((z&31)<<7),cached=columns[key];
    if(cached?.x===x&&cached.z===z)return cached;
    const field = noise(x / P.limestoneScale, z / P.limestoneScale, seed ^ P.limestoneSeedSalt);
    const column={ x,z,height:getTerrainHeight(x,z), limestone:field>P.limestoneThreshold,
      stratum:Math.floor(P.stratumBase+P.stratumAmplitude*field) };
    column.surface=surfaceMaterial({x,z,height:column.height,waterTop:P.waterLevelVoxelY+1,limestone:column.limestone,biome:biomeAt(x,z,seed),seed});
    columns[key]=column;return column;
  }
  function sampleColumn(y, column) {
    if (y < 0 || y >= dimensions[1] || !column.height) return 0;
    if (y >= column.height) return y <= P.waterLevelVoxelY ? WATER_VOXEL : 0;
    if (y === column.height - 1) return column.surface;
    if (y >= column.height - P.subsoilDepth) return 2;
    return column.limestone && y >= column.stratum && y < column.stratum + P.stratumThickness ? 4 : 3;
  }
  function getVoxel(x, y, z) {
    return containsVoxel([x,y,z], dimensions) ? sampleColumn(y, materialColumn(x,z)) : 0;
  }
  function getVoxelMaterialId(x, y, z) { return voxelMaterialId(getVoxel(x,y,z)); }
  function generateChunk(cx, cy, cz) {
    const origin = chunkToVoxel([cx, cy, cz]), data = new Uint8Array(CHUNK_SIZE ** 3);
    for (let z = 0; z < CHUNK_SIZE; z++) for (let x = 0; x < CHUNK_SIZE; x++) {
      const column = materialColumn(origin[0] + x, origin[2] + z);
      for (let y = 0; y < CHUNK_SIZE; y++) {
        const gy = origin[1] + y;
        data[voxelIndex(x, y, z)] = sampleColumn(gy, column);
      }
    }
    return data;
  }
  function getSolidHeight(x,z){const c=materialColumn(x,z);return Math.max(0,c.height-(c.surface===MUD_VOXEL?1:0));}
  return { getSolidHeight, getBiome:(x,z)=>biomeAt(x,z,seed).id, clearColumns:()=>columns.fill(undefined), dimensions, maxSolidHeight: Math.min(Math.max(P.waterLevelVoxelY + 1, P.baseHeight + P.broadHeight + P.detailHeight), dimensions[1]), getTerrainHeight, getVoxel, getVoxelMaterialId, generateChunk };
}
