// Nodevision/ApplicationSystem/public/MetaWorld/TerrainLOD/Settings.mjs
// This module validates optional streaming preferences without adding defaults to legacy saved documents. Runtime budgets remain bounded independently of geographic extent.
export function terrainStreaming(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Terrain streaming settings must be an object.');
  const number = (key, fallback, min, max) => {
    const n = value[key] ?? fallback;
    if (!Number.isFinite(n) || n < min || n > max) throw Error(`${key} must be between ${min} and ${max}.`);
    return n;
  };
  for (const key of ['enabled', 'predictive', 'vegetationEnabled']) if (value[key] !== undefined && typeof value[key] !== 'boolean') throw Error(`${key} must be a boolean.`);
  return { enabled: value.enabled ?? true, predictive: value.predictive ?? true,
    visibilityDistance: number('visibilityDistance', 512, 64, 2048),
    vegetationEnabled: value.vegetationEnabled ?? true, vegetationDistance: number('vegetationDistance', 160, 32, 512),
    coarseBudgetMiB: number('coarseBudgetMiB', 32, 4, 64) };
}
