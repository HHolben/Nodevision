// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelTerrainGenerator.mjs
// This module produces deterministic finite heightfield terrain without depending on rendering or scene state.

import { CHUNK_SIZE, chunkToVoxel, containsVoxel, voxelDimensions, voxelIndex } from "./VoxelCoordinates.mjs";
export const VOXEL_MATERIALS = [null,
  { color: "#568c38", physicsMaterialId: "grass" },
  { color: "#795438", physicsMaterialId: "soil" },
  { color: "#858583", physicsMaterialId: "limestone" }];
function hash(x, z, seed) {
  let n = Math.imul(x, 374761393) ^ Math.imul(z, 668265263) ^ seed;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}
function noise(x, z, seed) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const smooth = t => t * t * (3 - 2 * t);
  const a = smooth(x - ix), b = smooth(z - iz);
  const mix = (p, q, t) => p + (q - p) * t;
  return mix(mix(hash(ix, iz, seed), hash(ix + 1, iz, seed), a),
    mix(hash(ix, iz + 1, seed), hash(ix + 1, iz + 1, seed), a), b);
}
export function createVoxelGenerator(def) {
  const dimensions = voxelDimensions(def.size), seed = def.generator.seed;
  function getTerrainHeight(x, z) {
    if (x < 0 || z < 0 || x >= dimensions[0] || z >= dimensions[2]) return 0;
    return Math.min(dimensions[1], Math.max(1, Math.floor(48 + 48 * noise(x / 256, z / 256, seed) + 12 * noise(x / 64, z / 64, seed ^ 7919))));
  }
  function getVoxel(x, y, z) {
    if (!containsVoxel([x, y, z], dimensions)) return 0;
    const height = getTerrainHeight(x, z);
    return y >= height ? 0 : y === height - 1 ? 1 : y >= height - 5 ? 2 : 3;
  }
  function generateChunk(cx, cy, cz) {
    const origin = chunkToVoxel([cx, cy, cz]), data = new Uint8Array(CHUNK_SIZE ** 3);
    for (let z = 0; z < CHUNK_SIZE; z++) for (let x = 0; x < CHUNK_SIZE; x++) {
      const h = getTerrainHeight(origin[0] + x, origin[2] + z);
      for (let y = 0; y < CHUNK_SIZE; y++) {
        const gy = origin[1] + y;
        data[voxelIndex(x, y, z)] = gy < 0 || gy >= h ? 0 : gy === h - 1 ? 1 : gy >= h - 5 ? 2 : 3;
      }
    }
    return data;
  }
  return { dimensions, maxSolidHeight: Math.min(108, dimensions[1]), getTerrainHeight, getVoxel, generateChunk };
}
