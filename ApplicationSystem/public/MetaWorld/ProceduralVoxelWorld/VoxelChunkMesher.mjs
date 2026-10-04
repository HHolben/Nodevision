// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelChunkMesher.mjs
// This module emits indexed exposed voxel faces and queries neighboring cells across chunk boundaries to suppress seams.

import { CHUNK_SIZE, VOXEL_SIZE, chunkToVoxel, voxelIndex } from "./VoxelCoordinates.mjs";
const faces = [
  [[1,0,0], [[1,0,0],[1,1,0],[1,1,1],[1,0,1]]],
  [[-1,0,0], [[0,0,1],[0,1,1],[0,1,0],[0,0,0]]],
  [[0,1,0], [[0,1,1],[1,1,1],[1,1,0],[0,1,0]]],
  [[0,-1,0], [[0,0,0],[1,0,0],[1,0,1],[0,0,1]]],
  [[0,0,1], [[1,0,1],[1,1,1],[0,1,1],[0,0,1]]],
  [[0,0,-1], [[0,0,0],[0,1,0],[1,1,0],[1,0,0]]]
];
export function meshVoxelChunk(data, chunk, getVoxel) {
  const origin = chunkToVoxel(chunk), positions = [], normals = [], materials = [], indices = [];
  let solidVoxels = 0;
  const sample = (x,y,z) => [x,y,z].every(n => n >= 0 && n < CHUNK_SIZE)
    ? data[voxelIndex(x,y,z)] : getVoxel(origin[0]+x, origin[1]+y, origin[2]+z);
  for (let y=0;y<CHUNK_SIZE;y++) for (let z=0;z<CHUNK_SIZE;z++) for (let x=0;x<CHUNK_SIZE;x++) {
    const material = data[voxelIndex(x,y,z)];
    if (!material) continue;
    solidVoxels++;
    for (const [normal, corners] of faces) {
      if (sample(x+normal[0], y+normal[1], z+normal[2])) continue;
      const first = positions.length / 3;
      for (const corner of corners) {
        positions.push((x+corner[0])*VOXEL_SIZE, (y+corner[1])*VOXEL_SIZE, (z+corner[2])*VOXEL_SIZE);
        normals.push(...normal); materials.push(material);
      }
      indices.push(first, first+1, first+2, first, first+2, first+3);
    }
  }
  return { positions, normals, materials, indices, solidVoxels, faceCount: indices.length / 6 };
}
