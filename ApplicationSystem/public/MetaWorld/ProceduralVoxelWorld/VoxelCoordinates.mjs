// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelCoordinates.mjs
// This module owns conversions between meters, voxel cells, chunks, and local chunk cells using floor division.

export const VOXEL_SIZE = 0.25;
export const CHUNK_SIZE = 32;
export const chunkKey = cell => cell.join(",");
export const voxelToChunk = cell => cell.map(n => Math.floor(n / CHUNK_SIZE));
export const voxelToLocal = cell => cell.map(n => ((n % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE);
export const chunkToVoxel = cell => cell.map(n => n * CHUNK_SIZE);
export const chunkLocalToVoxel = (chunk, local) => chunkToVoxel(chunk).map((n, i) => n + local[i]);
export const worldToVoxel = (point, origin) => point.map((n, i) => Math.floor((n - origin[i]) / VOXEL_SIZE));
export const voxelToWorld = (cell, origin) => cell.map((n, i) => origin[i] + n * VOXEL_SIZE);
export const voxelDimensions = (size, infinite = false) => Object.defineProperty(size.map(n => n / VOXEL_SIZE), 'infinite', {value:infinite});
export const containsHorizontal = (x,z,d) => Number.isFinite(x) && Number.isFinite(z) && (d.infinite || x>=0 && z>=0 && x<d[0] && z<d[2]);
export const horizontalRange = (center,radius,length,infinite=false) => [infinite?center-radius:Math.max(0,center-radius),infinite?center+radius:Math.min(length-1,center+radius)];
export const containsVoxel = (cell, dimensions) => cell.every(Number.isSafeInteger) && cell[1]>=0 && cell[1]<dimensions[1] && containsHorizontal(cell[0],cell[2],dimensions);
export const voxelIndex = (x, y, z) => x + CHUNK_SIZE * (z + CHUNK_SIZE * y);
