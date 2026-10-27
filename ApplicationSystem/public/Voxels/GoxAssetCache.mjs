// Nodevision/ApplicationSystem/public/Voxels/GoxAssetCache.mjs
// Shares immutable decoded artwork between live world placements and releases it with the last placement.
import {decodeGox} from './GoxCodec.mjs';
const entries=new Map();
export function acquireGoxAsset(path){
 let entry=entries.get(path);if(!entry){const abort=new AbortController();entry={abort,refs:0,promise:(async()=>{const response=await fetch('/Notebook/'+path.split('/').map(encodeURIComponent).join('/'),{signal:abort.signal,cache:'no-store'});if(!response.ok)throw Error('Could not load GOX asset '+path+' ('+response.status+')');return decodeGox(await response.arrayBuffer(),{signal:abort.signal});})()};entries.set(path,entry);}entry.refs++;let released=false;
 return{model:entry.promise,release(){if(released)return;released=true;if(--entry.refs===0){entry.abort.abort();if(entries.get(path)===entry)entries.delete(path);}}};
}

export function invalidateGoxAsset(path){entries.delete(path);}
