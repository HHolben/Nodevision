// Nodevision/ApplicationSystem/public/MetaWorld/Geographic/RasterImport.mjs
// This module decodes explicitly bounded single-band GeoTIFF inputs using the maintained GeoTIFF reader and retains enough metadata to reproduce geographic sample alignment.
import { fromArrayBuffer } from '../../vendor/geographic/reader.mjs';
import { unproject } from './Coordinates.mjs';
export const MAX_PIXELS=262144, MAX_BYTES=16*1024*1024;
export async function decodeRaster(buffer,asset,signal) {
  if(buffer.byteLength>MAX_BYTES)throw Error('GeoTIFF exceeds 16 MiB. Crop it locally before importing.');
  const tiff=await fromArrayBuffer(buffer),image=await tiff.getImage(),fd=image.getFileDirectory(),keys=image.getGeoKeys()||{};
  const width=image.getWidth(),height=image.getHeight(),crs=keys.ProjectedCSTypeGeoKey??keys.GeographicTypeGeoKey;
  if(![4326,32634].includes(crs))throw Error(`Unsupported CRS ${crs??'missing'}; use WGS84 EPSG:4326 or EPSG:32634.`);
  if(keys.GTModelTypeGeoKey!==(crs===4326?2:1))throw Error('CRS model type is missing or inconsistent.');
  if((fd.getValue('Orientation')??1)!==1)throw Error('Only top-left TIFF orientation is supported.');
  if(keys.VerticalUnitsGeoKey&&keys.VerticalUnitsGeoKey!==9001)throw Error('Elevation units must be meters.');
  if((crs===32634&&keys.ProjLinearUnitsGeoKey&&keys.ProjLinearUnitsGeoKey!==9001)||(crs===4326&&keys.GeogAngularUnitsGeoKey&&keys.GeogAngularUnitsGeoKey!==9102))throw Error('Unsupported coordinate units.');
  if(width<2||height<2||width*height>MAX_PIXELS)throw Error('Raster must have at least 2 × 2 samples and at most 262144 pixels. Crop locally first.');
  if(image.getSamplesPerPixel()!==1)throw Error('Only single-band rasters are supported.');
  const bits=fd.getValue('BitsPerSample')?.[0]??8,format=fd.getValue('SampleFormat')?.[0]??1,compression=fd.getValue('Compression')??1;
  if(!((format===1||format===2)&&[8,16,32].includes(bits)||format===3&&[32,64].includes(bits)))throw Error('Supported samples: signed/unsigned 8/16/32-bit integers or 32/64-bit floats.');
  if(![1,5,8,32946,32773].includes(compression))throw Error('Supported TIFF compression: none, LZW, Deflate or PackBits.');
  if(fd.getValue('ModelTransformation'))throw Error('Rotated/matrix transforms are unsupported. Export a north-up raster with tiepoint and pixel scale.');
  const tie=fd.getValue('ModelTiepoint'),scale=fd.getValue('ModelPixelScale');
  if(tie?.length!==6||scale?.length!==3||![...tie,...scale].every(Number.isFinite)||scale[0]<=0||scale[1]<=0)throw Error('A single finite tiepoint and positive pixel scale are required.');
  const rasterType=keys.GTRasterTypeGeoKey??1;
  if(![1,2].includes(rasterType))throw Error('Unsupported raster sample placement.');
  const origin=[tie[3]-tie[0]*scale[0],tie[4]+tie[1]*scale[1]],resolution=[scale[0],-scale[1]],offset=rasterType===1?.5:0;
  const noData=image.getGDALNoData(),raw=await image.readRasters({samples:[0],interleave:true,signal});
  let min=Infinity,max=-Infinity,invalid=0;
  const data=Array.from(raw,v=>{if(!Number.isFinite(v)||v===noData){invalid++;return null;}min=Math.min(min,v);max=Math.max(max,v);return v;});
  if(!Number.isFinite(min))throw Error('Raster has no valid samples.');
  const corner=(x,y)=>{const p=[origin[0]+(x+offset)*resolution[0],origin[1]+(y+offset)*resolution[1]];return crs===4326?p:unproject(p);};
  const corners=[corner(0,0),corner(width-1,0),corner(0,height-1),corner(width-1,height-1)];
  const bounds=[Math.min(...corners.map(p=>p[0])),Math.min(...corners.map(p=>p[1])),Math.max(...corners.map(p=>p[0])),Math.max(...corners.map(p=>p[1]))];
  return {asset,width,height,crs,origin,resolution,offset,bits,format,compression,noData:Number.isFinite(noData)?noData:null,data,min,max,invalid,bounds};
}
