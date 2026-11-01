// Nodevision/ApplicationSystem/public/MetaWorld/TerrainMaps/Format.mjs
// This module defines the versioned terrain-map binary layout and its validation rules. It supports independently addressable raster tiles and bounded manifests for predictable random access.
// NVMAP v1: a small manifest followed by fixed-stride, independently addressable raster tiles.
export const MAGIC = [78,86,77,65,80,13,10,26];
export const HEADER_BYTES = 32, CELL_BYTES = 16, MAX_MANIFEST = 1024*1024;
const finiteVector = (v,n) => Array.isArray(v)&&v.length===n&&v.every(Number.isFinite);
export function validateManifest(input) {
  const m=structuredClone(input),fail=message=>{throw Error('Terrain map: '+message);};
  if(m?.format!=='nodevision-terrain-map'||m.version!==1)fail('unsupported format or schema version');
  if(typeof m.name!=='string'||!m.name.trim())fail('a map name is required');
  const g=m.grid;
  if(!g||!Number.isSafeInteger(g.width)||!Number.isSafeInteger(g.height)||g.width<2||g.height<2)fail('grid needs at least two samples per axis');
  if(!finiteVector(g.spacing,2)||g.spacing.some(n=>n<=0)||!finiteVector(m.origin,3))fail('invalid sample spacing or coordinate origin');
  if(!finiteVector(m.size,2)||m.size.some((n,i)=>n<=0||Math.abs(n-(i?g.height-1:g.width-1)*g.spacing[i])>Math.max(1,n)*1e-10))fail('physical size must match grid intervals and spacing');
  if(!Number.isFinite(m.origin[0]+m.size[0])||!Number.isFinite(m.origin[2]+m.size[1])||m.origin[0]+g.spacing[0]===m.origin[0]||m.origin[2]+g.spacing[1]===m.origin[2])fail('coordinate bounds or spacing exceed numeric precision');
  if(!Number.isInteger(g.tileSize)||g.tileSize<16||g.tileSize>256)fail('tileSize must be 16–256 samples');
  if(m.elevation?.units!=='meters'||typeof m.elevation.reference!=='string'||!m.elevation.reference)fail('elevation requires meters and a reference convention');
  if(m.boundary!==undefined&&m.boundary!=='empty')fail('version 1 map boundary must be empty (no wrapping)');
  for(const name of ['biomes','materials'])if(!Array.isArray(m[name])||!m[name].length||m[name].length>65536||m[name].some((v,i)=>!(name==='materials'&&i===0&&v===null)&& (typeof v!=='string'||!v)))fail('invalid '+name+' palette');
  if(m.materials[0]!==null)fail('material index zero must be null (biome default)');
  if(m.requiredExtensions!==undefined&&!Array.isArray(m.requiredExtensions))fail('requiredExtensions must be an array');
  if(m.requiredExtensions?.length)fail('unsupported required extensions: '+m.requiredExtensions.join(', '));
  if(m.extensions!==undefined&&(!m.extensions||typeof m.extensions!=='object'||Array.isArray(m.extensions)))fail('extensions must be a JSON object');
  const count=Math.ceil(g.width/g.tileSize)*Math.ceil(g.height/g.tileSize),bytes=count*g.tileSize*g.tileSize*CELL_BYTES;
  if(!Number.isSafeInteger(bytes)||bytes+MAX_MANIFEST+HEADER_BYTES>Number.MAX_SAFE_INTEGER)fail('file byte offsets exceed exact integer addressing');
  m.boundary='empty';return m;
}
export function layout(m,manifestBytes) {
  const columns=Math.ceil(m.grid.width/m.grid.tileSize),rows=Math.ceil(m.grid.height/m.grid.tileSize),tileBytes=m.grid.tileSize**2*CELL_BYTES,payloadOffset=Math.ceil((HEADER_BYTES+manifestBytes)/8)*8;
  return {columns,rows,tileBytes,payloadOffset,length:payloadOffset+columns*rows*tileBytes};
}
export function headerFor(m,manifestBytes) {
  const l=layout(m,manifestBytes),bytes=new Uint8Array(HEADER_BYTES),v=new DataView(bytes.buffer);bytes.set(MAGIC);v.setUint32(8,1,true);v.setUint32(12,manifestBytes,true);v.setBigUint64(16,BigInt(l.payloadOffset),true);v.setBigUint64(24,BigInt(l.length),true);return bytes;
}
export function readHeader(bytes) {
  if(bytes.length!==HEADER_BYTES||MAGIC.some((n,i)=>bytes[i]!==n))throw Error('Terrain map: invalid or truncated NVMAP header');
  const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),version=v.getUint32(8,true),manifestBytes=v.getUint32(12,true),payloadOffset=Number(v.getBigUint64(16,true)),length=Number(v.getBigUint64(24,true));
  if(version!==1)throw Error('Terrain map: unsupported container version '+version);
  if(!manifestBytes||manifestBytes>MAX_MANIFEST||![payloadOffset,length].every(Number.isSafeInteger))throw Error('Terrain map: invalid manifest size or offsets');
  return {manifestBytes,payloadOffset,length};
}
export function validateTile(m,bytes,tx,tz) {
  const size=m.grid.tileSize;if(bytes.length!==size*size*CELL_BYTES)throw Error(`Terrain map: truncated tile ${tx},${tz}`);
  const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  for(let z=0;z<size&&tz*size+z<m.grid.height;z++)for(let x=0;x<size&&tx*size+x<m.grid.width;x++){
    const at=(z*size+x)*CELL_BYTES;
    if(!Number.isFinite(v.getFloat64(at,true))||v.getUint32(at+8,true)>=m.biomes.length||v.getUint32(at+12,true)>=m.materials.length)throw Error(`Terrain map: invalid elevation or palette index in tile ${tx},${tz} at ${x},${z}`);
  }return v;
}
export async function* encodeMap(input,sample) {
  const m=validateManifest(input),json=new TextEncoder().encode(JSON.stringify(m));if(json.length>MAX_MANIFEST)throw Error('Terrain map manifest exceeds 1 MiB');
  const l=layout(m,json.length);yield headerFor(m,json.length);yield json;yield new Uint8Array(l.payloadOffset-HEADER_BYTES-json.length);
  for(let tz=0;tz<l.rows;tz++)for(let tx=0;tx<l.columns;tx++){
    const bytes=new Uint8Array(l.tileBytes),v=new DataView(bytes.buffer),s=m.grid.tileSize;
    for(let z=0;z<s&&tz*s+z<m.grid.height;z++)for(let x=0;x<s&&tx*s+x<m.grid.width;x++){
      const cell=sample(tx*s+x,tz*s+z),at=(z*s+x)*CELL_BYTES;
      if(!cell||!Number.isFinite(cell.elevation)||!Number.isInteger(cell.biome)||cell.biome<0||cell.biome>=m.biomes.length||!Number.isInteger(cell.material)||cell.material<0||cell.material>=m.materials.length)throw Error('Terrain map writer received an invalid sample');
      v.setFloat64(at,cell.elevation,true);v.setUint32(at+8,cell.biome,true);v.setUint32(at+12,cell.material,true);
    }yield bytes;
  }
}
export async function encodeSmallMap(m,sample) {
  const json=new TextEncoder().encode(JSON.stringify(validateManifest(m)));if(layout(m,json.length).length>64*1024**2)throw Error('Use the streaming map writer for files over 64 MiB');
  const parts=[];let size=0;for await(const p of encodeMap(m,sample)){parts.push(p);size+=p.length;}const result=new Uint8Array(size);let at=0;for(const p of parts){result.set(p,at);at+=p.length;}return result;
}
