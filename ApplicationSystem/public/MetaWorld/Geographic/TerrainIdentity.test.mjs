// Nodevision/ApplicationSystem/public/MetaWorld/Geographic/TerrainIdentity.test.mjs
// These regressions verify geographic source identity, exact voxel-height quantization, crop coverage, and recoverable source diagnostics. They use real GeoTIFF decoding and the production crop pipeline without filesystem persistence or remote resources.

import test from 'node:test';
import assert from 'node:assert/strict';
import { fromArrayBuffer } from '../../vendor/geographic/reader.mjs';
import { rasterFixture } from './Fixtures.mjs';
import { rasterMetadata } from './RasterMetadata.mjs';
import { importCrop } from './WindowImport.mjs';
import { finishRecipe } from './RecipeV2.mjs';
import { createGeographicTerrain } from './Terrain.mjs';
import { geographicSourceStatus } from './SourceStatus.mjs';
import { voxelWorldForm, definitionFromVoxelForm } from '../ProceduralVoxelWorld/VoxelAuthoringDefinition.mjs';
import { validateVoxelWorld } from '../ProceduralVoxelWorld/VoxelWorldDefinition.mjs';
import { terrainSourceSummary, terrainRuntimeStatus } from '../ProceduralVoxelWorld/TerrainSourceSummary.mjs';

async function recipe(options = {}) {
  const image = await (await fromArrayBuffer(rasterFixture({ features: true, ...options }))).getImage();
  const source = { image, asset: async () => ({ path: '/Notebook/features.tif', sha256: 'a'.repeat(64) }), stats: () => ({}) };
  const settings = { crop: rasterMetadata(image).bounds, fitCoverage: true, horizontalScale: .25, verticalExaggeration: .5, verticalOffset: -39 };
  return finishRecipe(await importCrop(source, settings), settings);
}
const definition = geographic => validateVoxelWorld(definitionFromVoxelForm({
  ...voxelWorldForm(), seed: '42', terrainSource: 'geographic', geographic, vegetation: false,
}));

// Flat DEM elevations stay flat across adjacent samples and chunk boundaries.
test('bilinear roundoff does not lower plateau ground by one voxel', async () => {
  const def = definition(await recipe()), terrain = createGeographicTerrain(def);
  for (let z = 10; z < 60; z++) {
    for (let x = 10; x < 60; x++) assert.equal(terrain.getTerrainHeight(x, z), 84);
  }
  assert.equal(terrain.terrainSampler.kind, 'geographic');
  assert.deepEqual(terrain.terrainSampler.resolution, [2.5, 2.5]);
});

test('the shared terrain sampler respects crop holes and invalid coordinates', async () => {
  const def = definition(await recipe());
  def.geographic.effectiveRaster[0].push([[2, 2], [5, 2], [5, 5], [2, 5], [2, 2]]);
  const terrain = createGeographicTerrain(def);
  assert.equal(terrain.getTerrainHeight(30, 30), 0);
  assert.deepEqual(terrain.terrainSampler.sample(7.625, 7.625), { covered: false, elevation: null, biome: null, material: null });
  assert.equal(terrain.terrainSampler.covers(NaN, 0), false);
  assert.equal(terrain.terrainSampler.covers(-1, 0), false);
});

// Source modes and their inspector descriptions survive compact definition round trips.
test('geographic source identity survives editing and serialization', async () => {
  const def = definition(await recipe());
  const restored = definitionFromVoxelForm(voxelWorldForm(JSON.parse(JSON.stringify(def))), def);
  assert.equal(restored.terrainSource, 'geographic');
  assert.deepEqual(restored.geographic, def.geographic);
  assert.match(terrainSourceSummary(restored), /Source: Geographic DEM/);
  assert.match(terrainSourceSummary(restored), /File: \/Notebook\/features.tif/);
  assert.match(terrainSourceSummary(restored), /Auxiliary seed: 42/);
  assert.doesNotMatch(terrainSourceSummary(restored), /Source: Procedural/);
  const procedural = definitionFromVoxelForm({ ...voxelWorldForm(restored), terrainSource: 'procedural' }, restored);
  assert.equal(procedural.geographic, undefined);
  assert.match(terrainSourceSummary(procedural), /Source: Procedural. Seed: 42/);
});

test('invalid geographic input never becomes procedural terrain', async () => {
  assert.throws(() => definitionFromVoxelForm({ ...voxelWorldForm(), terrainSource: 'geographic' }), /Import and preview/);
  await assert.rejects(recipe({ noData: true }), /NoData/);
  const def = JSON.parse(JSON.stringify(definition(await recipe())));
  def.geographic.elevation.samples = 'invalid';
  assert.throws(() => validateVoxelWorld(def));
});

// Availability checks consume no raster body and never replace cached terrain.
test('missing source produces an actionable diagnostic with unchanged cached heights', async t => {
  const def = definition(await recipe()), before = JSON.stringify(def);
  let cancelled = false;
  t.mock.method(globalThis, 'fetch', async (path, options) => {
    assert.equal(path, '/Notebook/features.tif');
    assert.equal(options.headers.Range, 'bytes=0-0');
    return { ok: false, status: 404, body: { cancel: async () => { cancelled = true; } } };
  });
  const status = geographicSourceStatus(def.geographic);
  await status.ready;
  assert.ok(cancelled);
  assert.match(status.message, /unavailable \(404\)/);
  assert.match(status.message, /Restore the source/);
  assert.match(status.message, /procedural terrain was not substituted/);
  assert.equal(JSON.stringify(def), before);
  assert.equal(createGeographicTerrain(def).getTerrainHeight(30, 30), 84);
  status.dispose();
});

// A successful source check must not conceal a renderer initialization failure.
test('geographic source status supplements material errors', () => {
  const message = terrainRuntimeStatus({
    geographicStatus: { message: 'Source available' },
    materialError: Error('Missing material'), stats: { loaded: 0, queued: 0 },
  }, {});
  assert.match(message, /Source available/);
  assert.match(message, /Material loading failed: Missing material/);
});

test('uncovered land cover is reported as the default biome', async () => {
  const def = definition(await recipe());
  def.geographic.landcoverSource = { path: '/Notebook/elsewhere.tif' };
  delete def.geographic.geographicOrigin;
  const summary = terrainSourceSummary(def);
  assert.match(summary, /Biome source: default temperate/);
  assert.match(summary, /land-cover source has no overlap/);
  assert.match(summary, /projected origin:/);
});
