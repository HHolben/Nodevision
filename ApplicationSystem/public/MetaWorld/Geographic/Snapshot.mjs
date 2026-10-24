// Nodevision/ApplicationSystem/public/MetaWorld/Geographic/Snapshot.mjs
// This module stores cropped sample windows as portable little-endian binary base64 rather than JSON number arrays and lazily caches their exact Float64 values for offline sampling.
import { GEO_BUDGETS as B } from './Budgets.mjs';
const decoded=new WeakMap();
export function bytesToBase64(bytes) {
  let text='';for(let i=0;i<bytes.length;i+=8192)text+=String.fromCharCode(...bytes.subarray(i,i+8192));
  return btoa(text);
}
export function rasterData(r) {
  if(r.data)return r.data;
  if(decoded.has(r))return decoded.get(r);
  if(r.encoding!=='f64-le-base64'||!Number.isInteger(r.width*r.height)||r.width*r.height>B.samples||r.samples?.length!==Math.ceil(r.width*r.height*8/3)*4)throw Error('Invalid compact raster snapshot.');
  const text=atob(r.samples),view=new DataView(Uint8Array.from(text,c=>c.charCodeAt(0)).buffer),data=new Float64Array(r.width*r.height);
  for(let i=0;i<data.length;i++)data[i]=view.getFloat64(i*8,true);
  decoded.set(r,data);return data;
}
export function packRaster(r,data) {
  const buffer=new ArrayBuffer(data.length*8),view=new DataView(buffer);
  for(let i=0;i<data.length;i++)view.setFloat64(i*8,data[i]===null?NaN:data[i],true);
  const {data:ignored,...metadata}=r;
  const result={...metadata,encoding:'f64-le-base64',samples:bytesToBase64(new Uint8Array(buffer))};
  return result;
}
