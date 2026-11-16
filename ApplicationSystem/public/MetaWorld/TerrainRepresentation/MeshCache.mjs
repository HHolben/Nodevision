// Nodevision/ApplicationSystem/public/MetaWorld/TerrainRepresentation/MeshCache.mjs
// This per-runtime LRU retains compact CPU occupancy and polygonal buffers independently of live meshes and GPU resources. Signed chunk keys, halo-aware invalidation, generation stamps and explicit byte/count limits prevent stale reuse or unbounded travel history.
import {GROUND_NORMAL_HALO} from './GroundNormals.mjs';
export function createMeshCache({maxBytes=32*1048576,maxEntries=128}={}) {
 if(!Number.isFinite(maxBytes)||maxBytes<0||!Number.isInteger(maxEntries)||maxEntries<0)throw new RangeError('Mesh cache budgets must be finite nonnegative bytes and an integer entry count.');
 const entries=new Map(),stats={hits:0,misses:0,builds:0,evictions:0,invalidations:0,reasons:{}};let bytes=0,revision=0;
 const key=(cell,mode)=>`${mode}:${cell.join(',')}`;
 const remove=k=>{const old=entries.get(k);if(old){bytes-=old.bytes;entries.delete(k);}};
 function invalidate(bounds,reason='terrain') {
  revision++;stats.invalidations++;stats.reasons[reason]=(stats.reasons[reason]||0)+1;
  // Occupancy uses one cell; natural normals also read a bounded horizontal height stencil.
  for(const [k,e] of entries)if(!bounds||e.cell.every((n,i)=>{const halo=i===1?1:GROUND_NORMAL_HALO;return n*32-halo<bounds.max[i]&&(n+1)*32+halo>bounds.min[i];}))remove(k);
 }
 return {
  get revision(){return revision;},
  get(cell,mode){const k=key(cell,mode),e=entries.get(k);if(!e){stats.misses++;return null;}entries.delete(k);entries.set(k,e);stats.hits++;return e;},
  put(cell,mode,data,result,stamp){
   if(stamp!==revision||maxEntries===0||maxBytes===0)return;stats.builds++;
   const compact={...result,positions:new Float32Array(result.positions),normals:new Float32Array(result.normals),uvs:new Float32Array(result.uvs),indices:new Uint32Array(result.indices),groups:result.groups.map(g=>({...g}))};
   const size=data.byteLength+compact.positions.byteLength+compact.normals.byteLength+compact.uvs.byteLength+compact.indices.byteLength+compact.groups.length*24;
   const k=key(cell,mode);remove(k);if(size>maxBytes)return;
   while(entries.size>=maxEntries||bytes+size>maxBytes){remove(entries.keys().next().value);stats.evictions++;}
   entries.set(k,{cell:cell.slice(),data,result:compact,bytes:size});bytes+=size;
  },
  invalidate,
  clear(reason='source'){invalidate(null,reason);},
  snapshot(){return {...stats,reasons:{...stats.reasons},entries:entries.size,bytes,maxBytes,maxEntries,revision,gpuBytes:0};},
  dispose(){entries.clear();bytes=0;revision++;}
 };
}
