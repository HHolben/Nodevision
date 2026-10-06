// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelMaterialPalette.mjs
// This module maps compact development-generator palette indices to canonical material identities and pools resolved rendering resources per terrain runtime.
import { resolveWorldObjectMaterial } from '../Materials/WorldObjectMaterialResolver.mjs';
import { createTerrainMaterial } from '../../PanelInstances/ViewPanels/GameViewDependencies/TerrainTool/terrainMaterial.mjs';
import { VOXEL_MATERIAL_IDS } from "./VoxelMaterialIds.mjs";
export async function createVoxelMaterialPalette(THREE, options = {}) {
  const entries = [null, ...await Promise.all(VOXEL_MATERIAL_IDS.slice(1).map(id => resolveWorldObjectMaterial(id, options)))];
  const materials = entries.slice(1).map(entry => {
    const settings = entry.rendering;
    const material = createTerrainMaterial(THREE, { ...settings, kind: settings.terrainKind,
      isLiquid: entry.matterState === 'liquid' });
    for (const key of ['roughness', 'metalness', 'emissiveIntensity']) {
      if (Number.isFinite(settings[key]) && key in material) material[key] = settings[key];
    }
    if (settings.emissive && material.emissive) material.emissive.set(settings.emissive);
    material.userData = { ...material.userData, materialId: entry.materialId, physicsMaterialId: entry.physicsMaterialId,
      materialFile: entry.materialFile, MatterState: entry.matterState };
    return material;
  });
  return { entries, materials, dispose() { for (const material of materials) { material.map?.dispose(); material.dispose(); } } };
}
