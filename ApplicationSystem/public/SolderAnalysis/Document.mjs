// Versioned editable sidecar; the original JPEG bytes are embedded without recompression.
import { contoursFor } from './Measurement.mjs';
export const colors = { total: '#FF0000', void: '#80DFFF' };
export function reportFilename(name) {
  if (!/\.jpe?g$/i.test(name)) throw Error('Select a .jpg or .jpeg image');
  return name.replace(/\.jpe?g$/i, '.html');
}
export function serializeAnalysis(state) { return JSON.stringify({ ...state, format: 'nodevision-solder-analysis', version: 1 }, null, 2); }
export function parseAnalysis(text) {
  const state = JSON.parse(text);
  if (state.format !== 'nodevision-solder-analysis' || state.version !== 1) throw Error('Unsupported analysis document');
  reportFilename(state.source?.name || '');
  if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(state.source.dataUrl || '') || !Number.isInteger(state.width) || !Number.isInteger(state.height) || state.width < 1 || state.height < 1) throw Error('Invalid source image');
  if (!Array.isArray(state.regions) || !Array.isArray(state.layers)) throw Error('Invalid annotations');
  const ids = new Set();
  for (const r of state.regions) {
    if (!r.id || typeof r.id !== 'string' || ids.has(r.id) || !['total', 'void'].includes(r.type)) throw Error('Invalid region ID or type');
    ids.add(r.id); contoursFor(r);
  }
  if (state.layers.length !== 2 || !['total', 'void'].every(id => state.layers.some(l => l.id === id && l.type === 'region'))) throw Error('Invalid analysis layers');
  return state;
}
export async function readJpeg(file) {
  reportFilename(file.name);
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes[0] !== 255 || bytes[1] !== 216 || bytes[2] !== 255) throw Error('File is not a JPEG');
  const dataUrl = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(reader.error); reader.readAsDataURL(new Blob([bytes], { type: 'image/jpeg' })); });
  return { name: file.name, dataUrl };
}
