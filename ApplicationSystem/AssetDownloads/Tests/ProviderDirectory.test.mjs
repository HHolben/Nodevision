// Nodevision/ApplicationSystem/AssetDownloads/Tests/ProviderDirectory.test.mjs
// Verifies proposed-source capability boundaries and NASA's bounded, rights-aware image adapter.
import test from 'node:test';
import assert from 'node:assert/strict';
import { listProviderDirectory, listAssetProviders, getAssetProvider, assetProviders } from '../ProviderRegistry.mjs';
import { PROVIDER_FEATURES } from '../ProviderDirectory.mjs';
import { createNasaProvider, normalizeNasaAsset } from '../NasaProvider.mjs';
const item = { data: [{ nasa_id: 'Moon_01', title: 'Moon', media_type: 'image', description: '<b>A lunar image</b>', photographer: 'Photographer', center: 'JSC' }], links: [{ rel: 'preview', href: 'https://images-assets.nasa.gov/image/Moon_01/Moon_01~thumb.jpg' }] };
const original = 'https://images-assets.nasa.gov/image/Moon_01/Moon_01~orig.jpg';
test('all 21 proposed sources and the existing Met integration have stable unique IDs', () => {
  const directory = listProviderDirectory(); assert.equal(directory.filter(row => row.proposed).length, 21);
  assert.equal(directory.length, 22); assert.equal(new Set(directory.map(row => row.id)).size, 22);
  assert(directory.some(row => row.id === 'metmuseum' && row.status === 'available'));
  assert(directory.every(row => PROVIDER_FEATURES.every(feature => typeof row.support[feature] === 'boolean')));
});
test('planned integrations advertise no working features and cannot be invoked', () => {
  for (const row of listProviderDirectory().filter(row => row.status === 'planned')) {
    assert(Object.values(row.support).every(value => value === false)); assert.deepEqual(row.formats, []);
    assert(!listAssetProviders().some(provider => provider.id === row.id));
    for (const operation of ['search', 'inspect', 'download']) assert.throws(() => getAssetProvider(row.id, operation), /not integrated/);
  }
});
test('partial adapters expose only implemented operations and never serialize credentials', t => {
  assetProviders.set('openverse', { name: 'Openverse', formats: [], secret: 'not-for-clients', search() {}, capabilities: { download: false } });
  t.after(() => assetProviders.delete('openverse'));
  const row = listProviderDirectory().find(row => row.id === 'openverse'); assert.equal(row.support.search, true); assert.equal(row.support.download, false);
  assert.equal(typeof getAssetProvider('openverse', 'search').search, 'function');
  assert.throws(() => getAssetProvider('openverse', 'inspect'), /does not support/);
  assert.throws(() => getAssetProvider('openverse', 'download'), /does not support/);
  assert(!JSON.stringify([listAssetProviders(), listProviderDirectory()]).includes('not-for-clients'));
});
test('unconfigured authenticated adapters are visible but cannot search or expose credentials', t => {
  assetProviders.set('freesound', { formats: ['wav'], authentication: { configured: false, label: 'Server API credentials required', secret: 'private-key' }, search() {} });
  t.after(() => assetProviders.delete('freesound'));
  assert.equal(listProviderDirectory().find(row => row.id === 'freesound').status, 'needs-configuration');
  assert(!listAssetProviders().some(row => row.id === 'freesound'));
  assert.throws(() => getAssetProvider('freesound', 'search'), /configuration/);
  assert(!JSON.stringify(listProviderDirectory()).includes('private-key'));
});
test('NASA preserves credits but never assumes every image has a CC0 license', () => {
  const asset = normalizeNasaAsset(item); assert.equal(asset.licenseVerified, false); assert.equal(asset.attributionRequired, true);
  assert.match(asset.requiredAttribution, /NASA.*Photographer/); assert.equal(asset.description, 'A lunar image');
  assert.match(asset.licenseUrl, /^https:\/\/www.nasa.gov/);
});
test('NASA search pages are bounded and do not fetch originals without a format filter', async () => {
  const calls = []; const provider = createNasaProvider(async (url, signal, hosts) => {
    calls.push(new URL(url)); assert.deepEqual(hosts, ['images-api.nasa.gov']);
    return { collection: { items: [item], metadata: { total_hits: 25 } } };
  }, async () => { throw Error('Unexpected original request'); });
  const result = await provider.search({ query: 'moon', offset: 12 }); assert.equal(result.items.length, 1); assert.equal(result.next, 24);
  assert.equal(calls[0].searchParams.get('page'), '2'); assert.equal(calls[0].searchParams.get('page_size'), '12');
  await provider.search({ query: 'moon', offset: 12 }); assert.equal(calls.length, 1);
  assert.equal((await provider.search({ category: 'models' })).items.length, 0);
});
test('NASA inspection accepts original raster files only and uses fixed image hosts', async () => {
  const probed = []; const provider = createNasaProvider(async url => url.includes('/asset/') ? { collection: { items: [original.replace('https:', 'http:'), original, original.replace('~orig.jpg', '~thumb.jpg'), 'https://evil.test/x~orig.jpg', original.replace('.jpg', '.tif')].map(href => ({ href })) } } : { collection: { items: [item] } }, async (url, hosts) => { probed.push(url); assert.deepEqual(hosts, ['images-assets.nasa.gov']); return 123; });
  const asset = await provider.inspect('Moon_01'); assert.equal(asset.formats.length, 1); assert.equal(asset.formats[0].extension, 'jpg'); assert.deepEqual(probed, [original]);
  await assert.rejects(provider.inspect('../bad'), /Invalid/);
  await assert.rejects(provider.inspect('Other_01'), /no longer available/);
});
test('NASA unsupported manifests stay inspection-only and cancellation propagates', async () => {
  const provider = createNasaProvider(async url => url.includes('/asset/') ? { collection: { items: [] } } : { collection: { items: [item] } });
  assert.deepEqual((await provider.inspect('Moon_01')).formats, []);
  const controller = new AbortController(); controller.abort(); await assert.rejects(provider.search({}, controller.signal), /abort/i);
});
