// Nodevision/ApplicationSystem/public/SolderAnalysis/Measurement.test.mjs
// This module verifies native pixel measurements, geometry validation, analysis persistence, and portable reports for complete and incomplete analyses.
import assert from 'node:assert/strict';
import { alphabetic, labelsFor, assignParent, createMeasurementEngine, prepareRegion, measureContours } from './Measurement.mjs';
import { parseAnalysis, serializeAnalysis, reportFilename } from './Document.mjs';
import { generateReport } from './Report.mjs';
const rect = (id, type, x, y, w, h, parentId) => ({ id, type, parentId, points: [[x,y],[x+w,y],[x+w,y+h],[x,y+h]] });
const image = (width=20, height=20) => ({ width, height, data: Uint8ClampedArray.from({ length: width*height*4 }, (_, i) => [10,20,30,255][i%4]) });
const base = rect('a','total',0,0,10,10);
const state = regions => ({ width:20,height:20,source:{name:'sample.JPEG',dataUrl:'data:image/jpeg;base64,/9j/'},regions,layers:['total','void'].map(id=>({id,type:'region',config:{},visible:true,locked:false})),settings:{fillRule:'evenodd'} });
test('alphabetical labels beyond Z and numeric labels per stable parent', () => {
  assert.deepEqual([0,25,26,27,51,52,701,702].map(alphabetic), ['A','Z','AA','AB','AZ','BA','ZZ','AAA']);
  const regions = [base,rect('b','total',12,0,5,5),rect('v1','void',1,1,2,2,'a'),rect('v2','void',2,2,2,2,'a'),rect('v3','void',13,1,1,1,'b')];
  assert.deepEqual(labelsFor(regions), {a:'A',b:'B',v1:'A-1',v2:'A-2',v3:'B-1'});
  assert.equal(labelsFor(regions.slice(1)).b,'A'); assert.equal(regions[1].id,'b');
});
test('native rectangular area and exact mean RGBA, noninteger half-open pixel centers', () => {
  const engine=createMeasurementEngine(image());
  assert.deepEqual(engine.analyze([base]).regions[0].rgba,[10,20,30,255]);
  assert.equal(engine.analyze([base]).regions[0].area,100);
  assert.equal(engine.analyze([rect('a','total',.5,.5,2,2)]).regions[0].area,4);
});
test('means retain precision against known variable pixels', () => {
  const im=image(2,1); im.data.set([0,2,4,255,1,5,9,255]);
  assert.deepEqual(createMeasurementEngine(im).analyze([rect('a','total',0,0,2,1)]).regions[0].rgba,[.5,3.5,6.5,255]);
});
test('concave noncircular geometry', () => {
  const r={id:'a',type:'total',points:[[0,0],[4,0],[4,2],[2,2],[2,4],[0,4]]};
  assert.equal(createMeasurementEngine(image()).analyze([r]).totalArea,12);
});
test('unique containment assignment and no ambiguous assignment', () => {
  const child=rect('v','void',1,1,2,2);
  assert.equal(assignParent(child,[base],20,20),'a');
  assert.equal(assignParent(child,[base,{...base,id:'b'}],20,20),null);
  assert.equal(assignParent(rect('v','void',9,1,2,2),[base],20,20),null);
});
test('overlapping voids count once, overall percentage is area weighted', () => {
  const regions=[base,rect('b','total',10,0,5,10),rect('v','void',0,0,5,5,'a'),rect('w','void',2,0,5,5,'a'),rect('x','void',10,0,5,5,'b')];
  const r=createMeasurementEngine(image()).analyze(regions);
  assert.deepEqual(r.warnings,[]); assert.equal(r.voidArea,60); assert.equal(r.overallPercentage,40);
  assert.equal(r.regions[0].voidPercentage,35); assert.equal(r.regions[1].voidPercentage,50);
});
test('vector containment catches excursions smaller than a pixel and overlapping parents', () => {
  const e=createMeasurementEngine(image());
  assert.match(e.analyze([base,rect('v','void',9,1,1.1,1,'a')]).warnings.join(),/outside/);
  assert.match(e.analyze([base,rect('b','total',9.9,0,5,5)]).warnings.join(),/overlaps/);
  assert.match(e.analyze([base,rect('v','void',19,1,2,2,'a')]).warnings.join(),/outside the image/);
  assert.match(e.analyze([base,rect('v','void',1,1,1,1,'missing')]).warnings.join(),/parent/);
});
test('empty and incomplete paths, self intersection and zero area produce report warnings', () => {
  const e=createMeasurementEngine(image()); assert.ok(e.analyze([]).warnings.length);
  for(const points of [[],[[0,0],[1,1]],[[0,0],[4,4],[0,4],[4,0]],[[0,0],[1,0],[2,0]]]) {
    const r=e.analyze([{id:'a',type:'total',points}]); assert.ok(r.warnings.length); assert.ok(generateReport(state([]),r).includes('Report status: incomplete or needs review'));
  }
});
test('Bezier curves use existing path contour machinery', () => {
  const r={id:'a',type:'total',model:{closed:true,nodes:[{x:0,y:0,outHandle:{x:2,y:0}},{x:4,y:0,inHandle:{x:2,y:0}},{x:4,y:4},{x:0,y:4}]}};
  assert.equal(createMeasurementEngine(image()).analyze([r]).totalArea,16);
  assert.throws(()=>prepareRegion({...r,model:{...r.model,closed:false}},20,20));
});
test('save/reopen retains stable IDs, relationships, geometry, visibility and lock state', () => {
  const s=state([base,rect('v','void',1,1,2,2,'a')]);s.layers[1].locked=true;s.layers[0].visible=false;
  const restored=parseAnalysis(serializeAnalysis(s)); assert.deepEqual(restored.regions,JSON.parse(JSON.stringify(s.regions)));assert.deepEqual(restored.layers,s.layers);
  assert.throws(()=>parseAnalysis(serializeAnalysis({...s,regions:[base,base]})),/ID/);
});
test('report filename and four portable sections, fourth has only blue unlabeled outlines', () => {
  assert.equal(reportFilename('folder/sample.jpg'),'folder/sample.html');assert.equal(reportFilename('sample.JPEG'),'sample.html');assert.throws(()=>reportFilename('sample.png'));
  const s=state([base,rect('v','void',1,1,2,2,'a')]),original=s.source.dataUrl;
  const html=generateReport(s,createMeasurementEngine(image()).analyze(s.regions),new Date('2026-01-01'));
  for(const id of ['original','annotated','measurements','void-only']) assert.ok(html.includes(`id="${id}"`));
  const fourth=html.split('id="void-only"')[1];assert.ok(fourth.includes('#80DFFF'));assert.ok(!fourth.includes('#FF0000'));assert.ok(!fourth.includes('<text'));assert.ok(!fourth.includes('fill="red"'));assert.equal(s.source.dataUrl,original);assert.ok(html.includes(original));
  s.source.name='<script>.jpg';assert.ok(!generateReport(s,createMeasurementEngine(image()).analyze(s.regions)).includes('<script>'));
});
test('large image and many small regions cache only changed masks', () => {
  const im=image(2048,2048),e=createMeasurementEngine(im),regions=Array.from({length:100},(_,i)=>rect(String(i),'total',(i%10)*100,Math.floor(i/10)*100,10,10));
  const first=e.analyze(regions);assert.equal(first.totalArea,10000);assert.equal(first.computations,100);
  assert.equal(e.analyze(regions).computations,100);
  regions[0]=rect('0','total',0,0,11,10);assert.equal(e.analyze(regions).computations,101);
});

test('compound contours use even-odd holes and boundary-adjacent parents do not overlap', () => {
  const contours=[{points:[[0,0],[10,0],[10,10],[0,10]]},{points:[[2,2],[8,2],[8,8],[2,8]]}];
  assert.equal(measureContours(image(),contours).area,64);
  const r=createMeasurementEngine(image()).analyze([base,rect('b','total',10,0,10,10)]);
  assert.deepEqual(r.warnings,[]); assert.equal(r.totalArea,200);
});
test('duplicate blue masks count once and reparenting does not recompute pixels', () => {
  const e=createMeasurementEngine(image()),regions=[base,rect('v','void',1,1,2,2,'a'),rect('w','void',1,1,2,2,'a')];
  const a=e.analyze(regions); assert.equal(a.voidArea,4); assert.equal(a.overallPercentage,4);
  regions[1].parentId='missing'; const b=e.analyze(regions); assert.equal(b.computations,a.computations);assert.ok(b.warnings.length);
  regions[1].parentId='a';assert.deepEqual(e.analyze(regions).warnings,[]);
});

test('reports retain warnings, orphan voids and invalid regions without blocking export', () => {
  const s=state([base,rect('v','void',1,1,2,2,'missing'),{id:'bad',type:'total',points:[]}]);
  const html=generateReport(s,createMeasurementEngine(image()).analyze(s.regions));
  assert.ok(html.includes('select exactly one parent'));
  assert.ok(html.includes('Incomplete or invalid polygon'));
  assert.ok(html.includes('Unassigned / unavailable'));
  assert.ok(!html.includes('undefined'));
  const pending=generateReport(s,null);
  assert.ok(pending.includes('Measurements are pending or unavailable'));
  assert.ok(!pending.includes('undefined'));
});
