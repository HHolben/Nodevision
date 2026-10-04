// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlToolbarPublishing.test.mjs
// These tests verify that equivalent selection patches avoid rebuilds while real selection changes and external state changes remain observable.
import assert from 'node:assert/strict';
import { createHtmlToolbarPublisher } from './HtmlToolbarPublishing.mjs';
let state = {}, calls = 0;
const publish = createHtmlToolbarPublisher(patch => { calls++; Object.assign(state, patch); }, () => state);
assert.equal(publish({ htmlImageSelected: false }), true);
assert.equal(publish({ htmlImageSelected: false }), false);
assert.equal(publish({ htmlImageSelected: true, htmlImagePath: 'a.png' }), true);
assert.equal(publish({ htmlImageSelected: true, htmlImagePath: 'b.png' }), true);
state = { htmlImageSelected: false };
assert.equal(publish({ htmlImageSelected: true, htmlImagePath: 'b.png' }), true);
assert.equal(calls, 4);
