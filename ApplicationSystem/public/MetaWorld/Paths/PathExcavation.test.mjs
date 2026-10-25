// Nodevision/ApplicationSystem/public/MetaWorld/Paths/PathExcavation.test.mjs
// Tests directional non-destructive excavation, occupancy-based support, bridge clipping, water preservation and representation-independent deterministic chunk generation.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../lib/three/three.module.js';
import {validatePath} from './PathDefinition.mjs';
import {samplePath,ribbonForPath} from './PathGeometry.mjs';
import {createPathTerrainField} from './PathTerrainField.mjs';
import {pathSurface} from './PathSurface.mjs';
import {clearanceAt,pathVoxelMaterial} from './PathClearance.mjs';
import {createVoxelGenerator} from '../ProceduralVoxelWorld/VoxelTerrainGenerator.mjs';
import {drainSteps} from '../ProceduralVoxelWorld/ProgressiveTerrain.mjs';
import {surfaceNetSteps} from '../TerrainRepresentation/SurfaceNets.mjs';
import {voxelIndex} from '../ProceduralVoxelWorld/VoxelCoordinates.mjs';
const dimensions=[128,128,128],definition={position:[0,0,0]},road=(patch={})=>{const def=validatePath({id:'road',terrainInteraction:'excavate',interpolation:'straight',elevationMode:'authored',controlPoints:[[1,4,8],[25,4,8]],width:3,upperClearance:3,...patch});return ribbonForPath(def,samplePath(THREE,def));};
function field(sample,height=32){
  const base={dimensions,getVoxel:(x,y,z)=>x>=0&&z>=0&&y>=0&&x<128&&y<128&&z<128?sample(x,y,z):0,getTerrainHeight:()=>height,getSolidHeight:()=>height,getWaterTop:()=>0,clearColumns(){},generateChunk(){return new Uint8Array(32768);}};
  return {base,terrain:createPathTerrainField(base,definition)};
}
test('flat road replaces surface only, hides its plane and restores upstream edits on deletion',()=>{
  const {terrain,base}=field((x,y,z)=>y<16?(x===4&&y===2?4:y===15?1:3):0,16),path=road();terrain.setPathConstraints([path]);
  assert.equal(terrain.getVoxel(16,15,32),11);assert.equal(terrain.getVoxel(16,14,32),3);assert.equal(terrain.getVoxel(4,2,32),4);
  assert.equal(terrain.getSolidHeight(16,32,20),16);
  const surface=pathSurface(path,(x,z)=>terrain.pathSupport(path,x,z));assert.equal(surface.triangles.length,0);assert.ok(Number.isNaN(surface.heightAt(4,8)));
  terrain.setPathConstraints([]);assert.equal(terrain.getVoxel(16,15,32),1);assert.equal(terrain.getVoxel(4,2,32),base.getVoxel(4,2,32));
});
test('mountain tunnel has bounded ceiling, independent sides and a preserved floor over lower clearance',()=>{
  const {terrain}=field((_x,y)=>y<64?3:0,64),path=road({leftClearance:1,rightClearance:.25,lowerClearance:1});terrain.setPathConstraints([path]);
  assert.equal(terrain.getVoxel(16,15,32),11);assert.equal(terrain.getVoxel(16,16,32),0);assert.equal(terrain.getVoxel(16,27,32),0);assert.equal(terrain.getVoxel(16,28,32),3);
  assert.equal(terrain.getVoxel(16,14,32),0);assert.equal(terrain.getVoxel(16,11,32),3);
  assert.equal(terrain.getVoxel(16,20,40),0,'left is +Z for a +X path');assert.equal(terrain.getVoxel(16,20,23),3,'same distance on right remains rock');
  assert.equal(terrain.getSolidHeight(16,32,18),16);assert.equal(terrain.getSolidHeight(16,32,128),64);
  const moved=road({position:[0,0,10]});terrain.setPathConstraints([moved]);assert.equal(terrain.getVoxel(16,20,32),3);
});
test('ravine and caves remain unsupported despite distant ground, with navigable clipped bridges',()=>{
  const {terrain}=field((x,y)=>y<(x>=32&&x<64?4:16)?3:0,16),path=road();terrain.setPathConstraints([path]);
  assert.equal(terrain.getVoxel(40,15,32),0);assert.equal(terrain.getVoxel(40,8,32),0);assert.equal(terrain.getVoxel(16,15,32),11);
  assert.equal(terrain.pathSupport(path,10,8),null);const surface=pathSurface(path,(x,z)=>terrain.pathSupport(path,x,z));
  assert.equal(surface.heightAt(10,8),4);assert.ok(Number.isNaN(surface.heightAt(4,8)));assert.ok(surface.triangles.length>0&&surface.triangles.length<20000);
  const cave=field((_x,y)=>y<8||y>=20&&y<50?3:0,50);cave.terrain.setPathConstraints([path]);assert.equal(cave.terrain.pathSupport(path,10,8),null);
});
test('zero clearances do not excavate extra terrain and liquids are not silently drained or replaced',()=>{
  const {terrain}=field((_x,y)=>y<64?3:0,64),path=road({upperClearance:0,lowerClearance:0});terrain.setPathConstraints([path]);
  assert.equal(terrain.getVoxel(16,16,32),3);assert.equal(terrain.getVoxel(16,14,32),3);assert.equal(terrain.getVoxel(16,15,32),11);
  const wet=field((_x,y)=>y<12?3:y<32?5:0,12);wet.terrain.setPathConstraints([road()]);assert.equal(wet.terrain.getVoxel(16,15,32),5);assert.equal(wet.terrain.getVoxel(16,20,32),5);assert.equal(wet.terrain.pathSupport(road(),4,8),null);
  assert.throws(()=>road({upperClearance:-1}));assert.throws(()=>road({leftClearance:Infinity}));assert.throws(()=>road({surfaceMaterial:'unavailable-material'}));
});
test('asymmetric envelopes rotate with curved tangents and survive serialization',()=>{
  const path=road({interpolation:'smooth',controlPoints:[[2,4,2],[12,4,2],[18,4,12]],width:2,leftClearance:2,rightClearance:0});
  const i=Math.floor(path.samples.length*.65),p=path.samples[i],a=path.samples[i-1],b=path.samples[i+1],dx=b[0]-a[0],dz=b[2]-a[2],len=Math.hypot(dx,dz);
  assert.ok(clearanceAt(path,p[0]-dz/len*2,p[2]+dx/len*2));assert.equal(clearanceAt(path,p[0]+dz/len*2,p[2]-dx/len*2),null);
  assert.deepEqual(validatePath(JSON.parse(JSON.stringify(path.def))),path.def);
});
test('real generator applies paths identically to scalar, chunk and progressive occupancy and polygon extraction',()=>{
  const def={type:'procedural-voxel-world',id:'world',position:[0,0,0],size:[32,32,32],voxelSize:.25,generator:{id:'nodevision-terrain-v1',version:1,seed:42},chunks:{voxelsPerAxis:32,loadRadius:1},generation:{vegetation:false,water:false,caves:false}};
  const g=createVoxelGenerator(def),path=road({controlPoints:[[1,2,8],[25,2,8]],width:3});g.setPathConstraints([path]);
  for(const cell of [[2,0,1],[0,0,1],[1,0,1]]){const data=g.generateChunk(...cell);assert.deepEqual(data,drainSteps(g.generateChunkSteps(...cell)));
    for(const x of [0,16,31])for(const y of [7,8,19,20])assert.equal(data[voxelIndex(x,y,0)],g.getVoxel(cell[0]*32+x,y,32));
    const net=drainSteps(surfaceNetSteps(data,cell,g.getVoxel));assert.ok(net.groups.some(group=>group.materialIndex===pathVoxelMaterial('gravel')-1));
  }
  const restored=createVoxelGenerator(JSON.parse(JSON.stringify(def)));restored.setPathConstraints([road(JSON.parse(JSON.stringify(path.def)))]);assert.deepEqual(g.generateChunk(1,0,1),restored.generateChunk(1,0,1));
});
test('overlapping operations are stable by path ID and deleting one retains the other',()=>{
  const {terrain}=field((_x,y)=>y<64?3:0,64),a=road({id:'a'}),b=road({id:'b',controlPoints:[[1,4,18],[25,4,18]],surfaceMaterial:'stone'});
  terrain.setPathConstraints([a,b]);const before=terrain.generateChunk(0,0,2);terrain.setPathConstraints([b,a]);assert.deepEqual(before,terrain.generateChunk(0,0,2));
  terrain.setPathConstraints([b]);assert.equal(terrain.getVoxel(16,20,32),3);assert.equal(terrain.getVoxel(16,20,72),0);assert.equal(terrain.getVoxel(16,15,72),3);
});

test('partial width retains only unsupported bridge surface and follows translated voxel origins',()=>{
  const {terrain}=field((_x,y,z)=>y<(z<32?16:4)?3:0,16),path=road();terrain.setPathConstraints([path]);
  const surface=pathSurface(path,(x,z)=>terrain.pathSupport(path,x,z));
  assert.ok(Number.isNaN(surface.heightAt(10,7)));assert.equal(surface.heightAt(10,9),4);assert.equal(terrain.getVoxel(40,15,36),0);
  terrain.setPathOrigin([-3.125,7,2.125]);const shifted=road({position:[-3.125,7,2.125]});terrain.setPathConstraints([shifted]);
  const moved=pathSurface(shifted,(x,z)=>terrain.pathSupport(shifted,x,z),[-3.125,7,2.125]);assert.equal(moved.heightAt(6.875,11.125),11);assert.ok(Number.isNaN(moved.heightAt(6.875,9.125)));
});
test('another path removing a roadbed makes its remaining surface unsupported',()=>{
  const {terrain}=field((_x,y)=>y<64?3:0,64),a=road({id:'a'}),b=road({id:'b',controlPoints:[[1,3,8],[25,3,8]],upperClearance:3});
  terrain.setPathConstraints([a,b]);assert.equal(terrain.getVoxel(40,15,32),0);assert.equal(terrain.pathSupport(a,10,8),null);
  const before=Array.from({length:32},(_,y)=>terrain.getVoxel(40,y,32));terrain.setPathConstraints([b,a]);assert.deepEqual(Array.from({length:32},(_,y)=>terrain.getVoxel(40,y,32)),before);
  terrain.setPathConstraints([a]);assert.equal(terrain.getVoxel(40,15,32),11);assert.ok(terrain.pathSupport(a,10,8));
});

test('supported curved road suppresses corner surfaces as well as straight segments',()=>{
  const {terrain}=field((_x,y)=>y<16?3:0,16),path=road({interpolation:'smooth',controlPoints:[[2,4,8],[12,4,8],[18,4,18]],width:3});terrain.setPathConstraints([path]);
  const surface=pathSurface(path,(x,z)=>terrain.pathSupport(path,x,z));
  for(const tri of surface.triangles){const center=tri.map(i=>surface.vertices[i]).reduce((a,p)=>a.map((n,j)=>n+p[j]/3),[0,0,0]);assert.ok(Number.isNaN(path.heightAt(Math.floor(center[0]*4)/4+.125,Math.floor(center[2]*4)/4+.125)),JSON.stringify({center,points:tri.map(i=>surface.vertices[i]),support:terrain.pathSupport(path,center[0],center[2])}));}
});
