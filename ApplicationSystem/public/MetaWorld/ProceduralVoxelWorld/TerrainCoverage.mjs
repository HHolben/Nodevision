// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/TerrainCoverage.mjs
// This shared authoring guard respects geographic valid-data coverage and finite map composition. It allows explicit procedural composition only for authored maps, never for missing geographic elevation samples.
export function terrainPointCovered(runtime,x,z) {
  const source=runtime.definition?.terrainSource;
  if(!['geographic','map','hybrid'].includes(source))return true;
  const sample=runtime.sampleTerrainSource(x,z);
  if(sample.pending)return false;
  return sample.covered||source!=='geographic'&&runtime.definition.terrainMap?.outside==='procedural';
}
