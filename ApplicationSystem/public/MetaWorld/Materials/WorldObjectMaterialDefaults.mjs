// Nodevision/ApplicationSystem/public/MetaWorld/Materials/WorldObjectMaterialDefaults.mjs
// This module exposes canonical world material identities and catalog loading through the existing public API.

export { WORLD_OBJECT_MATERIAL_LIBRARY_PATH, WORLD_OBJECT_MATERIAL_CATALOG_PATH, DEFAULT_WORLD_OBJECT_MATERIAL_ID, DEFAULT_WORLD_OBJECT_MATERIAL_FILE, DEFAULT_WORLD_GAS_MATERIAL_ID, DEFAULT_WORLD_GAS_MATERIAL_FILE } from './MaterialCatalogRows.mjs';
export { normalizeWorldObjectMaterialId, materialFileForWorldObjectMaterial, normalizeWorldObjectMatterState, readWorldObjectMatterState, isLiquidWorldObjectMaterial, readWorldObjectPhysicsMaterialId, applyDefaultWorldObjectPhysicsMaterial } from './MaterialIdentity.mjs';
export { parseWorldObjectMaterialCsv } from './MaterialCatalogCsv.mjs';
export { loadWorldObjectMaterialCatalog } from './MaterialCatalogLoader.mjs';
