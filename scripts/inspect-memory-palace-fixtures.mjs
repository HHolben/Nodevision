// Read-only inspection through the production bounded range reader. Never decodes full rasters.
import {open,readdir,stat} from 'node:fs/promises';
import path from 'node:path';
import {openRangeRaster} from '../ApplicationSystem/public/MetaWorld/Geographic/RangeSource.mjs';
import {inspectRaster} from '../ApplicationSystem/public/MetaWorld/Geographic/InspectRaster.mjs';
import {importCrop} from '../ApplicationSystem/public/MetaWorld/Geographic/WindowImport.mjs';
const directory=path.resolve(process.argv[2]||'Notebook/test-fixtures/GreekAlphabet/Terrain'),originalFetch=globalThis.fetch,report=[];
try{for(const file of (await readdir(directory)).filter(f=>/\.tiff?$/i.test(f))){const absolute=path.join(directory,file),handle=await open(absolute,'r'),size=(await stat(absolute)).size;try{
 globalThis.fetch=async(url,options)=>{const match=/^bytes=(\d+)-(\d+)$/.exec(options?.headers?.Range||'');if(!match)throw Error('Inspection requires a byte range');const offset=+match[1],end=Math.min(size-1,+match[2]);if(end<offset)return new Response(null,{status:416});const buffer=Buffer.alloc(end-offset+1);const {bytesRead}=await handle.read(buffer,0,buffer.length,offset);return new Response(buffer.subarray(0,bytesRead),{status:206,headers:{'content-range':`bytes ${offset}-${offset+bytesRead-1}/${size}`,etag:'read-only-fixture'}});};
 const source=await openRangeRaster('/Notebook/'+encodeURIComponent(file)),metadata=inspectRaster(source.image),item={file,bytes:size,...metadata,metadataAccess:source.stats()};
 // Small explicit Pelion summit crop, never a whole-dataset request.
 if(metadata.terrainImport){try{const result=await importCrop(source,{crop:[23.035,39.43,23.055,39.45]});item.crop={bounds:result.plan.crop,window:result.plan.window,width:result.elevation.width,height:result.elevation.height,min:result.elevation.min,max:result.elevation.max,access:result.access};}catch(error){item.cropDiagnostic=error.message;}const [w,s,e,n]=metadata.bounds,dx=Math.abs(metadata.resolution[0])*8,dy=Math.abs(metadata.resolution[1])*8,cx=(w+e)/2,cy=(s+n)/2;const result=await importCrop(source,{crop:[cx-dx,cy-dy,cx+dx,cy+dy]});item.centerCrop={window:result.plan.window,width:result.elevation.width,height:result.elevation.height,min:result.elevation.min,max:result.elevation.max,access:result.access};}
 report.push(item);
 }finally{await handle.close();}}
 console.log(JSON.stringify(report,null,2));
}finally{globalThis.fetch=originalFetch;}
