// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/WorldExtent.mjs
// This module validates explicit extent declarations without migrating legacy finite documents. Map-based sources can never request infinite extent, while procedural infinity retains finite vertical settings and bounded active residency.
export function pureProceduralWorld(def) {
  return (def.terrainSource ?? 'procedural') === 'procedural' && !def.geographic && !def.terrainMap;
}
export function validateWorldExtent(def) {
  const extent = def.worldExtent;
  if (extent === undefined) return 'finite';
  if (!extent || typeof extent !== 'object' || Array.isArray(extent) || !['finite', 'infinite'].includes(extent.mode)) {
    throw Error('World extent must declare mode "finite" or "infinite".');
  }
  if (extent.mode === 'infinite') {
    if (!pureProceduralWorld(def)) {
      throw Error('Infinite world extent is permitted only for purely procedural terrain. Geographic, authored-map, and hybrid worlds require finite source-defined coverage.');
    }
  }
  return extent.mode;
}
export const infiniteWorld = def => pureProceduralWorld(def) && def.worldExtent?.mode === 'infinite';
export function validateExtentTransition(previous, next) {
  validateWorldExtent(next);
  if (infiniteWorld(previous) && !infiniteWorld(next)) throw Error('Converting infinite terrain to finite terrain is disabled to protect authored content outside finite boundaries.');
}
export function worldExtentDescription(def) {
  if (infiniteWorld(def)) return 'World extent: Infinite. Procedural terrain generates as you explore.';
  if (pureProceduralWorld(def)) return 'World extent: Finite, using the configured horizontal dimensions.';
  if (def.terrainSource === 'geographic') return 'World extent: Source-defined and finite. Geographic crop boundaries and valid-data coverage apply; missing elevations are never synthesized.';
  return 'World extent: Source-defined and finite. Configured map coverage and composition rules apply within the finite terrain bounds.';
}
