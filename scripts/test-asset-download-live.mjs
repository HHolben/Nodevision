// Nodevision/scripts/test-asset-download-live.mjs
// Opt-in Poly Haven smoke test downloads one small original asset into an isolated temporary Notebook and removes it afterward.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { getAssetProvider } from '../ApplicationSystem/AssetDownloads/ProviderRegistry.mjs';
import { listDownloadDestinations } from '../ApplicationSystem/AssetDownloads/DownloadDestinations.mjs';
import { downloadAsset } from '../ApplicationSystem/AssetDownloads/DownloadAsset.mjs';
const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nv-polyhaven-live-'));
try {
  const ctx = { notebookDir: path.join(root, 'Notebook'), userDataDir: path.join(root, 'UserData'), userSettingsDir: path.join(root, 'UserSettings') };
  for (const dir of Object.values(ctx)) await fs.mkdir(dir, { recursive: true });
  const signal = AbortSignal.timeout(90000); const provider = getAssetProvider('polyhaven');
  const results = await provider.search({ query: 'aerial rocks', category: 'textures' }, signal);
  assert(results.items.length > 0);
  const asset = await provider.inspect('aerial_rocks_01', signal);
  const format = asset.formats.find(item => item.extension === 'jpg' && item.size < 2000000);
  assert(format, 'A small supported original JPEG is available');
  const destination = (await listDownloadDestinations(ctx)).find(item => item.type === 'image' && item.source.sourceType === 'notebook');
  const result = await downloadAsset(ctx, { authorized: true, provider: 'polyhaven', asset: asset.id, format: format.id, destination: destination.id }, { signal });
  const absolute = path.join(ctx.notebookDir, result.path.replace(/^Notebook\//, ''));
  assert.equal((await fs.stat(absolute)).size, format.size);
  assert.equal(JSON.parse(await fs.readFile(`${absolute}.source.json`)).license, 'CC0-1.0');
  console.log(`PASS: real search, inspection, ${format.size}-byte ${format.extension} download, checksum/signature validation and provenance sidecar`);
} finally { await fs.rm(root, { recursive: true, force: true }); }
