// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelMaterialTestFixtures.mjs
// This test helper serves actual canonical material files to the shared catalog loader without requiring network access.
import { readFile } from 'node:fs/promises';
import { loadWorldObjectMaterialCatalog } from '../Materials/WorldObjectMaterialDefaults.mjs';
export async function materialFetch(url) {
  if (url === '/api/resource-paths/resources/material') return { ok: true, json: async () => ({ resources: [] }) };
  try {
    const content = await readFile(new URL('../..' + url, import.meta.url), 'utf8');
    return { ok: true, text: async () => content, json: async () => JSON.parse(content) };
  } catch { return { ok: false, status: 404 }; }
}
export const canonicalCatalog = await loadWorldObjectMaterialCatalog({ fetch: materialFetch });
export const voxelMaterialOptions = { catalog: canonicalCatalog, fetch: materialFetch };
export const terrainDefinition = { id: 'terrain', type: 'procedural-voxel-world', position: [0,0,0], size: [1000,128,1000], voxelSize: .25,
  generator: { id: 'nodevision-terrain-v1', version: 1, seed: 123456 }, chunks: { voxelsPerAxis: 32, loadRadius: 1 } };
