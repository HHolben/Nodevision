// Nodevision/ApplicationSystem/AssetDownloads/ProjectAssetDestination.mjs
// Recommends project-local folders from shallow existing conventions without replacing configured resource sources.
import fs from 'node:fs/promises';
import path from 'node:path';
import { normalizePortableRelativePath, resolveResourceSourceDirectory } from '../Resources/ResourcePathSafety.mjs';
export function normalizeAssetDocument(value) {
  const document = normalizePortableRelativePath(String(value || '').replace(/^\/?Notebook\//, ''), 'Document path');
  if (!/\.(html?|svg|php|png|jpe?g|gltf|glb)$/i.test(document)) throw new Error('Unsupported asset document');
  return document;
}
export async function projectAssetDestination(ctx, document) {
  const documentPath = normalizeAssetDocument(document);
  const directory = path.posix.dirname(documentPath);
  const extension = path.posix.extname(documentPath).toLowerCase();
  const candidates = extension === '.php' ? ['public/assets/images', 'public/images', 'public/img', 'assets/images', 'images', 'img', 'assets']
    : ['assets/images', 'images', 'img', 'assets', 'Assets'];
  let subdirectory = extension === '.svg' ? 'assets' : 'assets/images';
  for (const candidate of candidates) {
    try {
      const source = { sourceType: 'notebook', path: path.posix.join(directory, candidate) };
      const resolved = await resolveResourceSourceDirectory(ctx, source);
      if ((await fs.stat(resolved.absoluteDirectory)).isDirectory()) { subdirectory = candidate; break; }
    } catch { /* Missing or unauthorized candidates are not recommendations. */ }
  }
  if (extension === '.php' && subdirectory === 'assets/images') {
    try { if ((await fs.stat(path.join(ctx.notebookDir, directory, 'public'))).isDirectory()) subdirectory = 'public/assets/images'; } catch { /* No public convention. */ }
  }
  return { id: 'notebook-project', name: 'Originating document project', path: directory === '.' ? '' : directory,
    type: 'project', subdirectory, documentPath, source: { id: 'notebook-project', sourceType: 'notebook', path: directory, typeId: 'image' } };
}
