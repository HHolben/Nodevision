// Nodevision/ApplicationSystem/public/MetaWorld/TerrainMaps/Reader.mjs
// This module reads terrain-map manifests and tiles through bounded range sources. It validates incoming data and manages tile residency without requiring complete asset downloads.
import {HEADER_BYTES,CELL_BYTES,readHeader,validateManifest,layout,validateTile} from './Format.mjs';
export function memoryRanges(bytes) { return async (offset,length)=>bytes.slice(offset,offset+length); }
// Do not buffer a large response when a server ignores Range. Small portable fixtures may use a bounded fallback.
export function httpRanges(url,{fetch:request=globalThis.fetch,signal,maxFallback=8*1024**2}={}) {
  let whole=null,etag=null;
  const read=async(offset,length)=>{
    if(whole)return whole.slice(offset,offset+length);
    const response=await request(url,{headers:{Range:`bytes=${offset}-${offset+length-1}`},cache:'no-store',signal});
    if(!response.ok)throw Error(`Terrain map unavailable (${response.status}): ${url}`);
    const next=response.headers.get('etag');if(etag&&next&&etag!==next)throw Error('Terrain map changed during streaming; reload it or declare the edited region');if(next)etag=next;
    if(response.status===206){const range=response.headers.get('content-range');if(!range?.startsWith(`bytes ${offset}-${offset+length-1}/`))throw Error('Terrain map server returned an incorrect byte range');const bytes=new Uint8Array(await response.arrayBuffer());if(bytes.length!==length)throw Error('Truncated terrain map range');return bytes;}
    const declared=Number(response.headers.get('content-length'));if(!declared||declared>maxFallback){await response.body?.cancel();throw Error('Large .nvmap files require HTTP byte-range support (206 responses)');}
    const reader=response.body.getReader(),parts=[];let size=0;
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>maxFallback){await reader.cancel();throw Error('Terrain map response exceeds the bounded fallback');}parts.push(value);}
    whole=new Uint8Array(size);let i=0;for(const p of parts){whole.set(p,i);i+=p.length;}return whole.slice(offset,offset+length);
  };
  read.resetRevision=()=>{whole=null;etag=null;};return read;
}
export async function openMap(read,{cacheBytes=64*1024**2}={}) {
  const h=readHeader(await read(0,HEADER_BYTES));let parsed;try{parsed=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await read(HEADER_BYTES,h.manifestBytes)));}catch(error){throw Error('Terrain map: invalid manifest JSON: '+error.message);}
  const manifest=validateManifest(parsed),l=layout(manifest,h.manifestBytes);
  if(l.payloadOffset!==h.payloadOffset||l.length!==h.length)throw Error('Terrain map: inconsistent file length or payload offset');
  const {grid:g,origin}=manifest,cache=new Map(),pending=new Map(),listeners=new Set(),capacity=Math.floor(cacheBytes/l.tileBytes);let revision=0,disposed=false,overlay=null;const originalPalettes={biomes:manifest.biomes,materials:manifest.materials};
  if(capacity<1)throw Error('Terrain map cache must fit at least one tile');
  const key=(x,z)=>z*l.columns+x;
  async function tile(x,z){
    const k=key(x,z);if(cache.has(k)){const v=cache.get(k);cache.delete(k);cache.set(k,v);return v;}if(pending.has(k))return pending.get(k);
    const epoch=revision,work=(async()=>{const bytes=overlay?await overlay.getTile(k):await read(l.payloadOffset+k*l.tileBytes,l.tileBytes),view=validateTile(manifest,bytes,x,z);if(disposed||epoch!==revision)throw Error('Terrain map read superseded by a region update');cache.set(k,view);while(cache.size>capacity)cache.delete(cache.keys().next().value);return view;})();pending.set(k,work);try{return await work;}finally{if(pending.get(k)===work)pending.delete(k);}
  }
  const covers=(x,z)=>Number.isFinite(x)&&Number.isFinite(z)&&x>=origin[0]&&z>=origin[2]&&x<=origin[0]+manifest.size[0]&&z<=origin[2]+manifest.size[1];
  const pixel=(x,z)=>[(x-origin[0])/g.spacing[0],(z-origin[2])/g.spacing[1]];
  function cells(x,z){const [u,v]=pixel(x,z),x0=Math.floor(u),z0=Math.floor(v);return {u,v,x0,z0,x1:Math.min(g.width-1,x0+1),z1:Math.min(g.height-1,z0+1)};}
  function cell(x,z){const view=cache.get(key(Math.floor(x/g.tileSize),Math.floor(z/g.tileSize)));if(!view)throw Error('Terrain map region is not resident; await prepare(bounds) before sampling');const at=((z%g.tileSize)*g.tileSize+x%g.tileSize)*CELL_BYTES;return {elevation:view.getFloat64(at,true),biome:manifest.biomes[view.getUint32(at+8,true)],material:manifest.materials[view.getUint32(at+12,true)]};}
  function tileBounds(b){const lo=pixel(Math.max(origin[0],b.minX),Math.max(origin[2],b.minZ)),hi=pixel(Math.min(origin[0]+manifest.size[0],b.maxX),Math.min(origin[2]+manifest.size[1],b.maxZ));if(lo.some((n,i)=>n>hi[i]))return null;return {min:lo.map(n=>Math.floor(Math.max(0,n)/g.tileSize)),max:hi.map((n,i)=>Math.floor(Math.min((i?g.height:g.width)-1,Math.ceil(n))/g.tileSize))};}
  const api={manifest,layout:l,covers,
    get revision(){return revision;},get stats(){return {tiles:cache.size,pending:pending.size,residentBytes:cache.size*l.tileBytes,capacity};},
    readyAt(x,z){if(!covers(x,z))return true;const c=cells(x,z);return [c.x0,c.x1].every(a=>[c.z0,c.z1].every(b=>cache.has(key(Math.floor(a/g.tileSize),Math.floor(b/g.tileSize)))));},
    sample(x,z){if(!covers(x,z))return {covered:false,elevation:null,biome:null,material:null};const c=cells(x,z),a=cell(c.x0,c.z0),b=cell(c.x1,c.z0),d=cell(c.x0,c.z1),e=cell(c.x1,c.z1),fx=c.u-c.x0,fz=c.v-c.z0,nearest=cell(Math.min(g.width-1,Math.round(c.u)),Math.min(g.height-1,Math.round(c.v)));return {covered:true,elevation:origin[1]+(a.elevation*(1-fx)+b.elevation*fx)*(1-fz)+(d.elevation*(1-fx)+e.elevation*fx)*fz,biome:nearest.biome,material:nearest.material};},
    async prepare(b){if(disposed)throw Error('Terrain map is closed');if(![b.minX,b.minZ,b.maxX,b.maxZ].every(Number.isFinite)||b.minX>b.maxX||b.minZ>b.maxZ)throw Error('Invalid terrain map preparation bounds');const t=tileBounds(b);if(!t)return;const count=(t.max[0]-t.min[0]+1)*(t.max[1]-t.min[1]+1);if(count>capacity)throw Error('Requested map window exceeds tile cache budget; reduce render distance or use coarser map spacing');let cursor=0;await Promise.all(Array.from({length:Math.min(4,count)},async()=>{while(cursor<count){const i=cursor++,width=t.max[0]-t.min[0]+1;await tile(t.min[0]+i%width,t.min[1]+Math.floor(i/width));}}));},
    setOverlay(value,bounds){if(value){const next=validateManifest(value.manifest);if(typeof value.getTile!=='function'||['grid','origin','size'].some(k=>JSON.stringify(next[k])!==JSON.stringify(manifest[k]))||!originalPalettes.biomes.every((id,i)=>next.biomes[i]===id)||!originalPalettes.materials.every((id,i)=>next.materials[i]===id))throw Error('Terrain map preview must preserve the source grid, origin and palette indices');value={...value,manifest:next};}overlay=value;manifest.biomes=value?.manifest.biomes||originalPalettes.biomes;manifest.materials=value?.manifest.materials||originalPalettes.materials;api.invalidateRegion(bounds);},
    onChanged(fn){listeners.add(fn);return ()=>listeners.delete(fn);},
    invalidateRegion(b){if(![b.minX,b.minZ,b.maxX,b.maxZ].every(Number.isFinite)||b.minX>b.maxX||b.minZ>b.maxZ)throw Error('Invalid changed map region');const t=tileBounds(b);revision++;read.resetRevision?.();pending.clear();if(t)for(const k of cache.keys()){const x=k%l.columns,z=Math.floor(k/l.columns);if(x>=t.min[0]&&x<=t.max[0]&&z>=t.min[1]&&z<=t.max[1])cache.delete(k);}const affected={minX:b.minX-g.spacing[0],maxX:b.maxX+g.spacing[0],minZ:b.minZ-g.spacing[1],maxZ:b.maxZ+g.spacing[1]};for(const fn of listeners)fn(affected);return affected;},
    dispose(){disposed=true;revision++;cache.clear();pending.clear();listeners.clear();}
  };return api;
}
