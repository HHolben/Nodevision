// Nodevision/ApplicationSystem/public/MetaWorld/Geographic/Geographic.test.mjs
// These tests exercise the actual GeoTIFF decoder, coordinate normalization, sampling precedence, bounded chunk generation, and existing runtime persistence using synthetic offline rasters.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as THREE from '../../lib/three/three.module.js';
import { rasterFixture,fixtureCenter } from './Fixtures.mjs';
import { decodeRaster } from './RasterImport.mjs';
import { sampleRaster,project,unproject } from './Coordinates.mjs';
import { prepareGeographic,geographicPoint } from './Definition.mjs';
import { definitionFromVoxelForm,voxelWorldForm } from '../ProceduralVoxelWorld/VoxelAuthoringDefinition.mjs';
import { validateVoxelWorld } from '../ProceduralVoxelWorld/VoxelWorldDefinition.mjs';
import { createVoxelGenerator } from '../ProceduralVoxelWorld/VoxelTerrainGenerator.mjs';
import { createProceduralVoxelWorld } from '../ProceduralVoxelWorld/ProceduralVoxelWorldRuntime.mjs';
import { voxelMaterialOptions } from '../ProceduralVoxelWorld/VoxelMaterialTestFixtures.mjs';
import { voxelIndex } from '../ProceduralVoxelWorld/VoxelCoordinates.mjs';
const decode=async(options={})=>{const bytes=rasterFixture(options);return decodeRaster(bytes,{path:'/Notebook/dem.tif',sha256:createHash('sha256').update(new Uint8Array(bytes)).digest('hex')});};
const b0=unproject([fixtureCenter[0]-25,fixtureCenter[1]-25]),b1=unproject([fixtureCenter[0]+25,fixtureCenter[1]+25]),crop=[...b0,...b1];
const recipe=async(extra={})=>prepareGeographic({elevation:await decode(),crop,...extra});
const definition=g=>validateVoxelWorld(definitionFromVoxelForm({...voxelWorldForm(),seed:'pelion',terrainSource:'geographic',geographic:g,vegetation:true}));
test('GeoTIFF metadata, pixel placement and bilinear slope',async()=>{
  const r=await decode(),p=[r.origin[0]+25,r.origin[1]-25];
  assert.equal(r.width,16);assert.equal(r.crs,32634);assert.equal(r.offset,.5);assert.equal(sampleRaster(r,...p),101.5);
  assert.equal(sampleRaster(r,p[0]+5,p[1]-5),101.875);
  const point=await decode({point:true});assert.equal(sampleRaster(point,...p),101.875);
  assert.equal(sampleRaster(r,r.origin[0],r.origin[1]),null);
});
test('EPSG:4326 and UTM align in local meters; categorical nearest neighbor',async()=>{
  const geographic=await decode({crs:4326}),p=project([geographic.origin[0]+2.5*.0001,geographic.origin[1]-2.5*.0001]);
  assert.ok(Math.abs(sampleRaster(geographic,...p)-101.5)<1e-6);
  assert.ok(Math.abs(unproject(project([23.05,39.35]))[0]-23.05)<1e-9);
  const r=await decode({category:true}),east=r.origin[0]+80,north=r.origin[1]-40;
  assert.equal(sampleRaster(r,east-.01,north,true),10);assert.equal(sampleRaster(r,east+.01,north,true),50);assert.equal(sampleRaster(r,r.origin[0],r.origin[1],true),10);
});
test('NoData and unsupported/oversized metadata fail cleanly',async()=>{
  const r=await decode({noData:true});assert.equal(r.invalid,1);
  assert.throws(()=>prepareGeographic({elevation:r,crop}),/NoData/);
  assert.equal(sampleRaster(r,r.origin[0]+85,r.origin[1]-75),null);
  await assert.rejects(decode({crs:3857}),/Unsupported CRS/);
  await assert.rejects(decode({Compression:7}),/compression/);
  await assert.rejects(decodeRaster(new ArrayBuffer(16*1024*1024+1),{}),/16 MiB/);
  assert.throws(()=>prepareGeographic({elevation:r,crop:[22,39,23,40]}),/2 km/);
  await assert.rejects(decode({width:513,height:512}),/262144/);
  assert.throws(()=>prepareGeographic({elevation:{...r,invalid:0,min:0,max:1000},crop}),/256 m/);
});
test('known slope drives voxels; chunk edges and saved seed agree',async()=>{
  const g=await recipe(),def=definition(g),a=createVoxelGenerator(def),b=createVoxelGenerator(JSON.parse(JSON.stringify(def)));
  for(const x of [30,31,32,33,80]){
    const expected=Math.floor((sampleRaster(g.elevation,...geographicPoint(g,x,64))+g.verticalOffset)*4);
    assert.equal(a.getTerrainHeight(x,64),expected);
    const data=a.generateChunk(Math.floor(x/32),0,2);
    for(let y=0;y<32;y++)assert.equal(data[voxelIndex(x%32,y,0)],a.getVoxel(x,y,64));
  }
  assert.deepEqual(a.generateChunk(1,1,1),b.generateChunk(1,1,1));
  assert.ok(a.features.query([0,0,0],a.dimensions).length>0,'fixture exercises actual vegetation');
  assert.deepEqual(a.features.query([0,0,0],a.dimensions).map(f=>[f.id,f.origin]),b.features.query([0,0,0],b.dimensions).map(f=>[f.id,f.origin]));
});
test('KML regions win over landcover in stable last-polygon order; holes stay empty',async()=>{
  const ring=[[fixtureCenter[0]-80,fixtureCenter[1]-80],[fixtureCenter[0]+80,fixtureCenter[1]-80],[fixtureCenter[0]+80,fixtureCenter[1]+80],[fixtureCenter[0]-80,fixtureCenter[1]+80],[fixtureCenter[0]-80,fixtureCenter[1]-80]];
  const regions=[{id:'0',biome:'phrygana',rings:[ring]},{id:'1',biome:'snowy-pine-forest',rings:[ring]}];
  let g=await recipe({landcover:await decode({category:true}),regions});assert.equal(createVoxelGenerator(definition(g)).getBiome(64,64),'snowy-pine-forest');
  const hole=ring.map(p=>p.map((v,i)=>fixtureCenter[i]+(v-fixtureCenter[i])*.1));
  g=await recipe({regions:[{id:'0',biome:'temperate',rings:[ring,hole]}],boundary:'0'});
  const a=createVoxelGenerator(definition(g));assert.equal(a.getTerrainHeight(Math.floor(g.size[0]*2),Math.floor(g.size[2]*2)),0);
});
test('runtime save/reload preserves geographic assets, placement, authored metadata and path grading',async()=>{
  const def=definition(await recipe());def.position=[12,7,30];def.userNotes='Greek alphabet';
  const root=createProceduralVoxelWorld(THREE,def,[],voxelMaterialOptions),runtime=root.userData.proceduralVoxelRuntime;
  assert.equal(await runtime.ready,true);root.position.x=14;
  const saved=JSON.parse(JSON.stringify(runtime.serialize()));assert.equal(saved.position[0],14);assert.deepEqual(saved.geographic,def.geographic);assert.equal(saved.userNotes,'Greek alphabet');
  const reload=createVoxelGenerator(validateVoxelWorld(saved));assert.equal(reload.getTerrainHeight(64,64),runtime.generator.getTerrainHeight(64,64));
  reload.setPathConstraints([{def:{id:'path',visible:true,width:4,transitionWidth:0,terrainInteraction:'grade'},bounds:{minX:0,maxX:100,minZ:0,maxZ:100},heightAt:()=>10}]);
  assert.equal(reload.getTerrainHeight(64,64),12);runtime.dispose();
});
