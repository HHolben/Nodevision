// Nodevision/ApplicationSystem/AssetDownloads/DownloadDestinations.mjs
// Resolves downloads through enabled Notebook and managed sources in the existing resource registry.
import fs from 'node:fs/promises';
import path from 'node:path';
import { projectAssetDestination } from './ProjectAssetDestination.mjs';
import { listResourceTypes } from '../Resources/ResourceSettingsStore.mjs';
import { getContextRoot, normalizePortableRelativePath, resolveResourceSourceDirectory } from '../Resources/ResourcePathSafety.mjs';
export async function listDownloadDestinations(ctx, document = '') {
  const types = await listResourceTypes(ctx);
  const destinations = types.filter(type => ['image', 'model'].includes(type.id)).flatMap(type => type.sources
    .filter(source => source.enabled && ['notebook', 'managed'].includes(source.sourceType))
    .map(source => ({ id: `${type.id}:${source.id}`, name: `${source.sourceType === 'notebook' ? 'Notebook' : 'Shared managed library'} — ${source.name}`, path: source.path, source, type: type.id })));
  if (document) destinations.unshift(await projectAssetDestination(ctx, document));
  return destinations;
}
export async function resolveDownloadDestination(ctx, id, subdirectory = '', document = '') {
  const destination = (await listDownloadDestinations(ctx, document)).find(item => item.id === id);
  if (!destination) throw new Error('Destination is unavailable or disabled');
  const relative = normalizePortableRelativePath(subdirectory, 'Download subfolder', { allowEmpty: true });
  const source = { ...destination.source, path: path.posix.join(destination.path, relative) };
  const resolved = source.path === '.' ? { absoluteDirectory: path.resolve(ctx.notebookDir) } : await resolveResourceSourceDirectory(ctx, source);
  // Refuse symlink components even within an authorized root. Never follow a user-created link on write.
  const root = getContextRoot(ctx, source.sourceType);
  let cursor = root;
  for (const part of path.relative(root, resolved.absoluteDirectory).split(path.sep).filter(Boolean)) {
    cursor = path.join(cursor, part);
    try { const stat = await fs.lstat(cursor); if (stat.isSymbolicLink() || !stat.isDirectory()) throw new Error('Destination contains a symlink or non-directory'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return { ...destination, directory: resolved.absoluteDirectory, relativePath: source.path };
}
export function destinationDisplayPath(destination, filename) {
  return `${destination.source.sourceType === 'notebook' ? 'Notebook' : 'UserData'}/${destination.relativePath}/${filename}`;
}
