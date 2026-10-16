// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SvgTextModel.test.mjs
// These tests verify that input diffs never split grapheme clusters when browser edits share UTF-16 prefixes or suffixes with the original text.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {boundaries,textDiff} from './SvgTextModel.mjs';
for (const [before,after] of [['Hello World','Hello brave World'],['A👩‍👩‍👧‍👦Z','A👩‍👩‍👧Z'],['é','è'],['😀','😁'],['a',''],['','👩‍🚀'],['one\ntwo','one two']]) {
  test(`grapheme-safe diff ${JSON.stringify(before)} → ${JSON.stringify(after)}`,()=>{
    const {start,end,inserted}=textDiff(before,after);
    assert.ok(boundaries(before).includes(start)); assert.ok(boundaries(before).includes(end));
    assert.equal(before.slice(0,start)+inserted+before.slice(end),after);
  });
}
