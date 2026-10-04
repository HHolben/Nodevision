// Nodevision/ApplicationSystem/public/PanelInstances/Common/Layers/HtmlLayerInvalidation.test.mjs
// These tests verify that row updates reuse membership while structural and identity changes invalidate the cached element list.
import assert from 'node:assert/strict';
import { createHtmlLayerInvalidation } from './HtmlLayerInvalidation.mjs';
const cache=createHtmlLayerInvalidation();let collections=0;
const collect=()=>{collections++;return [collections];};
assert.deepEqual(cache.read(collect),[1]);
assert.equal(cache.mutations([{type:'attributes',attributeName:'style'}]),true);
assert.deepEqual(cache.read(collect),[1]);
assert.equal(cache.mutations([{type:'characterData'}]),false);
assert.deepEqual(cache.read(collect),[1]);
cache.mutations([{type:'attributes',attributeName:'id'}]);assert.deepEqual(cache.read(collect),[2]);
cache.mutations([{type:'childList',addedNodes:[{nodeType:1}],removedNodes:[]}]);assert.deepEqual(cache.read(collect),[3]);
cache.mutations([{type:'attributes',attributeName:'data-nv-layer-ignore'}]);assert.deepEqual(cache.read(collect),[4]);
cache.clear();assert.deepEqual(cache.read(collect),[5]);
