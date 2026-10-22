// Nodevision/scripts/test-added-asset-providers-live.mjs
// Opt-in search/inspection check (optional temporary download) of the additional providers' documented search and inspection endpoints.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { downloadAsset } from '../ApplicationSystem/AssetDownloads/DownloadAsset.mjs';
import { getAssetProvider } from '../ApplicationSystem/AssetDownloads/ProviderRegistry.mjs';
let failed = false;
for (const id of (process.argv.includes('--nasa') ? ['nasa'] : ['wikimedia', 'metmuseum'])) {
  try {
    const provider = getAssetProvider(id); const signal = AbortSignal.timeout(60000);
    const result = await provider.search({ query: id === 'nasa' ? 'moon' : 'sunflower' }, signal);
    if (!result.items.length) throw Error('No eligible images on first page; try another query.');
    const asset = await provider.inspect(result.items[0].id, signal);
    if (!asset.formats.length) throw Error('No downloadable original returned.');
    if (process.argv.includes('--download')) {
      const root = await fs.mkdtemp(path.join(os.tmpdir(), 'nv-provider-live-'));
      try {
        const ctx = { notebookDir: path.join(root, 'Notebook'), userDataDir: path.join(root, 'UserData'), userSettingsDir: path.join(root, 'Settings') };
        await fs.mkdir(ctx.notebookDir);
        const saved = await downloadAsset(ctx, { authorized: true, provider: id, asset: asset.id, format: asset.formats[0].id, destination: 'notebook-project', document: 'index.html' }, { provider, signal });
        if (saved.bytes !== asset.formats[0].size) throw Error('Downloaded size mismatch');
        console.log(`${id}: validated ${saved.bytes} bytes and provenance; temporary fixture removed`);
      } finally { await fs.rm(root, { recursive: true, force: true }); }
    }
    console.log(JSON.stringify({ provider: id, results: result.items.length, id: asset.id, license: asset.license, format: asset.formats[0].extension, bytes: asset.formats[0].size }));
  } catch (error) { failed = true; console.error(`${id}: ${error.message}`); }
}
process.exitCode = failed ? 1 : 0;
