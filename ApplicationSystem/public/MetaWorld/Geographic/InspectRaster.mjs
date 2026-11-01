// Nodevision/ApplicationSystem/public/MetaWorld/Geographic/InspectRaster.mjs
// This module inspects GeoTIFF metadata without decoding raster pixels. It distinguishes visual imagery from numeric raster candidates and reports compatibility with the existing terrain importer.
// Metadata-only inspection, including visual TIFFs that cannot supply elevation.
import {rasterMetadata} from './RasterMetadata.mjs';
export function inspectRaster(image){
 const fd=image.getFileDirectory(),keys=image.getGeoKeys()||{},bands=image.getSamplesPerPixel();
 const report={width:image.getWidth(),height:image.getHeight(),bands,bits:Array.from(fd.getValue('BitsPerSample')||[8]),sampleFormat:Array.from(fd.getValue('SampleFormat')||[1]),photometric:fd.getValue('PhotometricInterpretation'),compression:fd.getValue('Compression')??1,crs:keys.ProjectedCSTypeGeoKey??keys.GeographicTypeGeoKey??null,geoKeys:keys,noData:image.getGDALNoData(),verticalUnits:keys.VerticalUnitsGeoKey===9001?'meters':keys.VerticalUnitsGeoKey??'not encoded',tiled:image.isTiled,block:[image.getTileWidth(),image.getTileHeight()]};
 try{report.bounds=Array.from(image.getBoundingBox());report.resolution=Array.from(image.getResolution());}catch(error){report.georeferencingError=error.message;}
 report.classification=bands>=3&&report.photometric===2?'RGB visualization; not elevation or land cover':bands===1?'single-band numeric raster; verify elevation provenance':'multiband raster; purpose unverified';
 try{const meta=rasterMetadata(image);report.terrainImport=true;report.geographicBounds=meta.bounds;}catch(error){report.terrainImport=false;report.importDiagnostic=error.message;}
 return report;
}
