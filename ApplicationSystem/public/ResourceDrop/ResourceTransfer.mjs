// Notebook resource identity extends the existing file-transfer helper; no disk import is performed.
import { getRelativeNotebookReference, toNotebookAssetUrl } from '../utils/notebookPath.mjs';
export const RESOURCE_MIME = 'application/x-nodevision-resource+json';
let active = null;
export function resourcePath(value) {
  let path = String(value ?? '').replace(/\\/g, '/');
  if (/^\/?Notebook\//i.test(path)) path = path.replace(/^\/?Notebook\//i, '');
  if (!path || path.startsWith('/') || /^[a-z][a-z\d+.-]*:/i.test(path) || /[\u0000-\u001f]/.test(path) || path.split('/').some(part => !part || part === '.' || part === '..')) throw Error('Use an existing file inside the Notebook.');
  return path;
}
export function makeResourcePayload({ path, isDirectory = false, sourcePanel = 'file-manager', entries = null } = {}) {
  const resources = (entries || [{ path, isDirectory }]).map(entry => ({ path: resourcePath(entry.path), isDirectory: !!entry.isDirectory }));
  return { type: 'nodevision-resource', version: 1, sourcePanel, resources };
}
export function readResourcePayload(payload) {
  if (!payload || payload.type !== 'nodevision-resource' || payload.version !== 1 || !Array.isArray(payload.resources)) throw Error('Invalid resource drag.');
  if (payload.resources.length !== 1) throw Error('Drop one resource at a time.');
  const entry = payload.resources[0];
  if (entry.isDirectory) throw Error('Folders cannot be inserted as file references.');
  const path = resourcePath(entry.path);
  return { path, id: 'Notebook/' + path, url: toNotebookAssetUrl(path), name: path.split('/').at(-1), extension: path.split('.').at(-1).toLowerCase(), sourcePanel: payload.sourcePanel };
}
export function writeResourceTransfer(event, options) {
  const payload = makeResourcePayload(options);
  event.dataTransfer.setData(RESOURCE_MIME, JSON.stringify(payload));
  active = payload;
  return payload;
}
export function clearResourceDrag() { active = null; }
export function beginResourceDrag(payload) { readResourcePayload(payload); active = payload; return () => { if (active === payload) active = null; }; }
export function isResourceTransfer(transfer) { return Array.from(transfer?.types || []).includes(RESOURCE_MIME); }
export function resourceFromTransfer(transfer, { hover = false } = {}) {
  const raw = transfer?.getData(RESOURCE_MIME);
  return readResourcePayload(raw ? JSON.parse(raw) : hover ? active : null);
}
// Encode raw file identities before the existing resolver decodes them. This preserves literal %, # and ? in filenames.
const encodeIdentity = path => resourcePath(path).split('/').map(encodeURIComponent).join('/');
export function resourceReference(documentPath, targetPath) {
  if (!documentPath || /^(?:untitled|__|virtual:)/i.test(documentPath)) throw Error('Save this document in the Notebook before linking resources. Use Insert → Media for import options.');
  return getRelativeNotebookReference({ sourcePath: encodeIdentity(documentPath), targetPath: encodeIdentity(targetPath) });
}
