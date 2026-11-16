// Nodevision/ApplicationSystem/public/MetaWorld/TerrainRepresentation/GroundNormals.test.mjs
// Protect a normal-only correction: exact geometry/materials, deterministic signed seams, source fidelity and conservative preservation of composed volume, liquid and cliff normals. Exercise the actual cached builder and invalidation halo as well as extraction.
import test from 'node:test';
import assert from 'node:assert/strict';
import {surfaceNetSteps} from './SurfaceNets.mjs';
import {naturalGroundNormals} from './GroundNormals.mjs';
import {cachedChunkBuilder} from './CachedChunkBuilder.mjs';
import {createMeshCache} from './MeshCache.mjs';
import {createVoxelGenerator} from '../ProceduralVoxelWorld/VoxelTerrainGenerator.mjs';
import {composeSession} from '../SessionVoxels/TerrainSession.mjs';
import {voxelIndex} from '../ProceduralVoxelWorld/VoxelCoordinates.mjs';
import {drainSteps} from '../ProceduralVoxelWorld/ProgressiveTerrain.mjs';
import {worldLoadingFixture} from '../../../../scripts/world-loading-fixture.mjs';
function field(height=(x,z)=>48+Math.floor(.18*x+.05*z),options={}){
 const source={getTerrainHeight:height,getWaterTop:()=>options.water||0,getCavern:()=>options.cave||null};
 source.getVoxel=(x,y,z)=>y<0?0:options.cave&&y>8&&y<12?0:y<height(x,z)?(options.material?.(x,z)||1):y<(options.water||0)?5:0;
 const get=options.compose?((x,y,z)=>options.compose(x,y,z,source.getVoxel(x,y,z))):source.getVoxel;
 return {base:source,getRenderVoxel:get};
}
function extract(g,cell=[0,1,0],smooth=true){
 const data=new Uint16Array(32768);for(let z=0;z<32;z++)for(let y=0;y<32;y++)for(let x=0;x<32;x++)data[voxelIndex(x,y,z)]=g.getRenderVoxel(cell[0]*32+x,cell[1]*32+y,cell[2]*32+z);
 return drainSteps(surfaceNetSteps(data,cell,g.getRenderVoxel,smooth?naturalGroundNormals(g,cell):null));
}
function exactGeometry(a,b){for(const key of ['positions','uvs','indices','groups','solidVoxels','faceCount'])assert.deepEqual(a[key],b[key],key);}
function protectedNormals(g,cell,a,b){
 let protectedCount=0;
 for(let i=0;i<a.positions.length;i+=3){
  const q=[0,1,2].map(k=>Math.floor(a.positions[i+k]*4-.5)+cell[k]*32);let changed=false;
  for(let z=0;z<2;z++)for(let y=0;y<2;y++)for(let x=0;x<2;x++){const p=q.map((v,k)=>v+[x,y,z][k]);if(g.getRenderVoxel(...p)!==g.base.getVoxel(...p))changed=true;}
  if(changed||a.normals[i+1]<.5){assert.deepEqual(b.normals.slice(i,i+3),a.normals.slice(i,i+3));protectedCount++;}
 }
 return protectedCount;
}
test('natural slope normals improve without moving a single vertex or changing triangle/material ownership',()=>{
 const g=field(),a=extract(g,undefined,false),b=extract(g);exactGeometry(a,b);
 const error=r=>{let sum=0,n=0;for(let i=0;i<r.normals.length;i+=3)if(r.normals[i+1]>=.5){sum+=Math.acos(Math.max(-1,Math.min(1,(-.18*r.normals[i]+r.normals[i+1]-.05*r.normals[i+2])/Math.hypot(.18,1,.05))));n++;}return sum/n;};
 assert.ok(error(b)<error(a)*.2);assert.notDeepEqual(a.normals,b.normals);protectedNormals(g,[0,1,0],a,b);
 for(let i=0;i<b.normals.length;i+=3)assert.ok(Math.abs(Math.hypot(...b.normals.slice(i,i+3))-1)<1e-10);
 assert.deepEqual(extract(g).normals,b.normals,'deterministic generation');
});
test('globally aligned gradients share exact normal samples on negative and positive chunk seams',()=>{
 const g=field((x,z)=>48+Math.floor(3*Math.sin(x/50)+2*Math.cos(z/70)));
 for(const x of [-2,-1,0,1200]){
  const cells=[[x,1,-1],[x+1,1,-1]],maps=cells.map(cell=>{const r=extract(g,cell);return new Map(Array.from({length:r.positions.length/3},(_,i)=>{const p=[0,1,2].map(k=>r.positions[i*3+k]+cell[k]*8);return [p.join(','),r.normals.slice(i*3,i*3+3)];}).filter(([p])=>Math.abs(Number(p.split(',')[0])-(x+1)*8)<.13));});
  assert.ok(maps[0].size>10);assert.deepEqual(maps[0],maps[1]);
 }
});
test('cave/tunnel/overhang composition, excavation, added voxels and material changes retain protected normals',()=>{
 const shapes=[
  (x,y,z,v)=>x>=12&&x<20&&z>=8&&z<20&&y>=45?0:v,
  (x,y,z,v)=>x>=12&&x<20&&z>=8&&z<20&&y>=48&&y<57?3:v,
  (x,y,z,v)=>x>=8&&x<24&&z>=10&&z<22&&y>40&&y<49?0:v,
  (x,y,z,v)=>x>=8&&x<24&&z>=10&&z<22&&y>=56&&y<58?3:v,
  (x,y,z,v)=>x===15&&z===15&&y===50?0:v,
  (x,y,z,v)=>x>=12&&x<20&&z>=8&&z<20&&v?4:v
 ];
 for(const compose of shapes){const g=field(undefined,{compose}),a=extract(g,undefined,false),b=extract(g);exactGeometry(a,b);assert.ok(protectedNormals(g,[0,1,0],a,b)>0);}
});
test('an excavation crossing a chunk seam retains exact duplicate normals and protected wall shading',()=>{
 const g=field(undefined,{compose:(x,y,z,v)=>x>=30&&x<35&&z>=12&&z<20&&y>=45?0:v}),cells=[[0,1,0],[1,1,0]],maps=[];
 for(const cell of cells){
  const a=extract(g,cell,false),b=extract(g,cell);exactGeometry(a,b);assert.ok(protectedNormals(g,cell,a,b)>0);
  maps.push(new Map(Array.from({length:b.positions.length/3},(_,i)=>{const p=[0,1,2].map(k=>b.positions[i*3+k]+cell[k]*8);return [p.join(','),b.normals.slice(i*3,i*3+3)];}).filter(([p])=>Math.abs(Number(p.split(',')[0])-8)<.13)));
 }
 assert.ok(maps[0].size>20);assert.deepEqual(maps[0],maps[1]);
});
test('liquid surfaces, source caves, true cliffs, NoData neighborhoods and unsupported sources retain binary normals',()=>{
 for(const g of [field(()=>48,{water:56}),field(()=>48,{cave:{floor:8,ceiling:12}}),field(x=>x<16?40:56)]){
  const a=extract(g,undefined,false),b=extract(g);exactGeometry(a,b);assert.deepEqual(b.normals,a.normals);
 }
 assert.equal(naturalGroundNormals({}),null);
 const g=field((x,z)=>x<0||z<0?0:48+Math.floor(.18*x)),a=extract(g,undefined,false),b=extract(g);exactGeometry(a,b);
 for(let i=0;i<a.positions.length;i+=3)if(a.positions[i]<1||a.positions[i+2]<1)assert.deepEqual(b.normals.slice(i,i+3),a.normals.slice(i,i+3));
});
test('natural material boundaries preserve canonical groups while sharing the same smooth normal field',()=>{
 const g=field(undefined,{material:x=>x<16?1:3}),a=extract(g,undefined,false),b=extract(g);exactGeometry(a,b);assert.equal(b.groups.length,2);assert.notDeepEqual(a.normals,b.normals);
});
test('actual finite map/hybrid and geographic generators retain exact source geometry and saved definitions',()=>{
 const standard={id:'map',size:[64,64,64],position:[0,0,0],voxelSize:.25,generator:{seed:42},generation:{vegetation:false,caves:false,water:false},terrainMap:{outside:'empty'}};
 const sample={sample:(x,z)=>({covered:x>=0&&z>=0&&x<64&&z<64,elevation:12+x*.14+z*.08,biome:'temperate',material:'grass'})};
 const html=worldLoadingFixture(),world=JSON.parse(html.match(/<script[^>]*id="nodevision-metaworld"[^>]*>([\s\S]*?)<\/script>/i)[1]),geo=world.objects.find(o=>o.terrainSource==='geographic');
 for(const def of [{...standard,terrainSource:'map'},{...standard,terrainSource:'hybrid'},{...geo,generation:{...geo.generation,vegetation:false}}]){
  const saved=JSON.stringify(def),g=createVoxelGenerator(def,def.terrainSource==='geographic'?null:sample),h=g.base.getTerrainHeight(16,16),cell=[0,Math.floor(h/32),0],a=extract(g,cell,false),b=extract(g,cell);exactGeometry(a,b);assert.equal(JSON.stringify(def),saved);
 }
});
test('cached production builder stores corrected normals and regenerates after session edits',()=>{
 const def={id:'test',size:[64,64,64],position:[0,0,0],voxelSize:.25,generator:{seed:42},generation:{vegetation:false,caves:false,water:false}};
 const g=composeSession(createVoxelGenerator(def)),cache=createMeshCache(),finish=(cell,result)=>({result,residentBytes:0});
 const build=cachedChunkBuilder(g,cache,finish,()=> 'polygonal',()=> 'smooth-natural'),cell=[0,Math.floor(g.getTerrainHeight(8,8)/32),0];
 const first=drainSteps(build(cell)),again=drainSteps(build(cell));assert.equal(cache.snapshot().hits,1);assert.deepEqual(Array.from(again.result.normals),Array.from(first.result.normals,Math.fround));
 const point=[15,g.getTerrainHeight(15,15)-1,15];g.bindSession({session:{count:1,opinion:p=>p.every((v,i)=>v===point[i])?null:undefined},toCell:p=>p,material:()=>3});
 cache.invalidate({min:point,max:point.map(v=>v+1)},'session');const edited=drainSteps(build(cell));assert.notDeepEqual(edited.data,first.data);assert.ok(cache.snapshot().builds>=2);
 exactGeometry(extract(g,cell,false),edited.result);assert.ok(protectedNormals(g,cell,extract(g,cell,false),edited.result)>0);
});
test('horizontal source-normal support invalidates nearby cached chunks without expanding the vertical halo',()=>{
 const cache=createMeshCache(),r={positions:[0,0,0],normals:[0,1,0],uvs:[0,0],indices:[],groups:[]};
 for(const cell of [[0,0,0],[0,1,0],[-2,0,0]])cache.put(cell,'polygonal',new Uint8Array(1),r,cache.revision);
 cache.invalidate({min:[35,4,4],max:[36,5,5]},'source');assert.equal(cache.get([0,0,0],'polygonal'),null);assert.ok(cache.get([0,1,0],'polygonal'));assert.ok(cache.get([-2,0,0],'polygonal'));
});
