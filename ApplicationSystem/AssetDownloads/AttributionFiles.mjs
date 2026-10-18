// Nodevision/ApplicationSystem/AssetDownloads/AttributionFiles.mjs
// Serializes bounded provenance JSON updates and rejects symlinks before atomic publication.
import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
const queues = new Map();
export async function readAttributionJson(file, fallback = null) {
  try {
    const stat = await fs.lstat(file);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 4 * 1024 * 1024) throw new Error('Invalid attribution file');
    return JSON.parse(await fs.readFile(file, 'utf8'));
  } catch (error) { if (error.code === 'ENOENT' && fallback !== null) return fallback; throw error; }
}
export async function updateAttributionJson(file, update, initial = {}) {
  const previous = queues.get(file) || Promise.resolve();
  const task = previous.catch(() => {}).then(async () => {
    const data = await readAttributionJson(file, initial);
    const next = await update(data);
    const temporary = path.join(path.dirname(file), `.attribution-${randomUUID()}.tmp`);
    try {
      await fs.writeFile(temporary, JSON.stringify(next, null, 2), { flag: 'wx', mode: 0o600 });
      await fs.rename(temporary, file);
    } finally { await fs.unlink(temporary).catch(() => {}); }
    return next;
  });
  queues.set(file, task);
  try { return await task; } finally { if (queues.get(file) === task) queues.delete(file); }
}
