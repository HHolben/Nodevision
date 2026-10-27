// Nodevision/ApplicationSystem/public/MetaWorld/ConstructionCapture/Region.test.mjs
// Pure effective-state capture, bounds, cancellation and GOX cell-axis conversion tests.
import assert from 'node:assert/strict';
import {captureRegion,bounds,equivalent} from './Region.mjs';
import {regionModel,verifyGeometry,toGox,fromGox} from './Geometry.mjs';
const stone={materialId:'limestone',rgba:[120,130,140,255],solid:true,matterState:'solid'},wood={materialId:'PineWood',rgba:[60,30,10,127],solid:true,matterState:'solid'};
const footprint={min:[-2,-1,30],max:[2,2,34]},opinions=new Map([['-1,0,31',null],['0,0,32',wood]]);let yields=0;
const region=await captureRegion({footprint,origin:[-10,2,4],contains:()=>true,opinion:p=>opinions.get(p.join(',')),sample:p=>opinions.has(p.join(','))?opinions.get(p.join(',')):stone,yieldWork:async()=>{yields++;}});
assert.equal(region.cells.length,47);assert.equal(region.temporary,2);assert.equal(region.materials.length,2);assert(verifyGeometry(region,regionModel(region)));for(const p of [[0,0,0],[2,3,4],[-10,-3,-20]])assert.deepEqual(fromGox(toGox(p)),p);assert.deepEqual(toGox([0,0,0]),[0,-1,0]);assert(equivalent(stone,{...stone}));assert(!equivalent(stone,wood));
const empty=await captureRegion({footprint,origin:[0,0,0],contains:()=>true,sample:()=>null});assert.equal(empty.cells.length,0);assert(verifyGeometry(empty,regionModel(empty)));
assert.throws(()=>bounds({min:[0,0,0],max:[0,2,2]}));assert.throws(()=>bounds({min:[0,0,0],max:[512,512,512]}));assert.throws(()=>bounds({min:[.5,0,0],max:[2,2,2]}));
await assert.rejects(()=>captureRegion({footprint,origin:[0,0,0],contains:()=>false,sample:()=>stone}),/outside/);
await assert.rejects(()=>captureRegion({footprint,origin:[0,0,0],contains:()=>true,sample:()=>({...stone,solid:false})}),/solid voxels/);
const abort=new AbortController();await assert.rejects(()=>captureRegion({footprint:{min:[0,0,0],max:[32,32,32]},origin:[0,0,0],contains:()=>true,sample:()=>null,signal:abort.signal,yieldWork:async()=>abort.abort()}),/abort/i);
console.log('Capture bounds, effective terrain, opinions, sparse empty output, axes and cancellation passed');

await assert.rejects(()=>captureRegion({footprint:{min:[0,0,0],max:[41,40,40]},origin:[0,0,0],contains:()=>true,sample:()=>stone,yieldWork:async()=>{}}),/65|occupied|limit/i);
