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
export const voxelDimensions = size => size.map(n => n / VOXEL_SIZE);
export const containsVoxel = (cell, dimensions) => cell.every((n, i) => Number.isInteger(n) && n >= 0 && n < dimensions[i]);
export const voxelIndex = (x, y, z) => x + CHUNK_SIZE * (z + CHUNK_SIZE * y);
