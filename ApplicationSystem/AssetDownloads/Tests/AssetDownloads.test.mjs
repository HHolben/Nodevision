// Nodevision/ApplicationSystem/AssetDownloads/Tests/AssetDownloads.test.mjs
// Exercises provider normalization, layered destinations, validation, cancellation, and exclusive persistence.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { createPolyHavenProvider, normalizeAsset, normalizeFiles } from '../PolyHavenProvider.mjs';
import { listDownloadDestinations, resolveDownloadDestination } from '../DownloadDestinations.mjs';
import { downloadAsset } from '../DownloadAsset.mjs';
import { providerFetch, validateProviderUrl } from '../ProviderNetwork.mjs';
import { validateAssetSignature } from '../DownloadValidation.mjs';
import { saveResourceTypeSources, getResourceTypeSettings } from '../../Resources/ResourceSettingsStore.mjs';
const bytes = Buffer.from('89504e470d0a1a0a00000000', 'hex');
const format = { id: 'Diffuse/1k/png', extension: 'png', size: bytes.length, url: 'https://dl.polyhaven.org/file/test.png', md5: createHash('md5').update(bytes).digest('hex') };
const asset = { id: 'test', name: 'Test', provider: 'polyhaven', creator: 'Artist', license: 'CC0-1.0', formats: [format] };
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nv-download-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const ctx = { notebookDir: path.join(root, 'Notebook'), userDataDir: path.join(root, 'UserData'), userSettingsDir: path.join(root, 'UserSettings'), publicDir: path.join(root, 'public') };
  for (const dir of Object.values(ctx)) await fs.mkdir(dir, { recursive: true });
  const destinations = await listDownloadDestinations(ctx);
  const destination = destinations.find(item => item.type === 'image' && item.source.sourceType === 'notebook');
  return { ctx, destinations, request: { authorized: true, provider: 'polyhaven', asset: 'test', format: format.id, destination: destination.id }, provider: { downloadHosts: ['dl.polyhaven.org'], inspect: async () => asset }, fetchImpl: async () => new Response(bytes) };
}
test('provider metadata distinguishes categories and preserves creator/license', () => {
  const item = normalizeAsset('rock', { name: 'Rock', type: 1, tags: ['terrain'], authors: { Artist: 'All' } });
  assert.deepEqual(item.categories, ['textures', 'terrain']); assert.equal(item.creator, 'Artist'); assert.equal(item.license, 'CC0-1.0');
});
test('formats exclude archives, dependencies, unknown types, oversized files and foreign hosts', () => {
  const tree = { a: { png: format, zip: { ...format, url: 'https://dl.polyhaven.org/x.zip' }, bad: { ...format, url: 'https://evil.invalid/x.png' }, large: { ...format, size: 1e10 } } };
  assert.equal(normalizeFiles(tree).length, 1);
});
test('search filters, pagination, inspection and cache use documented endpoints', async () => {
  const calls = []; const provider = createPolyHavenProvider(async url => {
    calls.push(url);
    if (url.endsWith('/assets')) return Object.fromEntries(Array.from({ length: 15 }, (_, i) => [`rock_${i}`, { type: 1, name: 'Rock' }]));
    if (url.includes('/files/')) return { texture: { png: format } };
    return { type: 1, name: 'Rock' };
  });
  assert.equal((await provider.search({ query: 'rock', category: 'textures' })).next, 12);
  assert.equal((await provider.search({ offset: 12 })).items.length, 3);
  assert.equal(calls.filter(url => url.endsWith('/assets')).length, 1);
  assert.equal((await provider.search({ category: 'voxels' })).items.length, 0);
  assert.equal((await provider.search({ offset: 12, format: 'png' })).items.length, 3);
  await assert.rejects(provider.inspect('../secret'), /Invalid/);
});
test('provider URLs reject credentials, HTTP, alternate ports and hostile redirects', async () => {
  for (const url of ['http://dl.polyhaven.org/a', 'https://u:p@dl.polyhaven.org/a', 'https://dl.polyhaven.org:444/a', 'https://dl.polyhaven.org.evil/a']) assert.throws(() => validateProviderUrl(url, ['dl.polyhaven.org']));
  let calls = 0;
  await assert.rejects(providerFetch(format.url, ['dl.polyhaven.org'], { fetchImpl: async () => { calls++; return new Response(null, { status: 302, headers: { location: 'https://127.0.0.1/private' } }); } }), /Untrusted/);
  assert.equal(calls, 1);
});
test('destinations follow enabled registry settings and exclude application code directories', async t => {
  const { ctx, destinations, request } = await fixture(t);
  assert(destinations.some(item => item.source.sourceType === 'managed'));
  assert(!destinations.some(item => item.source.sourceType === 'application'));
  const settings = await getResourceTypeSettings(ctx, 'image');
  await saveResourceTypeSources(ctx, 'image', settings.sources.map(item => ({ ...item, enabled: false })));
  await assert.rejects(resolveDownloadDestination(ctx, request.destination), /unavailable/);
});
test('destination rejects traversal, absolute paths, and symlinks', async t => {
  const { ctx, request } = await fixture(t);
  for (const input of ['../escape', '/tmp/escape', 'C:/escape', '..\\escape']) await assert.rejects(resolveDownloadDestination(ctx, request.destination, input));
  const destination = await resolveDownloadDestination(ctx, request.destination);
  await fs.mkdir(destination.directory, { recursive: true });
  await fs.symlink(os.tmpdir(), path.join(destination.directory, 'outside'));
  await assert.rejects(resolveDownloadDestination(ctx, request.destination, 'outside/evil'));
});
test('download preserves bytes, sidecar, progress and duplicates in Notebook', async t => {
  const f = await fixture(t); const updates = [];
  const first = await downloadAsset(f.ctx, f.request, { ...f, progress: value => updates.push(value) });
  const second = await downloadAsset(f.ctx, f.request, f);
  assert.notEqual(first.path, second.path); assert.equal(updates.at(-1).received, bytes.length);
  const target = path.join(f.ctx.notebookDir, first.path.replace(/^Notebook\//, ''));
  assert.deepEqual(await fs.readFile(target), bytes);
  const metadata = JSON.parse(await fs.readFile(`${target}.source.json`));
  assert.equal(metadata.license, 'CC0-1.0'); assert.equal(metadata.creator, 'Artist'); assert.equal(metadata.sha256.length, 64);
});
test('download uses existing managed library and custom Notebook source paths', async t => {
  const f = await fixture(t);
  const managed = f.destinations.find(item => item.type === 'image' && item.source.sourceType === 'managed');
  const saved = await downloadAsset(f.ctx, { ...f.request, destination: managed.id, subdirectory: 'Landscapes' }, f);
  assert(saved.path.startsWith(`UserData/${managed.path}/Landscapes/`));
  const settings = await getResourceTypeSettings(f.ctx, 'image');
  await saveResourceTypeSources(f.ctx, 'image', settings.sources.map(item => item.sourceType === 'notebook' ? { ...item, path: 'CustomAssets' } : item));
  const custom = await downloadAsset(f.ctx, f.request, f); assert(custom.path.startsWith('Notebook/CustomAssets/'));
});
test('writes require explicit authorization and matching supported format/destination', async t => {
  const f = await fixture(t);
  await assert.rejects(downloadAsset(f.ctx, { ...f.request, authorized: false }, f), /authorization/);
  await assert.rejects(downloadAsset(f.ctx, { ...f.request, format: 'zip' }, f), /Unsupported/);
  const model = f.destinations.find(item => item.type === 'model');
  await assert.rejects(downloadAsset(f.ctx, { ...f.request, destination: model.id }, f), /matching/);
});
for (const [name, content, altered] of [
  ['wrong signature', Buffer.alloc(bytes.length), { md5: '' }], ['truncated stream', bytes.subarray(0, 8), {}],
  ['oversized stream', Buffer.concat([bytes, bytes]), {}], ['checksum mismatch', bytes, { md5: '0'.repeat(32) }],
]) test(`${name} leaves no partial asset or metadata`, async t => {
  const f = await fixture(t);
  await assert.rejects(downloadAsset(f.ctx, f.request, { provider: { downloadHosts: ['dl.polyhaven.org'], inspect: async () => ({ ...asset, formats: [{ ...format, ...altered }] }) }, fetchImpl: async () => new Response(content) }));
  const destination = await resolveDownloadDestination(f.ctx, f.request.destination);
  assert.deepEqual(await fs.readdir(destination.directory), []);
});
test('cancellation rolls back temporary files', async t => {
  const f = await fixture(t); const controller = new AbortController();
  await assert.rejects(downloadAsset(f.ctx, f.request, { ...f, signal: controller.signal, progress: () => controller.abort() }), { name: 'AbortError' });
  const destination = await resolveDownloadDestination(f.ctx, f.request.destination);
  assert.deepEqual(await fs.readdir(destination.directory), []);
});
test('offline failure creates no files', async t => {
  const f = await fixture(t);
  await assert.rejects(downloadAsset(f.ctx, f.request, { ...f, fetchImpl: async () => { throw new Error('Offline'); } }), /Offline/);
  assert.deepEqual(await fs.readdir(f.ctx.notebookDir), []);
});
test('only supported standalone signatures pass', () => {
  validateAssetSignature(Buffer.from('#?RADIANCE\n'), 'hdr');
  validateAssetSignature(Buffer.from([118, 47, 49, 1]), 'exr');
  validateAssetSignature(Buffer.from([255, 216, 255]), 'jpg');
  assert.throws(() => validateAssetSignature(Buffer.from('<script>'), 'png'));
  assert.throws(() => validateAssetSignature(Buffer.from('PK'), 'zip'));
});
