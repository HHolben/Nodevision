// Nodevision/ApplicationSystem/public/Voxels/GoxCodec.mjs
// Independent GOX v1/v2 reader and writer; unfamiliar semantics remain byte-preserved and read-only.
import { readMaterial } from './GoxMaterials.mjs';
import { Reader, text, utf8, integer, concat, dictionary, writeDictionary } from './Binary.mjs';
import { decodeBlockPng, encodeBlockPng } from './BlockPng.mjs';
import { newModel, newLayer, key, point, position } from './VoxelModel.mjs';
const known = new Set(['name','mat','id','base_id','material','mode','visible','box','color']);
const number = (bytes, fallback = 0) => bytes?.length === 4 ? new DataView(bytes.buffer,bytes.byteOffset,4).getInt32(0,true) : fallback;
function unsupported(model, message) { model.readOnly = true; if (!model.warnings.includes(message)) model.warnings.push(message); }
function chunk(type, payload) { return concat([utf8(type), integer(payload.length), payload, integer(0)]); }
export async function decodeGox(input, { signal, progress = () => {} } = {}) {
  const bytes = new Uint8Array(input); if (bytes.length > 134217728) throw Error('GOX exceeds 128 MiB safety limit');
  const reader = new Reader(bytes); if (text.decode(reader.take(4)) !== 'GOX ') throw Error('Invalid GOX signature');
  const model = newModel(); model.version = reader.int(); model.layers = []; model.original = bytes;
  if (![1,2].includes(model.version)) throw Error('Unsupported GOX version');
  const blocks = []; const layers = []; let count = 0;
  while (reader.remaining) {
    signal?.throwIfAborted(); if (++count > 20000) throw Error('Too many GOX chunks');
    const type = text.decode(reader.take(4)), size = reader.int(), payload = reader.take(size); reader.take(4);
    if (type === 'BL16') { if (blocks.length >= 8192) throw Error('Too many voxel blocks'); blocks.push(await decodeBlockPng(payload)); }
    else if (type === 'LAYR') layers.push(payload);
    else { if(type==='MATE')readMaterial(payload);model.extras.push({ type, payload }); if (!['MATE','IMG ','CAMR','LIGH','PREV'].includes(type)) unsupported(model, `Unknown ${type} chunk: editing disabled to preserve its references.`); }
    progress(reader.offset / bytes.length); if (count % 32 === 0) await new Promise(resolve => setTimeout(resolve,0));
  }
  if(blocks.length&&!layers.length)throw Error("Voxel blocks have no layer references");
  let referenced=0;
  for (const payload of layers) {
    const r = new Reader(payload), n = r.int(); if (n < 0 || n > 8192 || n * 20 > r.remaining) throw Error('Invalid layer block count');
    if((referenced+=n)>8192)throw Error("Too many layer block references");
    const layer = newLayer();
    for (let i=0;i<n;i++) {
      const index = r.int(), pos = [r.int(),r.int(),r.int()].map(v=>v-(model.version===1?8:0)), reserved = r.int(); position(pos);
      if (!blocks[index]) throw Error('Invalid voxel block reference');
      if (reserved || pos.some(v=>v%16)) unsupported(model,'Unaligned or extended block positions require read-only mode.');
      if (layer.chunks.has(key(pos))) throw Error('Duplicate layer block position'); layer.chunks.set(key(pos), blocks[index].slice());
    }
    layer.attributes = dictionary(r.take(r.remaining)); layer.name = text.decode(layer.attributes.get('name') || utf8('Layer'));
    layer.visible = !layer.attributes.has('visible') || layer.attributes.get('visible')[0] !== 0;
    layer.material = number(layer.attributes.get('material'));
    for (const [name,value] of layer.attributes) {
      const size={visible:1,id:4,base_id:4,material:4,mode:4,box:64,color:4}[name];if(size&&value.length!==size)throw Error('Invalid layer '+name+' length');
      if (!known.has(name) || (['base_id','mode'].includes(name) && number(value))) unsupported(model,`Unsupported layer property ${name}: editing disabled.`);
      if (name === 'mat') { if (value.length !== 64) throw Error('Invalid layer matrix'); const view = new DataView(value.buffer,value.byteOffset,64); layer.matrix = Array.from({length:16},(_,i)=>view.getFloat32(i*4,true)); if(layer.matrix.some(v=>!Number.isFinite(v)))throw Error('Invalid layer matrix value'); if (layer.matrix.some((v,i)=>v !== (i%5===0?1:0))) unsupported(model,'Transformed layers are view-only.'); }
    }
    model.layers.push(layer);
  }
  const materialCount=model.extras.filter(e=>e.type==='MATE').length;
  if(model.layers.some(l=>l.material<0||l.material>=Math.max(1,materialCount)))throw Error('Invalid material reference');
  if (!model.layers.length) model.layers.push(newLayer('Layer 1'));
  return model;
}
export async function encodeGox(model, { signal } = {}) {
  signal?.throwIfAborted();
  if (model.readOnly) { if (model.original) return model.original.slice(); throw Error('Cannot serialize unsupported document'); }
  const parts = [utf8('GOX '),integer(model.version || 2)], references = []; let index = 0;
  for (const layer of model.layers) {
    const refs = [];
    for (const [name,data] of layer.chunks) { signal?.throwIfAborted(); const pos = position(point(name)).map(v=>v+(model.version===1?8:0)); parts.push(chunk('BL16',await encodeBlockPng(data))); refs.push(integer(index++),...pos.map(v=>integer(v)),integer(0)); }
    references.push(refs);
  }
  for (const extra of model.extras) parts.push(chunk(extra.type,extra.payload));
  model.layers.forEach((layer,i)=> { const attrs = new Map(layer.attributes); attrs.set('name',utf8(layer.name)); attrs.set('visible',new Uint8Array([layer.visible?1:0])); attrs.set('material',integer(layer.material || 0)); parts.push(chunk('LAYR',concat([integer(layer.chunks.size),...references[i],writeDictionary(attrs)]))); });
  return concat(parts);
}
