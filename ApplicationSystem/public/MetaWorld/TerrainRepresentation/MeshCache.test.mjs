// Nodevision/ApplicationSystem/public/MetaWorld/TerrainRepresentation/MeshCache.test.mjs
// These tests verify bounded CPU-buffer retention, signed-coordinate identity, halo invalidation, stale-generation rejection and disposal independently of scene ownership.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createMeshCache} from './MeshCache.mjs';
const result={positions:[0,0,0,1,0,0,0,1,0],normals:Array(9).fill(0),uvs:Array(6).fill(0),indices:[0,1,2],groups:[{start:0,count:3,materialIndex:0}],solidVoxels:1,faceCount:.5};
test('zero budgets disable retention and invalid budgets fail clearly',()=>{
 for(const budget of [{maxEntries:0},{maxBytes:0}]){const c=createMeshCache(budget);c.put([0,0,0],'polygonal',new Uint8Array(8),result,c.revision);assert.equal(c.snapshot().entries,0);}
 for(const budget of [{maxEntries:-1},{maxEntries:.5},{maxBytes:Infinity},{maxBytes:NaN}])assert.throws(()=>createMeshCache(budget),RangeError);
});
test('LRU keys include signed cells and representation, and count/byte limits remain bounded',()=>{
 const c=createMeshCache({maxEntries:2,maxBytes:1024}),data=new Uint8Array(8),put=cell=>c.put(cell,'polygonal',data,result,c.revision);
 put([-1,0,0]);put([1,0,0]);assert.ok(c.get([-1,0,0],'polygonal'));assert.equal(c.get([-1,0,0],'voxel'),null);put([2,0,0]);assert.equal(c.get([1,0,0],'polygonal'),null);assert.ok(c.get([-1,0,0],'polygonal'));
 for(let x=0;x<100;x++){put([x,0,0]);assert.ok(c.snapshot().bytes<=1024);assert.ok(c.snapshot().entries<=2);}
 c.dispose();assert.equal(c.snapshot().bytes,0);assert.equal(c.snapshot().entries,0);
});
test('edits invalidate both neighboring halos and reject late completed work',()=>{
 const c=createMeshCache(),data=new Uint8Array(8);for(const x of [-1,0,4])c.put([x,0,0],'polygonal',data,result,c.revision);
 const stamp=c.revision;c.invalidate({min:[0,2,2],max:[1,3,3]},'session');
 assert.equal(c.get([-1,0,0],'polygonal'),null);assert.equal(c.get([0,0,0],'polygonal'),null);assert.ok(c.get([4,0,0],'polygonal'));
 c.put([0,0,0],'polygonal',data,result,stamp);assert.equal(c.get([0,0,0],'polygonal'),null);
 c.clear('season');assert.equal(c.snapshot().entries,0);assert.equal(c.snapshot().reasons.season,1);
});
test('byte pressure evicts the least recently used entry and rejects oversized buffers',()=>{
 const c=createMeshCache({maxBytes:200,maxEntries:128}),data=new Uint8Array(8);
 c.put([0,0,0],'polygonal',data,result,c.revision);assert.equal(c.snapshot().entries,1);
 c.put([1,0,0],'polygonal',data,result,c.revision);assert.equal(c.snapshot().entries,1);assert.equal(c.snapshot().evictions,1);
 assert.equal(c.get([0,0,0],'polygonal'),null);assert.ok(c.get([1,0,0],'polygonal'));
 c.put([2,0,0],'polygonal',new Uint8Array(201),result,c.revision);assert.equal(c.get([2,0,0],'polygonal'),null);assert.ok(c.snapshot().bytes<=200);
});
