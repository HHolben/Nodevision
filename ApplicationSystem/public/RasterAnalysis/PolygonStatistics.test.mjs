// Nodevision/ApplicationSystem/public/RasterAnalysis/PolygonStatistics.test.mjs
// These tests verify original-pixel color measurements, ordered Boolean edits, overlap percentages, and pixel-center boundary rules independently of display scaling.
import test from 'node:test';
import assert from 'node:assert/strict';
import { polygonStatistics } from './PolygonStatistics.mjs';
const box = (x, y, w, h, operation = 'base') => ({ operation, points: [[x,y],[x+w,y],[x+w,y+h],[x,y+h]] });
const pixels = { width: 4, height: 2, data: new Uint8ClampedArray(Array.from({ length: 8 }, (_, i) => i % 4 < 2 ? [255,0,0,255] : [0,0,255,255]).flat()) };
test('base color and area; source remains intact', () => {
  const before = pixels.data.slice(), r = polygonStatistics(pixels, [box(0,0,4,2)]);
  assert.equal(r.selected, 8); assert.deepEqual(r.rgb, [128,0,128]); assert.equal(r.alpha, 1);
  assert.deepEqual(pixels.data, before);
});
test('ordered union/subtraction and secondary overlap union', () => {
  const r = polygonStatistics(pixels, [box(0,0,2,2), box(1,0,3,2,'add'), box(1,0,1,2,'subtract')]);
  assert.equal(r.original,4); assert.equal(r.selected,6); assert.deepEqual(r.rgb,[85,0,170]);
  assert.equal(r.percentage,50); assert.deepEqual(r.overlaps,[2,2]); assert.deepEqual(r.affected,[4,2]);
  assert.equal(r.added,4); assert.equal(r.removed,2);
});
test('subtraction followed by addition restores pixels without double counting', () => {
  const r = polygonStatistics(pixels, [box(0,0,4,2), box(0,0,2,2,'subtract'), box(0,0,2,2,'add')]);
  assert.equal(r.selected,8); assert.equal(r.percentage,50); assert.equal(r.removed,0);
});
test('clipped boundaries, empty and degenerate areas', () => {
  assert.equal(polygonStatistics(pixels,[box(-2,-2,3,3)]).selected,1);
  assert.equal(polygonStatistics(pixels,[box(5,5,2,2)]).percentage,null);
  assert.equal(polygonStatistics(pixels,[box(0,0,4,2),box(0,0,4,2,'subtract')]).rgb,null);
  assert.equal(polygonStatistics(pixels,[box(0,0,0,2)]).selected,0);
});
test('transparent pixels count in area but do not bias RGB', () => {
  const r = polygonStatistics({width:2,height:1,data: new Uint8ClampedArray([255,0,0,255,0,0,255,0])},[box(0,0,2,1)]);
  assert.equal(r.selected,2); assert.deepEqual(r.rgb,[255,0,0]); assert.equal(r.alpha,.5);
});
test('concave and self-intersecting polygons use even-odd pixel centers', () => {
  assert.equal(polygonStatistics(pixels,[{points:[[0,0],[4,0],[4,1],[1,1],[1,2],[0,2]]}]).selected,5);
  assert.equal(polygonStatistics(pixels,[{points:[[0,0],[4,2],[0,2],[4,0]]}]).selected,4);
});
