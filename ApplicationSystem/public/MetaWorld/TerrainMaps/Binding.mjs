// Nodevision/ApplicationSystem/public/MetaWorld/TerrainMaps/Binding.mjs
// This module connects asynchronously loaded terrain-map tiles to the synchronous terrain sampler. It tracks resident coverage and editor previews while preserving the existing generation and collision interfaces.
import {mapPreview,onMapPreview} from './Preview.mjs';
// Async asset residency around the existing synchronous terrain sampler. Pending coverage is explicit.
import {openMap,httpRanges} from './Reader.mjs';
import {mapSource,mapReference} from './Source.mjs';
const consumers=new Map();
export async function declareMapRegionChanged(path,bounds){await Promise.all([...(consumers.get(path)||[])].map(async b=>{await b.ready;if(b.reader) b.reader.invalidateRegion(bounds);}));}
export function bindMap(def,options={}) {
  const abort=new AbortController(),listeners=new Set();let reader=null,sampler=null,disposed=false,error=null;
  const path=mapReference(options.worldPath||options.sourcePath||'Untitled.html',def.terrainMap.path);
  const binding={path,get reader(){return reader;},get warnings(){return sampler?.warnings||[];},get error(){return error;},kind:def.terrainSource,
    get bounds(){return sampler?.bounds||null;},get resolution(){return sampler?.resolution||null;},
    sample(x,z){if(!sampler||!reader.readyAt(x,z))return {covered:false,pending:true,elevation:null,biome:null,material:null};return sampler.sample(x,z);},
    covers(x,z){return reader?.covers(x,z)??false;},
    readyAt(x,z){return !!reader&&reader.readyAt(x,z);},
    async prepare(bounds){await binding.ready;if(disposed)throw Error('Terrain map closed');await reader.prepare(bounds);},
    onChanged(fn){listeners.add(fn);return ()=>listeners.delete(fn);},
    async declareChanged(bounds){await binding.ready;return declareMapRegionChanged(path,bounds);},
    dispose(){releasePreview();consumers.get(path)?.delete(binding);if(!consumers.get(path)?.size)consumers.delete(path);disposed=true;abort.abort();reader?.dispose();listeners.clear();}
  };
  const releasePreview=onMapPreview(async(changed,value,bounds)=>{if(changed!==path||disposed)return;await binding.ready;if(disposed)return;if(value){reader.setOverlay(value,bounds);sampler=mapSource(reader,{mode:def.terrainSource,seed:def.generator.seed,...def.terrainMap});}else{const replacement=await openMap(options.mapRead||httpRanges('/Notebook/'+path.split('/').map(encodeURIComponent).join('/'),{fetch:options.mapFetch,signal:abort.signal}),{cacheBytes:options.mapCacheBytes});reader.dispose();reader=replacement;if(mapPreview(path))reader.setOverlay(mapPreview(path),mapPreview(path).bounds);sampler=mapSource(reader,{mode:def.terrainSource,seed:def.generator.seed,...def.terrainMap});reader.onChanged(b=>listeners.forEach(fn=>fn(b)));reader.invalidateRegion(bounds);}});
  if(!consumers.has(path))consumers.set(path,new Set());consumers.get(path).add(binding);
  binding.ready=(async()=>{try{reader=await openMap(options.mapRead||httpRanges('/Notebook/'+path.split('/').map(encodeURIComponent).join('/'),{fetch:options.mapFetch,signal:abort.signal}),{cacheBytes:options.mapCacheBytes});if(disposed){reader.dispose();throw Error('Terrain map closed');}if(mapPreview(path))reader.setOverlay(mapPreview(path),mapPreview(path).bounds);sampler=mapSource(reader,{mode:def.terrainSource,seed:def.generator.seed,...def.terrainMap});reader.onChanged(b=>listeners.forEach(fn=>fn(b)));return reader;}catch(e){releasePreview();error=e;consumers.get(path)?.delete(binding);if(!consumers.get(path)?.size)consumers.delete(path);reader?.dispose();throw e;}})();
  // Ownership is the runtime's ready promise, but prevent an unhandled rejection before it is attached.
  binding.ready.catch(()=>{});return binding;
}
