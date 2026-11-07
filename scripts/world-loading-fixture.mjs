// Nodevision/scripts/world-loading-fixture.mjs
// Generates a portable HTML world with a large real encoded elevation cache for the viewer-loading regression without depending on private Notebook content.
import { packRaster } from '../ApplicationSystem/public/MetaWorld/Geographic/Snapshot.mjs';

export function worldLoadingFixture() {
  const width = 224, height = 290;
  const values = new Float64Array(width * height).fill(1100);
  // This finite elevation produces consecutive slashes in its Base64 encoding.
  values[6700] = 1100.9999999999998;
  const origin = [675000, 4362000], size = [56, 32, 72.5];
  const rectangle = [[[ [0, 0], [56, 0], [56, 72.5], [0, 72.5], [0, 0] ]]];
  const elevation = packRaster({ width, height, crs: 32634, origin, sourceOrigin: origin,
    resolution: [.25, -.25], offset: .5, window: [0, 0, width, height],
    asset: { path: '/Notebook/offline-dem.tif', sha256: 'a'.repeat(64) } }, values);
  if (!elevation.samples.includes('//')) throw Error('Fixture must exercise Base64 comment markers');
  const geographic = { version: 2, projection: 'EPSG:32634', origin, size,
    horizontalScale: 1, verticalExaggeration: 1, verticalOffset: -1099,
    defaultBiome: 'temperate', mapping: {}, regions: [], detail: false, effective: rectangle, effectiveRaster: rectangle,
    range: { min: 1100, max: 1101 }, elevation, landcover: null };
  const world = { name: 'Large cached world', type: 'world', metadata: {}, objects: [
    { id: 'keep-box', type: 'box', position: [0, 4, 0], rotation: [0, 0, 0], color: '#888888', isSolid: false, size: [1, 1, 1] },
    { id: 'voxel-world', type: 'procedural-voxel-world', terrainSource: 'geographic', geographic,
      breakable: false, isSolid: true, visible: true, hidden: false, position: [0, 0, 0], size, voxelSize: .25, generator: { id: 'nodevision-terrain-v1', version: 1, seed: 42 },
      chunks: { voxelsPerAxis: 32, loadRadius: 1 }, generation: { vegetation: false, water: false, caves: false } },
  ] };
  return `<!doctype html><html><body><p>Keep authored HTML.</p><script id="nodevision-metaworld" type="application/json">\n${JSON.stringify(world, null, 2)}\n</script></body></html>`;
}
