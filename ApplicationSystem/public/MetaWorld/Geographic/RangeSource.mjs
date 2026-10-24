// Nodevision/ApplicationSystem/public/MetaWorld/Geographic/RangeSource.mjs
// This module supplies the GeoTIFF library with authenticated Notebook byte ranges, enforces transfer budgets before buffering responses, and fingerprints only the bytes consumed by an import.
import { fromCustomClient } from '../../vendor/geographic/reader.mjs';
import { GEO_BUDGETS as B } from './Budgets.mjs';
export const sha256=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
export function notebookPath(path) {
  if(typeof path!=='string'||!path.startsWith('/Notebook/')||/[?#\\]/.test(path)||decodeURIComponent(path).split('/').some(p=>['.','..'].includes(p)))throw Error('Select a portable /Notebook/ asset reference.');return path;
}
export async function openRangeRaster(path,signal) {
  notebookPath(path);let transferred=0,requested=0,requests=0,identity=null,size=0,failure=null;const ranges=new Map();
  const client={async request({headers,signal:requestSignal}) {
    const match=/^bytes=(\d+)-(\d+)$/.exec(headers.Range??'');
    if(!match)throw Error('Only bounded single byte ranges are supported.');
    const offset=Number(match[1]),length=Number(match[2])-offset+1;
    if(++requests>B.requests||length<1||requested+length>B.transferBytes)throw Error('Source access exceeds the 64 MiB / 4096 range-request budget. Use a tiled or shorter-strip GeoTIFF.');
    requested+=length;
    const response=await fetch(path,{headers,signal:signal??requestSignal,credentials:'same-origin',cache:'no-store',redirect:'error'});
    if(response.status!==206){await response.body?.cancel();throw Error(response.ok?'Notebook server did not honor byte ranges; full-file downloads are disabled.':`Source is missing or unavailable (${response.status}): ${path}`);}
    const content=/^bytes (\d+)-(\d+)\/(\d+)$/.exec(response.headers.get('content-range')??'');
    if(!content||Number(content[1])!==offset||Number(content[2])-offset+1>length||Number(content[3])>B.sourceBytes){await response.body?.cancel();throw Error('Invalid range response or source exceeds the 8 GiB address-space budget.');}
    size=Number(content[3]);const current=[size,response.headers.get('etag'),response.headers.get('last-modified')].join('|');
    if(identity&&identity!==current){await response.body?.cancel();throw Error('Source changed during import. Retry with a stable file.');}identity=current;
    return {status:206,ok:true,getHeader:name=>response.headers.get(name),async getData(){
      const reader=response.body.getReader(),bytes=new Uint8Array(Number(content[2])-offset+1);let cursor=0;
      while(true){const {value,done}=await reader.read();if(done)break;if(cursor+value.length>bytes.length){await reader.cancel();throw Error('Range response exceeded its declared size.');}bytes.set(value,cursor);cursor+=value.length;}
      if(cursor!==bytes.length)throw Error('Incomplete Notebook byte range.');
      transferred+=cursor;
      ranges.set(offset+':'+cursor,{offset,length:cursor,sha256:await sha256(bytes)});return bytes.buffer;
    }};
  }};
  const guarded={async request(options){try{const r=await client.request(options);return {...r,async getData(){try{return await r.getData();}catch(error){failure=error;throw error;}}};}catch(error){failure=error;throw error;}}};
  let image;try{const tiff=await fromCustomClient(guarded,{allowFullFile:false,blockSize:65536,cacheSize:16},signal);image=await tiff.getImage();}catch(error){throw failure??error;}
  const read=image.readRasters.bind(image);image.readRasters=async options=>{try{return await read(options);}catch(error){throw failure??error;}};
  return {image,async readRange(offset,length){const response=await client.request({headers:{Range:`bytes=${offset}-${offset+length-1}`},signal});return response.getData();},stats:()=>({transferredBytes:transferred,requestedBytes:requested,requests,sourceBytes:size}),async asset(){
    const fingerprint={algorithm:'sha256-ranges-v1',size,identity,ranges:[...ranges.values()].sort((a,b)=>a.offset-b.offset||a.length-b.length)};
    return {path,sha256:await sha256(new TextEncoder().encode(JSON.stringify({size:fingerprint.size,ranges:fingerprint.ranges}))),fingerprint};
  }};
}
export async function readSmallAsset(path) {
  notebookPath(path);const response=await fetch(path,{cache:'no-store',redirect:'error',credentials:'same-origin'});
  if(!response.ok)throw Error(`Source is missing or unavailable (${response.status}): ${path}`);
  const reader=response.body.getReader(),parts=[];let length=0;
  while(true){const {value,done}=await reader.read();if(done)break;length+=value.length;if(length>1024**2){await reader.cancel();throw Error('KML exceeds 1 MiB.');}parts.push(value);}
  const bytes=new Uint8Array(length);let cursor=0;for(const part of parts){bytes.set(part,cursor);cursor+=part.length;}
  return {asset:{path,sha256:await sha256(bytes)},text:new TextDecoder().decode(bytes)};
}
