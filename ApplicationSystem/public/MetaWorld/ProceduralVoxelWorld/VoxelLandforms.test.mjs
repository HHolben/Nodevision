// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelLandforms.test.mjs
// These regressions verify preserved gentle terrain, eroded regions, connected caverns, anchored formations, underground streaming and height-aware player collision.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../lib/three/three.module.js';
import { createVoxelGenerator } from './VoxelTerrainGenerator.mjs';
import { createProceduralVoxelWorld } from './ProceduralVoxelWorldRuntime.mjs';
import { terrainDefinition as def,voxelMaterialOptions } from './VoxelMaterialTestFixtures.mjs';
import { voxelIndex } from './VoxelCoordinates.mjs';

test('erosion regions coexist with rolling hills, mountains and no generated sunflowers',()=>{
 const g=createVoxelGenerator(def);
 assert.equal(g.getTerrainHeight(0,0),76);assert.equal(g.getTerrainHeight(1632,2816),401);
 assert.equal(g.getLandform(256,768).region.kind,'ravine');
 assert.equal(g.getLandform(256,1280).region.kind,'canyon');
 assert.equal(g.getLandform(2816,768).region.kind,'cliff');
 assert.ok(g.getTerrainHeight(256,1280)<g.getTerrainHeight(160,1280)-40);
 assert.ok(g.features.query([0,0,0],[1024,512,1024]).every(f=>f.species!=='Sunflower'));
});
test('caverns have air, supported ceilings, limestone formations and an open valley passage',()=>{
 const g=createVoxelGenerator(def),r=g.getLandform(256,1280).region;
 const floor=r.floor;
 for(let x=152;x<=256;x++)assert.equal(g.getVoxel(x,floor+8,1280),0,'connected passage');
 const cave=g.getCavern(152,1300);assert.ok(cave.ceiling-cave.floor>=20);
 assert.equal(g.getVoxel(152,floor+18,1300),0);
 assert.notEqual(g.getVoxel(152,cave.ceiling,1300),0);
 let found=0;
 for(let z=1290;z<1325;z++)for(let x=125;x<175;x++){
   const c=g.getCavern(x,z);if(!c?.formation||c.radial>.5)continue;
   assert.equal(g.getVoxel(x,c.floor,z),4);assert.equal(g.getVoxel(x,c.ceiling-1,z),4);
   assert.notEqual(g.getVoxel(x,c.floor-1,z),0);assert.notEqual(g.getVoxel(x,c.ceiling,z),0);
   assert.equal(g.getVoxel(x,Math.floor((c.floor+c.ceiling)/2),z),0);found++;
 }
 assert.ok(found>0,'both stalactites and stalagmites found');
});
test('underground chunk queries are seamless, streamed and reproducible',()=>{
 const g=createVoxelGenerator(def),other=createVoxelGenerator(def);
 const x=152,z=1300,y=190,cell=[x,y,z].map(v=>Math.floor(v/32));
 assert.ok(g.getChunkLevels(cell[0],cell[2]).includes(cell[1]));
 const data=g.generateChunk(...cell);assert.deepEqual(data,other.generateChunk(...cell));
 for(let dz=0;dz<32;dz++)for(let dx=0;dx<32;dx++)for(let dy=0;dy<32;dy++){
   assert.equal(data[voxelIndex(dx,dy,dz)],g.getVoxel(cell[0]*32+dx,cell[1]*32+dy,cell[2]*32+dz));
 }
});
test('players stand inside caverns and collide with ceilings instead of snapping onto the surface',async()=>{
 const root=createProceduralVoxelWorld(THREE,def,[],voxelMaterialOptions),runtime=root.userData.proceduralVoxelRuntime;
 await runtime.ready;
 const x=156,z=1280,c=runtime.generator.getCavern(x,z),collider=root.userData.colliderRef;
 const px=root.position.x+(x+.5)*.25,pz=root.position.z+(z+.5)*.25;
 assert.equal(collider.sampleGroundY(px,pz,c.floor*.25+.6),c.floor*.25);
 assert.ok(collider.sampleGroundY(px,pz)>c.floor*.25+5);
 const feet=c.floor*.25,standing=new THREE.Vector3(px,feet+1.75,pz);
 assert.equal(collider.intersectsPlayer(standing,.2,feet,standing.y),false);
 const head=c.ceiling*.25+.5;
 assert.equal(collider.intersectsPlayer(new THREE.Vector3(px,head,pz),.2,head-1.75,head),true);
 runtime.dispose();
});
