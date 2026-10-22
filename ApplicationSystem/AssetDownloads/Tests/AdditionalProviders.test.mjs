// Nodevision/ApplicationSystem/AssetDownloads/Tests/AdditionalProviders.test.mjs
// Covers additional providers, per-file licenses, bounded discovery, missing records and the shared download path.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createWikimediaProvider, normalizeCommonsAsset } from '../WikimediaProvider.mjs';
import { createMetMuseumProvider, normalizeMetAsset } from '../MetMuseumProvider.mjs';
import { providerFetch, providerJson, MAX_ASSET_BYTES } from '../ProviderNetwork.mjs';
import { listAssetProviders } from '../ProviderRegistry.mjs';
import { downloadAsset } from '../DownloadAsset.mjs';
const bytes = Buffer.from('ffd8ffe000000000', 'hex');
const commons = () => ({ pageid: 42, ns: 6, index: 1, title: 'File:Landscape.jpg', imageinfo: [{
  mime: 'image/jpeg', url: 'https://upload.wikimedia.org/wikipedia/commons/a/a1/Landscape.jpg', size: bytes.length,
  thumburl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Landscape.jpg/256px-Landscape.jpg',
  extmetadata: { Artist: { value: '<a href="https://example.org">Artist &amp; Co</a>' }, LicenseUrl: { value: '//creativecommons.org/licenses/by-sa/4.0/' }, LicenseShortName: { value: 'CC BY-SA 4.0' }, Credit: { value: '<b>Original credit</b>' } },
}] });
const met = () => ({ objectID: 7, title: 'Painting', isPublicDomain: true, artistDisplayName: 'Painter', primaryImage: 'https://images.metmuseum.org/CRDImages/ep/original/Painting.jpg', primaryImageSmall: 'https://images.metmuseum.org/CRDImages/ep/web-large/Painting.jpg', creditLine: 'Museum collection' });
test('registry adds two sources without replacing Poly Haven', () => {
  assert.deepEqual(listAssetProviders().map(item => item.id), ['polyhaven', 'wikimedia', 'metmuseum', 'nasa']);
});
test('Commons preserves creator, credit and per-file ShareAlike licensing as plain text', () => {
  const asset = normalizeCommonsAsset(commons());
  assert.equal(asset.creator, 'Artist & Co'); assert.equal(asset.license, 'CC-BY-SA-4.0');
  assert.equal(asset.licenseVerified, true); assert.equal(asset.attributionRequired, true);
  assert.match(asset.requiredAttribution, /Original credit/); assert.equal(asset.formats[0].size, bytes.length);
});
test('Commons distinguishes unknown, CC0 and explicitly public-domain metadata', () => {
  const raw = commons(); raw.imageinfo[0].extmetadata = {};
  assert.equal(normalizeCommonsAsset(raw).licenseVerified, false);
  raw.imageinfo[0].extmetadata.LicenseUrl = { value: 'https://creativecommons.org/publicdomain/zero/1.0/' };
  assert.equal(normalizeCommonsAsset(raw).license, 'CC0-1.0');
  raw.imageinfo[0].extmetadata = { Copyrighted: { value: 'False' }, LicenseShortName: { value: 'Public domain' } };
  assert.equal(normalizeCommonsAsset(raw).license, 'Public domain');
});
test('Commons rejects hostile hosts, unsupported SVG and oversized originals', () => {
  for (const patch of [{ url: 'https://upload.wikimedia.org.evil.test/x.jpg' }, { mime: 'image/svg+xml' }, { size: MAX_ASSET_BYTES + 1 }, { url: 'http://upload.wikimedia.org/a.jpg' }]) {
    const raw = commons(); Object.assign(raw.imageinfo[0], patch); assert.equal(normalizeCommonsAsset(raw).formats.length, 0);
  }
});
test('Commons search uses bounded pages, caches catalogs and filters actual file licenses/formats', async () => {
  const calls = []; const provider = createWikimediaProvider(async (url, signal, hosts) => {
    calls.push(new URL(url)); assert.deepEqual(hosts, ['commons.wikimedia.org']);
    return { query: { pages: [commons()] }, continue: { gsroffset: 12 } };
  });
  const options = { query: 'landscape', license: 'CC-BY-SA-4.0', format: 'jpg' };
  assert.equal((await provider.search(options)).items.length, 1); assert.equal((await provider.search(options)).next, 12);
  assert.equal(calls.length, 1); assert.equal(calls[0].searchParams.get('gsrlimit'), '12');
  assert.equal((await provider.search({ ...options, format: 'png' })).items.length, 0);
  assert.equal((await provider.search({ category: 'models' })).items.length, 0);
  await assert.rejects(provider.inspect('../42'), /Invalid asset ID/);
});
test('Commons inspection handles missing/deleted files and provider query errors', async () => {
  await assert.rejects(createWikimediaProvider(async () => ({ query: { pages: [{ pageid: 42, missing: true }] } })).inspect('42'), /no longer available/);
  await assert.rejects(createWikimediaProvider(async () => ({ error: { info: 'Rate limited' } })).search(), /Rate limited/);
});
test('Met includes only explicitly public-domain images on its own image host', () => {
  assert.equal(normalizeMetAsset(met()).license, 'CC0-1.0');
  for (const patch of [{ isPublicDomain: false }, { primaryImage: '' }, { primaryImage: 'https://evil.test/file.jpg' }]) {
    const asset = normalizeMetAsset({ ...met(), ...patch }); assert.equal(asset.original, ''); assert.equal(asset.licenseVerified, false);
  }
});
test('Met uses new paginated search, skips 404 records and does not probe image files during search', async () => {
  const calls = []; let probes = 0;
  const provider = createMetMuseumProvider(async url => {
    calls.push(url);
    if (url.includes('/v1.1/search')) return { total: 20, objectIDs: [7, 8, 9] };
    if (url.endsWith('/8')) throw Object.assign(Error('Missing'), { status: 404 });
    return url.endsWith('/9') ? { ...met(), objectID: 9, isPublicDomain: false } : met();
  }, async () => { probes++; return bytes.length; });
  const result = await provider.search({ query: 'painting' }); assert.equal(result.items.length, 1); assert.equal(result.next, 12); assert.equal(probes, 0);
  assert.match(calls[0], /offset=0&limit=12/); assert.equal((await provider.inspect('7')).formats[0].size, bytes.length); assert.equal(probes, 1);
  await assert.rejects(provider.inspect('7/../8'), /Invalid asset ID/);
});
test('Met propagates unavailable service and cancellation instead of hiding them as empty results', async () => {
  const provider = createMetMuseumProvider(async url => { if (url.includes('search')) return { objectIDs: [7], total: 1 }; throw Object.assign(Error('Unavailable'), { status: 503 }); });
  await assert.rejects(provider.search(), /Unavailable/);
  const controller = new AbortController(); controller.abort(); await assert.rejects(provider.search({}, controller.signal), /abort/i);
});
test('HEAD probes preserve host/redirect boundaries and HTTP status', async () => {
  let method = '';
  await providerFetch('https://images.metmuseum.org/a.jpg', ['images.metmuseum.org'], { method: 'HEAD', fetchImpl: async (url, options) => { method = options.method; return new Response(null); } });
  assert.equal(method, 'HEAD');
  await assert.rejects(providerFetch('https://images.metmuseum.org/a.jpg', ['images.metmuseum.org'], { fetchImpl: async () => new Response(null, { status: 302, headers: { location: 'https://evil.test/file' } }) }), /Untrusted/);
  await assert.rejects(providerFetch('https://images.metmuseum.org/a.jpg', ['images.metmuseum.org'], { fetchImpl: async () => new Response(null, { status: 404 }) }), error => error.status === 404);
  await assert.rejects(providerJson('https://evil.test/api', null, ['commons.wikimedia.org']), /Untrusted/);
});
test('both sources use the existing validated downloader and provenance sidecars', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nv-extra-providers-')); t.after(() => fs.rm(root, { recursive: true, force: true }));
  const ctx = { notebookDir: path.join(root, 'Notebook'), userDataDir: path.join(root, 'UserData'), userSettingsDir: path.join(root, 'Settings') };
  await fs.mkdir(ctx.notebookDir, { recursive: true });
  const providers = [createWikimediaProvider(async () => ({ query: { pages: [commons()] } })), createMetMuseumProvider(async () => met(), async () => bytes.length)];
  for (const provider of providers) {
    const result = await downloadAsset(ctx, { authorized: true, provider: provider.id, asset: provider.id === 'wikimedia' ? '42' : '7', format: 'original', destination: 'notebook-project', document: 'index.html' }, { provider, fetchImpl: async () => new Response(bytes) });
    const file = path.join(root, result.path); assert.deepEqual(await fs.readFile(file), bytes);
    const sidecar = JSON.parse(await fs.readFile(file + '.source.json', 'utf8')); assert.equal(sidecar.provider, provider.id); assert(sidecar.creator); assert(sidecar.stableId);
  }
});
