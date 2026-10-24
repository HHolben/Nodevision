// Nodevision/ApplicationSystem/public/MetaWorld/Geographic/RasterMetadata.mjs
// This module validates GeoTIFF metadata without decoding pixels and estimates the total touched strip or tile allocation before a crop read.
import { GEO_BUDGETS as B } from './Budgets.mjs';
import { sourceCoverage,geographicBounds } from './CropGeometry.mjs';
export function rasterMetadata(image) {
  const fd=image.getFileDirectory(),keys=image.getGeoKeys()||{};
  const width=image.getWidth(),height=image.getHeight(),crs=keys.ProjectedCSTypeGeoKey??keys.GeographicTypeGeoKey;
  if(![4326,32634].includes(crs))throw Error(`Unsupported CRS ${crs??'missing'}; use WGS84 EPSG:4326 or EPSG:32634.`);
  if(keys.GTModelTypeGeoKey!==(crs===4326?2:1))throw Error('CRS model type is missing or inconsistent.');
  if((fd.getValue('Orientation')??1)!==1)throw Error('Only top-left TIFF orientation is supported.');
  if(keys.VerticalUnitsGeoKey&&keys.VerticalUnitsGeoKey!==9001)throw Error('Elevation units must be meters.');
  if((crs===32634&&keys.ProjLinearUnitsGeoKey&&keys.ProjLinearUnitsGeoKey!==9001)||(crs===4326&&keys.GeogAngularUnitsGeoKey&&keys.GeogAngularUnitsGeoKey!==9102))throw Error('Unsupported coordinate units.');
  if(width<2||height<2||!Number.isSafeInteger(width*height))throw Error('Raster must have at least 2 × 2 samples and safely addressable dimensions.');
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
  const result={width,height,crs,origin,resolution,offset,bits,format,compression,noData:image.getGDALNoData(),tileWidth:image.getTileWidth(),tileHeight:image.getTileHeight(),tiled:image.isTiled};
  return {...result,bounds:geographicBounds(sourceCoverage(result))};
}
export async function windowBudget(image,meta,window,retainedBytes=0,categorical=false) {
  const [x0,y0,x1,y1]=window,n=(x1-x0)*(y1-y0),w=meta.tileWidth,h=meta.tileHeight;
  if(n>B.samples||n<(categorical?1:4))throw Error(`Decoded crop has ${n} samples; budget is ${B.samples} per raster. Reduce crop or use a coarser source.`);
  if(!Number.isSafeInteger(w*h)||w<1||h<1)throw Error('Invalid TIFF strip/tile dimensions.');
  const fd=image.getFileDirectory(),columns=Math.ceil(meta.width/w);let blocks=0,decodedBytes=0,encodedBytes=0;
  for(let y=Math.floor(y0/h);y<Math.ceil(y1/h);y++)for(let x=Math.floor(x0/w);x<Math.ceil(x1/w);x++){
    blocks++;decodedBytes+=w*Math.min(h,meta.height-y*h)*meta.bits/8;
    encodedBytes+=await fd.loadValueIndexed(meta.tiled?'TileByteCounts':'StripByteCounts',y*columns+x);
    if(decodedBytes>B.blockBytes||encodedBytes>B.transferBytes)throw Error('The touched TIFF strips/tiles exceed the 64 MiB decode/access budget. A small crop can still require a large strip; use a tiled or shorter-strip source.');
  }
  // Include empirical JavaScript/clipping/GC headroom; this is working memory, not process RSS.
  const peakBytes=retainedBytes+decodedBytes*2+encodedBytes*2+n*640+64*1024**2;
  if(peakBytes>B.peakBytes)throw Error('Estimated peak import memory exceeds 256 MiB. Reduce crop or use smaller TIFF tiles/strips.');
  return {samples:n,blocks,decodedBytes,encodedBytes,peakBytes,snapshotBytes:Math.ceil(n*8/3)*4};
}
