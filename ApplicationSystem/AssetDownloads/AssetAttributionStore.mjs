// Nodevision/ApplicationSystem/AssetDownloads/AssetAttributionStore.mjs
// Maintains project credits from verified download sidecars without rewriting editor documents.
import fs from 'node:fs/promises';
import path from 'node:path';
import { resolveDownloadDestination, destinationDisplayPath } from './DownloadDestinations.mjs';
import { normalizeAssetDocument } from './ProjectAssetDestination.mjs';
import { resolveResourceSourceDirectory } from '../Resources/ResourcePathSafety.mjs';
import { readAttributionJson, updateAttributionJson } from './AttributionFiles.mjs';
export async function manifestPathForDocument(ctx, document) {
  const relative = normalizeAssetDocument(document);
  const directory = path.posix.dirname(relative);
  const resolved = directory === '.' ? { absoluteDirectory: path.resolve(ctx.notebookDir) }
    : await resolveResourceSourceDirectory(ctx, { sourceType: 'notebook', path: directory });
  if (!(await fs.stat(resolved.absoluteDirectory)).isDirectory()) throw new Error('Document project directory does not exist');
  return path.join(resolved.absoluteDirectory, 'AssetAttributions.json');
}
export function attributionText(asset) {
  const title = asset.name || asset.title || 'Untitled asset';
  const author = asset.creator ? ` by ${asset.creator}` : '';
  const license = asset.license || 'unknown license';
  return [asset.requiredAttribution || `${title}${author} — ${license}`, asset.source || '', asset.licenseUrl || '',
    asset.modificationStatus && asset.modificationStatus !== 'original' ? `Modifications: ${asset.modificationStatus}` : ''].filter(Boolean).join(' · ');
}
export async function recordAssetAttribution(ctx, request) {
  if (request.authorized !== true) throw new Error('Explicit attribution authorization required');
  const { download, document, referenced = false } = request;
  if (!download || !/^[a-zA-Z0-9_.-]+$/.test(download.filename || '')) throw new Error('Invalid downloaded asset filename');
  const destination = await resolveDownloadDestination(ctx, download.destination, download.subdirectory, download.document);
  const file = path.join(destination.directory, download.filename);
  const stat = await fs.lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('Downloaded asset is unavailable');
  const sidecar = `${file}.source.json`;
  const metadata = await readAttributionJson(sidecar);
  if (!/^[a-f0-9]{64}$/.test(metadata.stableId || '')) throw new Error('Missing stable provenance identity');
  const manifestFile = await manifestPathForDocument(ctx, document);
  const localPath = destinationDisplayPath(destination, download.filename);
  const documentPath = `Notebook/${normalizeAssetDocument(document)}`;
  const manifest = await updateAttributionJson(manifestFile, data => {
    if (data.version !== 1 || !Array.isArray(data.assets)) throw new Error('Unrecognized attribution manifest; existing content was preserved');
    const record = data.assets.find(item => item.id === metadata.stableId) || { id: metadata.stableId, localPaths: [], documents: [] };
    if (!data.assets.includes(record)) data.assets.push(record);
    Object.assign(record, { title: metadata.name, creator: metadata.creator || '', source: metadata.source || '',
      provider: metadata.provider, originalDownloadUrl: metadata.format?.url || '', license: metadata.license || 'unknown',
      licenseUrl: metadata.licenseUrl || '', licenseVerified: metadata.licenseVerified === true,
      attributionRequired: metadata.attributionRequired ?? null, attributionRecommended: metadata.attributionRecommended === true,
      attributionText: attributionText(metadata), modificationStatus: metadata.modificationStatus || 'unknown', downloadedAt: metadata.downloadedAt });
    record.localPaths = [...new Set([...record.localPaths, localPath])];
    if (referenced) record.documents = [...new Set([...record.documents, documentPath])];
    record.missingPaths = (record.missingPaths || []).filter(item => item !== localPath);
    data.updatedAt = new Date().toISOString(); return data;
  }, { version: 1, assets: [] });
  const relativeManifest = path.relative(ctx.notebookDir, manifestFile).split(path.sep).join('/');
  await updateAttributionJson(sidecar, data => ({ ...data, manifests: [...new Set([...(data.manifests || []), relativeManifest])] }));
  return { path: `Notebook/${relativeManifest}`, manifest, text: manifest.assets.map(item => item.attributionText).join('\n\n') };
}
export async function readAssetAttributions(ctx, document) {
  const file = await manifestPathForDocument(ctx, document);
  const manifest = await readAttributionJson(file, { version: 1, assets: [] });
  if (!Array.isArray(manifest.assets)) throw new Error('Unrecognized attribution manifest');
  return { manifest, text: manifest.assets.map(item => item.attributionText).join('\n\n') };
}
