// Nodevision/ApplicationSystem/public/VectorDrawing/ActivePathVertexSnap.test.mjs
// These regressions cover committed-vertex eligibility, screen-space tolerance, and closed Line geometry without depending on editor DOM state.
import assert from 'node:assert/strict';
import { findActivePathVertex as snap } from './ActivePathVertexSnap.mjs';
import { createVectorInteraction } from './VectorInteraction.mjs';
import { svgGeometry, geometryMeasurements } from './VectorGeometry.mjs';
import { polygonStatistics } from '../RasterAnalysis/PolygonStatistics.mjs';
const matrix = { a: 1, b: 0, c: 0, d: 1, e: 20, f: 30 };
const points = [{x:0,y:0},{x:50,y:7},{x:80,y:60}];
assert.equal(snap(points,{x:2,y:1},matrix).index,0);
assert.equal(snap(points,points[0],{...matrix,a:0,b:0,c:0,d:0}),null);
assert.equal(snap(points,{x:51,y:8},matrix).index,1);
assert.equal(snap(points,points[2],matrix),null);
assert.equal(snap(points.slice(0,2),points[0],matrix),null);
assert.equal(snap(points,{x:2,y:1},matrix,i=>i!==0),null);
assert.equal(snap(points,{x:150,y:50},matrix),null); // No external-object lookup.
assert.equal(snap(points,{x:19,y:0},matrix),null);
for (const scale of [.25,1,4]) {
  const transform={a:0,b:scale,c:-2*scale,d:0,e:130,f:-70};
  assert.equal(snap(points,{x:-10/scale,y:0},transform).index,0);
  assert.equal(snap(points,{x:19/scale,y:-20/scale},transform),null);
}
const nearby=[{x:0,y:0},{x:10,y:0},{x:40,y:60}];
assert.equal(snap(nearby,{x:5,y:0},matrix).index,0);
assert.equal(snap(nearby,{x:6,y:0},matrix).index,1);
assert.equal(snap([points[0],points[1],points[0]],points[0],matrix),null);
let preview, completed;
const control=createVectorInteraction({preview:g=>preview=g,commit:g=>completed=g,snapVertex:(p,ps)=>snap(ps,p,matrix)});
control.setTool('line');points.forEach(p=>control.down(p));
control.move({x:51,y:8},{shiftKey:true});assert.deepEqual(preview.points.at(-1),points[1]);
control.down({x:51,y:8},{shiftKey:true});assert.equal(control.active,true);assert.deepEqual(control.points.at(-1),points[1]);
const count=control.points.length;control.down(points[1],{shiftKey:true});assert.equal(control.points.length,count);
control.move({x:2,y:1},{shiftKey:true});assert.deepEqual(preview.points.at(-1),points[0]);assert.equal(completed,undefined);
control.move({x:2,y:1},{});assert.deepEqual(preview.points.at(-1),{x:2,y:1});
control.down({x:2,y:1},{shiftKey:true});assert.equal(control.active,false);assert.equal(preview,null);
assert.equal(completed.closed,true);assert.equal(completed.points.length,4);assert.match(svgGeometry(completed).attributes.d,/ Z$/);
const triangle={kind:'line',points:[{x:0,y:0},{x:4,y:0},{x:4,y:3}],closed:true};
assert.equal(geometryMeasurements(triangle).length,12);
const pixels={width:4,height:3,data:new Uint8ClampedArray(48).fill(255)};
assert.equal(polygonStatistics(pixels,[{geometry:triangle}]).selected,polygonStatistics(pixels,[{geometry:{...triangle,kind:'polygon'}}]).selected);
console.log('PASS active-path eligibility, nearest/ties, transformed tolerance, preview/closure, measurements and region coverage');
