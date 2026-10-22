// Nodevision/ApplicationSystem/public/Voxels/VoxelModel.mjs
// Stores exact integer RGBA voxels in sparse 16-cubed chunks independently of rendered geometry.
export const key = point => point.join(',');
export const point = value => value.split(',').map(Number);
export function position(value) { if (!Array.isArray(value) || value.length !== 3 || value.some(n => !Number.isInteger(n) || Math.abs(n) > 1000000)) throw Error('Expected three integer coordinates within ±1000000'); return value; }
export function rgba(value) { if (!Array.isArray(value) || value.length !== 4 || value.some(n => !Number.isInteger(n) || n < 0 || n > 255)) throw Error('Expected four RGBA bytes'); return value; }
export const chunkKey = pos => key(pos.map(n => Math.floor(n / 16) * 16));
export function newLayer(name = 'Layer') { return { name, visible: true, locked: false, material: 0, attributes: new Map(), chunks: new Map() }; }
export function newModel() { return { version: 2, layers: [newLayer('Layer 1')], extras: [], warnings: [], readOnly: false }; }
export function getVoxel(layer, pos) { const origin = pos.map(n => Math.floor(n / 16) * 16), data = layer.chunks.get(key(origin)); if (!data) return [0,0,0,0]; const i = ((pos[2]-origin[2])*256+(pos[1]-origin[1])*16+pos[0]-origin[0])*4; return Array.from(data.subarray(i,i+4)); }
export function setVoxel(layer, pos, color) {
  position(pos); rgba(color); const origin = pos.map(n => Math.floor(n / 16) * 16), name = key(origin);
  const data = layer.chunks.get(name) || new Uint8Array(16384), i = ((pos[2]-origin[2])*256+(pos[1]-origin[1])*16+pos[0]-origin[0])*4;
  if (color.every((v,n) => data[i+n] === v)) return false;
  data.set(color,i); if (color.some(n => n) || data.some(n => n)) layer.chunks.set(name,data); else layer.chunks.delete(name); return true;
}
export function* voxels(layer) { for (const [name,data] of layer.chunks) { const o = point(name); for (let i=0;i<4096;i++) if (data[i*4+3]) yield { pos:[o[0]+i%16,o[1]+Math.floor(i/16)%16,o[2]+Math.floor(i/256)], color:Array.from(data.subarray(i*4,i*4+4)) }; } }
export function cloneLayer(layer) { return { ...layer, attributes: new Map([...layer.attributes].map(([k,v])=>[k,v.slice()])), chunks: new Map([...layer.chunks].map(([k,v])=>[k,v.slice()])) }; }
