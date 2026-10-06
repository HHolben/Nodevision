// Nodevision/ApplicationSystem/public/MetaWorld/Materials/WorldObjectMaterialResolver.mjs
// This module resolves canonical catalog entries into shared visual and physical metadata without introducing object-family-specific material definitions.
import { loadWorldObjectMaterialCatalog, materialFileForWorldObjectMaterial, normalizeWorldObjectMaterialId,
  readWorldObjectMatterState } from './WorldObjectMaterialDefaults.mjs';
export async function resolveWorldObjectMaterial(id, options = {}) {
  const materialId = normalizeWorldObjectMaterialId(id);
  const catalog = options.catalog || await loadWorldObjectMaterialCatalog(options);
  const entry = catalog.find(item => item.materialId.toLowerCase() === materialId.toLowerCase());
  let definition = entry?.materialDefinition;
  const materialFile = entry?.materialFile || materialFileForWorldObjectMaterial(materialId);
  if (!definition) {
    const response = await (options.fetch || globalThis.fetch)(materialFile);
    if (!response.ok) throw new Error(`Cannot resolve Nodevision material ${materialId}: ${response.status}`);
    definition = await response.json();
  }
  const rendering = definition.rendering || {}, collider = definition.collider || {};
  return { materialId: definition.id || materialId, materialFile, materialDefinition: definition,
    physicsMaterialId: definition.id || materialId, matterState: readWorldObjectMatterState(definition), collider,
    rendering: { ...rendering, color: rendering.color || definition.defaultColor || entry?.color || '#888888' } };
}
