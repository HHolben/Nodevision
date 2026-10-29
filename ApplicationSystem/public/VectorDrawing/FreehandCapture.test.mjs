import test from 'node:test';
import assert from 'node:assert/strict';
import { appendFreehandPoint, pointerSamples } from './FreehandCapture.mjs';
import { createVectorInteraction } from './VectorInteraction.mjs';
import { createMeasurementEngine } from '../SolderAnalysis/Measurement.mjs';
test('adaptive lossless sampling retains curves, sharp corners and reversals', () => {
  const points = [];
  for (const p of [[0,0],[1,0],[2,0],[2,0],[1,0],[1,1],[1.001,1.001]]) appendFreehandPoint(points,{x:p[0],y:p[1]});
  assert.deepEqual(points.map(p=>[p.x,p.y]),[[0,0],[2,0],[1,0],[1,1],[1.001,1.001]]);
});
test('many samples retain exact enclosed area without smoothing', () => {
  const raw = Array.from({length:10000},(_,i)=>({x:10+8*Math.cos(i*Math.PI/5000),y:10+8*Math.sin(i*Math.PI/5000)}));
  const reduced=[]; raw.forEach(p=>appendFreehandPoint(reduced,p));
  const area=ps=>Math.abs(ps.reduce((a,p,i)=>{const q=ps[(i+1)%ps.length];return a+p.x*q.y-p.y*q.x;},0)/2);
  assert.equal(area(raw),area(reduced));
});
test('coalesced samples include dispatched endpoint and unsupported fallback', () => {
  const event={x:3,getCoalescedEvents:()=>[{x:1},{x:2}]};
  assert.deepEqual(pointerSamples(event).map(p=>p.x),[1,2,3]);
  assert.equal(pointerSamples({}).length,1);
});
for(const pointerType of ['pen','mouse','touch']) test(`${pointerType} stroke uses release endpoint, ignores foreign pointers and measures closed geometry`,()=>{
  let shape;
  const c=createVectorInteraction({preciseFreehand:true,preview(){},commit:g=>{shape=g;}});
  c.setTool('freehand'); const e={pointerId:7,pointerType};
  c.down({x:0,y:0},e);c.move({x:10,y:0},e);c.move({x:99,y:99},{pointerId:8});c.move({x:10,y:10},e);c.up({x:0,y:10},e);
  const region={id:'a',type:'total',model:{closed:true,nodes:shape.points}};
  const result=createMeasurementEngine({width:20,height:20,data:Uint8ClampedArray.from({length:1600},(_,i)=>[10,20,30,255][i%4])}).analyze([region]);
  assert.equal(result.totalArea,100);assert.deepEqual(result.regions[0].rgba,[10,20,30,255]);assert.equal(c.active,false);
});
