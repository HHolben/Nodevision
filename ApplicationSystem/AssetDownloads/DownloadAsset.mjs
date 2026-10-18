// Nodevision/ApplicationSystem/AssetDownloads/DownloadAsset.mjs
// Streams validated original assets into exclusive resource files with provenance sidecars and rollback on failure.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { getAssetProvider } from './ProviderRegistry.mjs';
import { providerFetch, MAX_ASSET_BYTES } from './ProviderNetwork.mjs';
import { resourceUrlForFile } from '../Resources/ResourcePathSafety.mjs';
import { resolveDownloadDestination, destinationDisplayPath } from './DownloadDestinations.mjs';
import { validateAssetSignature } from './DownloadValidation.mjs';
export async function downloadAsset(ctx, request, { signal, progress = () => {}, provider = getAssetProvider(request.provider), fetchImpl } = {}) {
  if (request.authorized !== true) throw new Error('Explicit download authorization required');
  signal?.throwIfAborted();
  const asset = await provider.inspect(request.asset, signal);
  const format = asset.formats.find(item => item.id === request.format);
  if (!format || !['png', 'jpg', 'hdr', 'exr', 'glb'].includes(format.extension)) throw new Error('Unsupported asset format');
  if (!Number.isSafeInteger(format.size) || format.size <= 0 || format.size > MAX_ASSET_BYTES) throw new Error('Asset exceeds the download size limit');
  const destination = await resolveDownloadDestination(ctx, request.destination, request.subdirectory, request.document);
  if (destination.type !== 'project' && (format.extension === 'glb') !== (destination.type === 'model')) throw new Error('Choose a matching image/material or model destination');
  const response = await providerFetch(format.url, provider.downloadHosts || [], { signal, fetchImpl });
  const advertised = Number(response.headers.get('content-length'));
  if (advertised > MAX_ASSET_BYTES || (advertised && advertised !== format.size)) { await response.body?.cancel(); throw new Error('Unexpected download size'); }
  const temporary = path.join(destination.directory, `.asset-download-${randomUUID()}.part`);
  let file = null; let installed = ''; let metadataPath = ''; let metadataCreated = false;
  try {
    await fs.mkdir(destination.directory, { recursive: true });
    await resolveDownloadDestination(ctx, request.destination, request.subdirectory, request.document);
    file = await fs.open(temporary, 'wx', 0o600);
    const hash = createHash('md5'); const sha = createHash('sha256');
    let size = 0; let signature = Buffer.alloc(0); let lastProgress = 0;
    for await (const chunk of response.body) {
      signal?.throwIfAborted();
      size += chunk.length;
      if (size > MAX_ASSET_BYTES || size > format.size) throw new Error('Download exceeded expected size');
      if (signature.length < 16) signature = Buffer.concat([signature, chunk]).subarray(0, 16);
      hash.update(chunk); sha.update(chunk); await file.writeFile(chunk);
      if (Date.now() - lastProgress > 100) { progress({ received: size, total: format.size }); lastProgress = Date.now(); }
    }
    signal?.throwIfAborted();
    if (size !== format.size) throw new Error('Incomplete download');
    validateAssetSignature(signature, format.extension);
    if (format.extension === 'glb' && signature.readUInt32LE(8) !== size) throw new Error('Invalid GLB length');
    if (format.md5 && hash.digest('hex') !== format.md5) throw new Error('Provider checksum mismatch');
    await file.sync(); await file.close(); file = null;
    const base = `${asset.id}-${format.id}`.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 150);
    for (let suffix = 0; suffix < 1000; suffix++) {
      signal?.throwIfAborted();
      const filename = `${base}${suffix ? `-${suffix}` : ''}.${format.extension}`;
      const target = path.join(destination.directory, filename);
      metadataPath = `${target}.source.json`;
      // Reserve provenance first; exclusive hard-link publication cannot overwrite an existing asset.
      try { await fs.writeFile(metadataPath, JSON.stringify({ version: 1, ...asset, stableId: createHash('sha256').update(`${asset.provider}:${asset.id}:${format.id}`).digest('hex'), modificationStatus: 'original', formats: undefined, downloadedAt: new Date().toISOString(), format, sha256: sha.copy().digest('hex'), bytes: size }, null, 2), { flag: 'wx', mode: 0o600 }); metadataCreated = true; }
      catch (error) { if (error.code === 'EEXIST') continue; throw error; }
      try { await fs.link(temporary, target); installed = target; }
      catch (error) { await fs.unlink(metadataPath); metadataCreated = false; if (error.code === 'EEXIST') continue; throw error; }
      signal?.throwIfAborted();
      const localPath = destinationDisplayPath(destination, filename);
      const url = destination.source.sourceType === 'notebook' ? '/' + localPath.split('/').map(encodeURIComponent).join('/')
        : resourceUrlForFile(destination.source, [request.subdirectory, filename].filter(Boolean).join('/'));
      const result = { name: asset.name, path: localPath, url, bytes: size, license: asset.license, filename,
        destination: request.destination, subdirectory: request.subdirectory || '', document: request.document || '', extension: format.extension };
      progress({ received: size, total: size });
      return result;
    }
    throw new Error('Too many duplicate downloads');
  } catch (error) {
    if (installed) await fs.unlink(installed).catch(() => {});
    if (metadataCreated) await fs.unlink(metadataPath).catch(() => {});
    throw error;
  } finally {
    await file?.close().catch(() => {}); await fs.unlink(temporary).catch(() => {});
    await response.body?.cancel().catch(() => {});
  }
}
