// Nodevision/ApplicationSystem/AssetDownloads/AttributionFileOperations.mjs
// Updates known project manifests and provenance sidecars after supported Notebook file operations without scanning other projects.
import fs from 'node:fs/promises';
import path from 'node:path';
import { normalizePortableRelativePath, resolveResourceSourceDirectory } from '../Resources/ResourcePathSafety.mjs';
import { readAttributionJson, updateAttributionJson } from './AttributionFiles.mjs';
async function safeFile(ctx, relative) {
  const name = normalizePortableRelativePath(relative, 'Attribution path');
  const directory = path.posix.dirname(name);
  if (directory !== '.') await resolveResourceSourceDirectory(ctx, { sourceType: 'notebook', path: directory });
  return path.join(ctx.notebookDir, name);
}
export async function syncAttributionFileOperation(ctx, oldValue, newValue = '') {
  const warnings = [];
  try {
    const oldPath = normalizePortableRelativePath(String(oldValue).replace(/^\/?Notebook\//, ''), 'Original path');
    const newPath = newValue ? normalizePortableRelativePath(String(newValue).replace(/^\/?Notebook\//, ''), 'New path') : '';
    const remap = value => value === oldPath || value.startsWith(oldPath + '/') ? (newPath ? newPath + value.slice(oldPath.length) : value) : value;
    const manifests = new Set(); const sidecars = [];
    for (const base of [oldPath, newPath].filter(Boolean)) {
      let directory = path.posix.dirname(base);
      while (true) { manifests.add(path.posix.join(directory, 'AssetAttributions.json')); if (directory === '.') break; directory = path.posix.dirname(directory); }
    }
    const oldSidecar = await safeFile(ctx, `${oldPath}.source.json`);
    const metadata = await readAttributionJson(oldSidecar, {}).catch(() => ({}));
    if (metadata.stableId) {
      if (newPath) {
        const next = await safeFile(ctx, `${newPath}.source.json`);
        try { await fs.link(oldSidecar, next); await fs.unlink(oldSidecar); sidecars.push(next); }
        catch (error) { warnings.push(`Asset moved, but provenance sidecar was not moved: ${error.message}`); sidecars.push(oldSidecar); }
      } else sidecars.push(oldSidecar);
      for (const manifest of metadata.manifests || []) manifests.add(remap(manifest));
    }
    // A directory move already carries its sidecars. Visit only that moved subtree.
    if (newPath) {
      const target = await safeFile(ctx, newPath);
      if ((await fs.lstat(target)).isDirectory()) {
        async function visit(directory) {
          for (const item of await fs.readdir(directory, { withFileTypes: true })) {
            if (item.isSymbolicLink()) continue;
            const file = path.join(directory, item.name);
            if (item.isDirectory()) await visit(file);
            else if (item.name === 'AssetAttributions.json') manifests.add(path.relative(ctx.notebookDir, file).split(path.sep).join('/'));
            else if (item.name.endsWith('.source.json')) sidecars.push(file);
          }
        }
        await visit(target);
      }
    }
    for (const file of sidecars) {
      await updateAttributionJson(file, data => {
        for (const manifest of data.manifests || []) manifests.add(remap(manifest));
        return { ...data, manifests: (data.manifests || []).map(remap) };
      });
    }
    const remapStored = value => value.startsWith('Notebook/') ? 'Notebook/' + remap(value.slice(9)) : value;
    const affected = value => value === `Notebook/${oldPath}` || value.startsWith(`Notebook/${oldPath}/`);
    for (const relative of manifests) {
      try {
        const file = await safeFile(ctx, relative);
        const data = await readAttributionJson(file, {});
        if (data.version !== 1 || !Array.isArray(data.assets)) continue;
        await updateAttributionJson(file, current => {
          for (const record of current.assets) {
            if (newPath) {
              record.localPaths = (record.localPaths || []).map(remapStored); record.documents = (record.documents || []).map(remapStored);
              record.missingPaths = (record.missingPaths || []).map(remapStored);
            } else {
              record.missingPaths = [...new Set([...(record.missingPaths || []), ...(record.localPaths || []).filter(affected)])];
              record.removedDocuments = [...new Set([...(record.removedDocuments || []), ...(record.documents || []).filter(affected)])];
              record.documents = (record.documents || []).filter(value => !affected(value));
            }
          }
          return current;
        });
      } catch (error) { warnings.push(`Credits update failed: ${error.message}`); }
    }
  } catch (error) { warnings.push(`Credits update failed: ${error.message}`); }
  return { warnings };
}
