// Nodevision/ApplicationSystem/public/MetaWorld/Geographic/WindowImport.mjs
// This module reads only the selected raster window and interpolation halo, then retains exact cropped samples with original georeferencing for deterministic offline regeneration.
import { rasterMetadata,windowBudget } from './RasterMetadata.mjs';
import { planCrop,intersection,rectangle,geometryBounds,transformGeometry } from './CropGeometry.mjs';
import { rasterPoint } from './Coordinates.mjs';
import { cropSupport } from './CropSupport.mjs';
import { packRaster } from './Snapshot.mjs';
export async function readWindow(image,meta,window,geometry=null,signal,categorical=false,retainedBytes=0) {
  const budget=await windowBudget(image,meta,window,retainedBytes,categorical),raw=await image.readRasters({window,samples:[0],interleave:true,signal});
  const data=Float64Array.from(raw,v=>!Number.isFinite(v)||v===meta.noData?NaN:v);
  const [x,y,x1,y1]=window,width=x1-x,height=y1-y;
  const source={width:meta.width,height:meta.height,bounds:meta.bounds,origin:meta.origin};
  const r={...meta,width,height,source,sourceOrigin:meta.origin,window,origin:[meta.origin[0]+x*meta.resolution[0],meta.origin[1]+y*meta.resolution[1]],budget};
  let range=null;
  if(geometry)range=cropSupport(r,geometry,data);
  else if(categorical&&data.some(v=>Number.isFinite(v)&&(!Number.isInteger(v)||v<0)))throw Error('Land-cover samples must be nonnegative integer class codes or NoData.');
  let invalid=0,min=Infinity,max=-Infinity;for(const v of data){if(Number.isFinite(v)){min=Math.min(min,v);max=Math.max(max,v);}else invalid++;}
  return {snapshot:packRaster({...r,min:Number.isFinite(min)?min:null,max:Number.isFinite(max)?max:null,invalid},data),range};
}
export async function importCrop(source,settings,signal) {
  const meta=rasterMetadata(source.image),plan=planCrop(meta,settings);
  try {
    const {snapshot,range}=await readWindow(source.image,meta,plan.window,plan.local,signal);
    snapshot.asset=await source.asset();return {elevation:snapshot,range,plan,access:source.stats()};
  }catch(error){error.diagnostic={...plan,...error.diagnostic,window:plan.window};throw error;}
}
export async function importLandcover(source,plan,signal,retainedBytes=0) {
  const meta=rasterMetadata(source.image),edge=meta.offset===.5?.5:0,geometry=intersection(transformGeometry(plan.effective,p=>rasterPoint(meta,...p),1e-7,16),rectangle([-edge,-edge,meta.width-1+edge,meta.height-1+edge]));
  if(!geometry.length)return {snapshot:null,asset:await source.asset(),warning:'Land-cover source has no overlap; default biome applies.'};
  const b=geometryBounds(geometry),window=[Math.max(0,Math.floor(b[0])),Math.max(0,Math.floor(b[1])),Math.min(meta.width,Math.ceil(b[2])+1),Math.min(meta.height,Math.ceil(b[3])+1)];
  const {snapshot}=await readWindow(source.image,meta,window,null,signal,true,retainedBytes);snapshot.asset=await source.asset();return {snapshot,access:source.stats()};
}
