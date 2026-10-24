// Nodevision/ApplicationSystem/public/MetaWorld/Geographic/Fixtures.mjs
// This module creates tiny synthetic georeferenced slope and classification rasters for offline importer and workflow tests without third-party survey downloads.
import { writeArrayBuffer } from '../../vendor/geographic/reader.mjs';
import { project } from './Coordinates.mjs';
export const fixtureCenter=project([23.05,39.35]);
export function rasterFixture({crs=32634,point=false,category=false,noData=false,...metadata}={}) {
  const width=16,height=16,step=crs===4326?.0001:10,origin=crs===4326?[23.0492,39.3508]:[fixtureCenter[0]-80,fixtureCenter[1]+80];
  const data=Array.from({length:width*height},(_,i)=>noData&&i===120?-9999:category?(i%width<8?10:50):100+(i%width)*.5+Math.floor(i/width)*.25);
  return writeArrayBuffer(new Float32Array(data),{width,height,ModelPixelScale:[step,step,0],ModelTiepoint:[0,0,0,...origin,0],GTModelTypeGeoKey:crs===4326?2:1,
    ...(crs===4326?{GeographicTypeGeoKey:4326}:{ProjectedCSTypeGeoKey:crs}),GTRasterTypeGeoKey:point?2:1,SampleFormat:[3],BitsPerSample:[32],GDAL_NODATA:'-9999',...metadata});
}
