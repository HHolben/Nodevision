// Nodevision/ApplicationSystem/public/MetaWorld/Geographic/CropImport.test.mjs
// These regressions exercise crop-specific support, exact snapshot alignment, version-one compatibility, and cancellation with synthetic rasters decoded by the maintained GeoTIFF library.
import test from 'node:test';
import assert from 'node:assert/strict';
import { fromArrayBuffer,writeArrayBuffer } from '../../vendor/geographic/reader.mjs';
import { importCrop,readWindow } from './WindowImport.mjs';
import { finishRecipe } from './RecipeV2.mjs';
import { rasterMetadata } from './RasterMetadata.mjs';
import { cropSupport } from './CropSupport.mjs';
import { rectangle,geographicBounds,rasterToMeters } from './CropGeometry.mjs';
import { sampleRaster,project } from './Coordinates.mjs';
import { packRaster } from './Snapshot.mjs';
import { geographicRegenerationPosition } from './Placement.mjs';
import { ImportJobs } from './ImportJobs.mjs';
import { rasterFixture } from './Fixtures.mjs';
import { decodeRaster } from './RasterImport.mjs';
import { prepareGeographic,geographicPoint } from './Definition.mjs';
import { definitionFromVoxelForm,voxelWorldForm } from '../ProceduralVoxelWorld/VoxelAuthoringDefinition.mjs';
import { validateVoxelWorld } from '../ProceduralVoxelWorld/VoxelWorldDefinition.mjs';
import { createVoxelGenerator } from '../ProceduralVoxelWorld/VoxelTerrainGenerator.mjs';
import { drainSteps } from '../ProceduralVoxelWorld/ProgressiveTerrain.mjs';
const asset={path:'/Notebook/synthetic.tif',sha256:'0'.repeat(64)};
async function source({crs=32634,point=false,edit=()=>{}}={}){
  const data=Float32Array.from({length:64*64},(_,i)=>100+i%64*.1+Math.floor(i/64)*.05);edit(data);
  const origin=crs===32634?project([23.05,39.35]):[23.05,39.35],step=crs===32634?10:.0001;
  const bytes=writeArrayBuffer(data,{width:64,height:64,ModelPixelScale:[step,step,0],ModelTiepoint:[0,0,0,...origin,0],GTModelTypeGeoKey:crs===4326?2:1,...(crs===4326?{GeographicTypeGeoKey:4326}:{ProjectedCSTypeGeoKey:32634}),GTRasterTypeGeoKey:point?2:1,GDAL_NODATA:'-9999'});
  const image=await(await fromArrayBuffer(bytes)).getImage();return {image,data,bytes,meta:rasterMetadata(image),asset:async()=>asset,stats:()=>({})};
}
function settings(s,box=[10,10,20,20]){
  const ring=rectangle(box)[0][0].map(p=>rasterToMeters(s.meta,p));
  return {crop:geographicBounds([[ring]]),regions:[{id:'crop',name:'crop',biome:'',rings:[ring]}],boundary:'crop',horizontalScale:1,verticalExaggeration:1};
}
test('distant summit and NoData do not affect crop range or compact snapshot',async()=>{
  const s=await source({edit:d=>{d[0]=9000;d[d.length-1]=-9999;}}),config=settings(s),imported=await importCrop(s,config),g=finishRecipe(imported,config);
  assert.ok(g.range.max<110);assert.ok(g.elevation.width<15);assert.equal(g.version,2);assert.equal(g.elevation.data,undefined);assert.ok(g.savedBytes<s.data.length*8);
  const def=validateVoxelWorld(definitionFromVoxelForm({...voxelWorldForm(),terrainSource:'geographic',geographic:g}));
  const original=await decodeRaster(s.bytes,asset),runtime=createVoxelGenerator(def),reload=createVoxelGenerator(JSON.parse(JSON.stringify(def)));
  for(let x=20;x<200;x+=20){const p=geographicPoint(g,x,80);assert.ok(Math.abs(sampleRaster(original,...p)-sampleRaster(g.elevation,...p))<1e-9);assert.equal(runtime.getTerrainHeight(x,80),reload.getTerrainHeight(x,80));}
  assert.deepEqual(runtime.generateChunk(1,0,1),drainSteps(runtime.generateChunkSteps(1,0,1)));
});
test('NoData on required support produces a location and crop diagnostic',async()=>{
  const s=await source({edit:d=>{d[15*64+15]=-9999;}});
  await assert.rejects(importCrop(s,settings(s)),e=>e.diagnostic.code==='NODATA'&&e.message.includes('Adjust the crop'));
});
test('hole interiors ignore NoData, while hole boundary interpolation still requires it',()=>{
  const r={width:12,height:12},outer=rectangle([1,1,10,10])[0][0],hole=rectangle([3,3,8,8])[0][0],data=new Float64Array(144).fill(100);
  data[5*12+5]=NaN;assert.equal(cropSupport(r,[[outer,hole]],data).max,100);
  const invalid=new Float64Array(144).fill(100);invalid[3*12+3]=NaN;assert.throws(()=>cropSupport(r,[[outer,hole]],invalid),/NoData/);
});
test('sample-center zero weights and PixelIsArea/Point windows retain exact alignment in both CRSs',async()=>{
  for(const crs of [4326,32634])for(const point of [false,true]){
    const s=await source({crs,point}),a=await readWindow(s.image,s.meta,[10,10,22,22]),b=await readWindow(s.image,s.meta,[20,10,32,22]);
    const imported=await importCrop(s,settings(s));assert.ok(imported.elevation.width<15);
    assert.ok(Math.abs(sampleRaster(imported.elevation,...rasterToMeters(s.meta,[15,15]))-s.data[15*64+15])<1e-6);
    const p=rasterToMeters(s.meta,[20,15.5]);assert.ok(Math.abs(sampleRaster(a.snapshot,...p)-sampleRaster(b.snapshot,...p))<1e-9);
    assert.ok(Math.abs(sampleRaster(a.snapshot,...rasterToMeters(s.meta,[12,12]))-s.data[12*64+12])<1e-6);
  }
  const r=packRaster({width:2,height:2,crs:32634,origin:[0,0],resolution:[1,-1],offset:0},[12,NaN,NaN,NaN]);
  assert.equal(sampleRaster(r,0,0),12);assert.equal(sampleRaster(r,.1,-.1),null);
});
test('coverage clipping requires an explicit action and never expands generated bounds to halo',async()=>{
  const s=await source(),config=settings(s,[-10,-10,10,10]);
  await assert.rejects(importCrop(s,config),e=>e.diagnostic.code==='COVERAGE');
  const imported=await importCrop(s,{...config,fitCoverage:true}),g=finishRecipe(imported,{...config,fitCoverage:true});
  assert.ok(g.geographicSize[0]<=101);assert.ok(imported.plan.window[2]<=12);
});
test('version-one recipes retain their original placement and terrain',async()=>{
  const r=await decodeRaster(rasterFixture(),asset),b=r.bounds,crop=[b[0]+.0002,b[1]+.0002,b[2]-.0002,b[3]-.0002],g=prepareGeographic({elevation:r,crop});
  const def=definitionFromVoxelForm({...voxelWorldForm(),seed:'legacy',terrainSource:'geographic',geographic:g});def.position=[17,8,-14];
  const saved=JSON.parse(JSON.stringify(def)),a=createVoxelGenerator(def),bgen=createVoxelGenerator(validateVoxelWorld(saved));
  assert.equal(saved.geographic.version,1);assert.deepEqual(saved.position,[17,8,-14]);assert.deepEqual(a.generateChunk(1,1,1),bgen.generateChunk(1,1,1));
});
test('cancelled and superseded worker replies cannot commit stale previews',async()=>{
  const workers=[],jobs=new ImportJobs(()=>{const w={postMessage(){},terminate(){this.terminated=true;}};workers.push(w);return w;});
  const first=jobs.read({});jobs.cancel();await assert.rejects(first,/cancelled/);
  const second=jobs.read({});workers[0].onmessage({data:{result:'stale'}});workers[1].onmessage({data:{result:'current'}});assert.equal(await second,'current');assert.ok(workers[0].terminated);
});

test('explicit recropping retains the previous geographic anchor for authored content',()=>{
  const current={terrainSource:'geographic',position:[40,8,70],geographic:{origin:[500000,4350000]}};
  const next={geographic:{version:2,origin:[500100,4349800],horizontalScale:1}};
  assert.deepEqual(geographicRegenerationPosition(current,next),[140,8,270]);
  assert.deepEqual(geographicRegenerationPosition({...current,terrainSource:'procedural'},next),current.position);
});
