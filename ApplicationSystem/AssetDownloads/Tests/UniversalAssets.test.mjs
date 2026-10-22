// Nodevision/ApplicationSystem/AssetDownloads/Tests/UniversalAssets.test.mjs
// Verifies document-relative destinations and persistent, deduplicated attribution across supported file operations.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { projectAssetDestination } from '../ProjectAssetDestination.mjs';
import { downloadAsset } from '../DownloadAsset.mjs';
import { recordAssetAttribution, readAssetAttributions } from '../AssetAttributionStore.mjs';
import { syncAttributionFileOperation } from '../AttributionFileOperations.mjs';
const bytes = Buffer.from('89504e470d0a1a0a00000000', 'hex');
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nv-universal-asset-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const ctx = { notebookDir: path.join(root, 'Notebook'), userDataDir: path.join(root, 'UserData'), userSettingsDir: path.join(root, 'Settings') };
  for (const folder of Object.values(ctx)) await fs.mkdir(folder, { recursive: true });
  await fs.mkdir(path.join(ctx.notebookDir, 'Project'));
  await fs.writeFile(path.join(ctx.notebookDir, 'Project/index.html'), '<p>Unchanged</p>');
  const provider = { downloadHosts: ['dl.polyhaven.org'], inspect: async () => ({ id: 'Rock_01', name: 'Rock', provider: 'test', creator: '',
    source: 'https://polyhaven.com/a/Rock_01', license: 'CC0-1.0', licenseVerified: true, attributionRequired: false,
    formats: [{ id: '1k/png', extension: 'png', size: bytes.length, url: 'https://dl.polyhaven.org/rock.png' }] }) };
  const request = { authorized: true, provider: 'test', asset: 'Rock_01', format: '1k/png', destination: 'notebook-project', subdirectory: 'assets/images', document: 'Project/index.html' };
  return { ctx, provider, request, fetchImpl: async () => new Response(bytes) };
}
test('project recommendations prefer existing conventions for HTML, SVG and PHP', async t => {
  const f = await fixture(t);
  assert.equal((await projectAssetDestination(f.ctx, 'Project/index.html')).subdirectory, 'assets/images');
  assert.equal((await projectAssetDestination(f.ctx, 'Project/picture.svg')).subdirectory, 'assets');
  await fs.mkdir(path.join(f.ctx.notebookDir, 'Project/img'));
  assert.equal((await projectAssetDestination(f.ctx, 'Project/index.html')).subdirectory, 'img');
  await fs.mkdir(path.join(f.ctx.notebookDir, 'Project/public/images'), { recursive: true });
  assert.equal((await projectAssetDestination(f.ctx, 'Project/index.php')).subdirectory, 'public/images');
  await assert.rejects(projectAssetDestination(f.ctx, '../secret.html'));
});
test('project download and manifest leave source document unchanged and retain unknown creator', async t => {
  const f = await fixture(t); const result = await downloadAsset(f.ctx, f.request, f);
  assert(result.path.startsWith('Notebook/Project/assets/images/'));
  const credits = await recordAssetAttribution(f.ctx, { authorized: true, download: result, document: f.request.document, referenced: false });
  assert.equal(credits.manifest.assets.length, 1);
  assert.equal(credits.manifest.assets[0].creator, '');
  assert.deepEqual(credits.manifest.assets[0].documents, []);
  assert.equal(await fs.readFile(path.join(f.ctx.notebookDir, f.request.document), 'utf8'), '<p>Unchanged</p>');
});
test('duplicate downloads share one stable attribution identity and deduplicate document references', async t => {
  const f = await fixture(t);
  const first = await downloadAsset(f.ctx, f.request, f), second = await downloadAsset(f.ctx, f.request, f);
  for (const download of [first, second, first]) await recordAssetAttribution(f.ctx, { authorized: true, download, document: f.request.document, referenced: true });
  const { manifest, text } = await readAssetAttributions(f.ctx, f.request.document);
  assert.equal(manifest.assets.length, 1); assert.equal(manifest.assets[0].localPaths.length, 2);
  assert.deepEqual(manifest.assets[0].documents, ['Notebook/Project/index.html']); assert.match(text, /Rock.*CC0-1.0/);
});
test('file move retains sidecar and remaps credits; deletion marks missing assets', async t => {
  const f = await fixture(t); const download = await downloadAsset(f.ctx, f.request, f);
  await recordAssetAttribution(f.ctx, { authorized: true, download, document: f.request.document, referenced: true });
  const oldPath = download.path.slice(9), newPath = 'Project/assets/images/renamed.png';
  await fs.rename(path.join(f.ctx.notebookDir, oldPath), path.join(f.ctx.notebookDir, newPath));
  assert.deepEqual((await syncAttributionFileOperation(f.ctx, oldPath, newPath)).warnings, []);
  assert((await fs.stat(path.join(f.ctx.notebookDir, newPath + '.source.json'))).isFile());
  let credits = await readAssetAttributions(f.ctx, f.request.document);
  assert.deepEqual(credits.manifest.assets[0].localPaths, ['Notebook/' + newPath]);
  await fs.unlink(path.join(f.ctx.notebookDir, newPath)); await syncAttributionFileOperation(f.ctx, newPath);
  credits = await readAssetAttributions(f.ctx, f.request.document);
  assert.deepEqual(credits.manifest.assets[0].missingPaths, ['Notebook/' + newPath]);
});
test('moving a project remaps contained manifests, asset paths and document paths', async t => {
  const f = await fixture(t); const download = await downloadAsset(f.ctx, f.request, f);
  await recordAssetAttribution(f.ctx, { authorized: true, download, document: f.request.document, referenced: true });
  await fs.rename(path.join(f.ctx.notebookDir, 'Project'), path.join(f.ctx.notebookDir, 'Renamed'));
  assert.deepEqual((await syncAttributionFileOperation(f.ctx, 'Project', 'Renamed')).warnings, []);
  const credits = await readAssetAttributions(f.ctx, 'Renamed/index.html');
  assert(credits.manifest.assets[0].localPaths[0].startsWith('Notebook/Renamed/'));
  assert.deepEqual(credits.manifest.assets[0].documents, ['Notebook/Renamed/index.html']);
});
test('manifest writes require authorization and preserve unrelated malformed files', async t => {
  const f = await fixture(t); const download = await downloadAsset(f.ctx, f.request, f);
  await assert.rejects(recordAssetAttribution(f.ctx, { download, document: f.request.document }), /authorization/);
  const file = path.join(f.ctx.notebookDir, 'Project/AssetAttributions.json');
  await fs.writeFile(file, '{"unrelated":true}');
  await assert.rejects(recordAssetAttribution(f.ctx, { authorized: true, download, document: f.request.document }), /Unrecognized/);
  assert.equal(await fs.readFile(file, 'utf8'), '{"unrelated":true}');
});
test('root-level documents and traversal attempts remain bounded', async t => {
  const f = await fixture(t);
  const result = await downloadAsset(f.ctx, { ...f.request, document: 'index.html', subdirectory: '' }, f);
  assert(!result.path.includes('/./')); assert(!result.path.includes('//'));
  await assert.rejects(downloadAsset(f.ctx, { ...f.request, subdirectory: '../escape' }, f));
});
