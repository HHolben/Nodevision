// Nodevision/ApplicationSystem/public/RasterAnalysis/GrayscaleAnalysis.test.mjs
// These regressions cover inclusive sRGB thresholds, alpha eligibility, pixel-center region composition, and independent analytical and visual layer state.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cacheLuma, thresholdMask, normalizeThresholds, intersectMasks, maskVisualization } from './PixelMasks.mjs';
import { createAnalysisMaskEngine } from './AnalysisMaskEngine.mjs';
import { createAnalysisLayers } from './AnalysisLayers.mjs';
const pixels = { width: 6, height: 1, data: new Uint8ClampedArray([0,0,0,255,255,255,255,255,128,128,128,255,255,0,0,255,128,128,128,0,128,128,128,128]) };
const gray = { id:'g',type:'grayscale',enabled:true,visible:true,config:{lower:0,upper:100,mode:'highlight',color:'#ff0000',opacity:.5} };
const region = {id:'r',type:'region',enabled:true,visible:true,config:{}};
const and = {id:'a',type:'intersection',enabled:true,visible:false,config:{inputs:['g','r']}};
const box = [{operation:'base',geometry:{kind:'rectangle',x:0,y:0,width:6,height:1}}];
test('black/white endpoints, middle gray, colored channels and alpha', () => {
 const cache = cacheLuma(pixels);
 assert.deepEqual([...thresholdMask(cache,0,0)],[1,0,0,0,0,0]);
 assert.deepEqual([...thresholdMask(cache,100,100)],[0,1,0,0,0,0]);
 assert.deepEqual([...thresholdMask(cache,40,60)],[0,0,1,0,0,1]);
 assert.deepEqual([...thresholdMask(cache,20,80)],[0,0,1,1,0,1]);
 assert.equal(cache.values[3],21.26);
 assert.equal(thresholdMask(cache,21.26,21.26)[3],1);
 assert.equal(thresholdMask(cache,21.2601,100)[3],0);
 assert.equal(thresholdMask(cache,128/255*100,128/255*100)[2],1);
});
test('ranges clamp, reject reversed bounds and accept decimals', () => {
 assert.deepEqual(normalizeThresholds(-4,120),{lower:0,upper:100});
 assert.deepEqual(normalizeThresholds(70,20),{lower:70,upper:70});
 assert.deepEqual(normalizeThresholds(15.25,40.75),{lower:15.25,upper:40.75});
});
test('AND mask validates dimensions and missing inputs', () => {
 assert.deepEqual([...intersectMasks([new Uint8Array([1,0,1]),new Uint8Array([1,1,0])])],[1,0,0]);
 assert.equal(intersectMasks([null]),null); assert.equal(intersectMasks([]),null);
 assert.equal(intersectMasks([new Uint8Array(1),new Uint8Array(2)]),null);
});
test('region denominator includes transparent centers; threshold changes preserve geometry', () => {
 const evaluate=createAnalysisMaskEngine(pixels), before=JSON.stringify(box);
 let results=evaluate([gray,region,and],box);
 assert.equal(results[0].eligible,5); assert.equal(results[0].count,5);
 assert.equal(results[2].regionCount,6); assert.equal(results[2].count,5);
 const narrow={...gray,config:{...gray.config,lower:40,upper:60}};
 results=evaluate([narrow,region,and],box);
 assert.equal(results[2].count,2); assert.ok(Math.abs(results[2].regionPercentage - 100/3) < 1e-10);
 assert.equal(JSON.stringify(box),before);
});
test('circle and polygon regions use existing pixel-center scanlines', () => {
 const p={width:4,height:4,data:new Uint8ClampedArray(64).fill(255)}, evaluate=createAnalysisMaskEngine(p);
 const circle=[{geometry:{kind:'circle',cx:2,cy:2,r:1}}];
 assert.equal(evaluate([gray,region,and],circle)[2].count,4);
 const polygon=[{points:[[0,0],[2,0],[2,2],[0,2]]}];
 assert.equal(evaluate([gray,region,and],polygon)[2].count,4);
 assert.equal(evaluate([gray,region,and],[...polygon,{operation:'subtract',points:[[0,0],[1,0],[1,2],[0,2]]}])[2].count,2);
});
test('visibility/order do not change numbers; disabled/removed dependencies invalidate AND', () => {
 const evaluate=createAnalysisMaskEngine(pixels);
 const initial=evaluate([gray,region,and],box);
 const hidden={...gray,visible:false};
 assert.equal(evaluate([and,region,hidden],box)[0].count,initial[2].count);
 assert.equal(evaluate([{...gray,enabled:false},region,and],box)[2].count,null);
 assert.equal(evaluate([region,and],box)[1].count,null);
 assert.equal(evaluate([gray,region,and],[])[2].regionPercentage,null);
});
test('independent grayscale masks can feed one intersection; cycles are unavailable', () => {
 const evaluate=createAnalysisMaskEngine(pixels), second={...gray,id:'g2',config:{lower:40,upper:60}};
 assert.equal(evaluate([gray,second,{...and,config:{inputs:['g','g2']}}],box)[2].count,2);
 assert.equal(evaluate([{...and,config:{inputs:['a']}}],box)[0].count,null);
});
test('three display modes preserve masks and source buffers', () => {
 const mask=thresholdMask(cacheLuma(pixels),0,0), before=pixels.data.slice();
 const high=maskVisualization(mask,pixels,{color:'#ff0000',opacity:.5}); assert.deepEqual([...high.slice(0,4)],[255,0,0,128]);
 const binary=maskVisualization(mask,pixels,{mode:'binary'}); assert.deepEqual([...binary.slice(0,8)],[255,255,255,255,0,0,0,255]);
 const isolate=maskVisualization(mask,pixels,{mode:'isolate'}); assert.equal(isolate[3],0); assert.equal(isolate[7],200);
 assert.deepEqual(pixels.data,before); assert.equal(mask[0],1);
});
test('layer registry preserves IDs, explicit inputs and surviving configurations', () => {
 const store=createAnalysisLayers(), g=store.add('grayscale',{lower:15,upper:40}), combined=store.add('intersection',{inputs:[g.id,'regions']});
 store.move(g.id,1); store.update(g.id,{visible:false}); assert.deepEqual(combined.config.inputs,[g.id,'regions']);
 store.remove(g.id); assert.equal(store.layers.includes(combined),true);
 store.remove('regions'); store.ensureRegion(); assert.equal(store.layers.filter(l=>l.id==='regions').length,1); store.dispose();
});
test('hidden changes and discarded worker replies regenerate visual buffers without changing masks', () => {
 const evaluate=createAnalysisMaskEngine(pixels);
 assert.ok(evaluate([gray],[])[0].rgba);
 assert.equal(evaluate([gray],[])[0].rgba,null);
 assert.ok(evaluate([gray],[],true)[0].rgba);
 const hidden={...gray,visible:false,config:{...gray.config,lower:40,upper:60}};
 assert.equal(evaluate([hidden],[])[0].rgba,null);
 const shown=evaluate([{...hidden,visible:true}],[])[0];
 assert.ok(shown.rgba); assert.equal(shown.count,2);
});
test('region edges follow existing half-open pixel-center convention', () => {
 const evaluate=createAnalysisMaskEngine(pixels);
 const regionBox=[{geometry:{kind:'rectangle',x:.5,y:0,width:2,height:1}}];
 assert.equal(evaluate([region],regionBox)[0].count,2);
 const polygon=[{points:[[.5,0],[2.5,0],[2.5,1],[.5,1]]}];
 assert.equal(evaluate([region],polygon)[0].count,2);
});
test('layer snapshots preserve composition, thresholds, visibility and order', () => {
 const original=createAnalysisLayers(), g=original.add('grayscale',{lower:15.25,upper:40.5,mode:'binary'});
 original.add('intersection',{inputs:[g.id,'regions']}); original.move(g.id,1); original.update(g.id,{visible:false});
 const snapshot=structuredClone(original.layers), restored=createAnalysisLayers(); restored.restore(snapshot);
 assert.deepEqual(restored.layers,snapshot); restored.update(g.id,{config:{lower:20}});
 assert.equal(snapshot.find(l=>l.id===g.id).config.lower,15.25);
});
