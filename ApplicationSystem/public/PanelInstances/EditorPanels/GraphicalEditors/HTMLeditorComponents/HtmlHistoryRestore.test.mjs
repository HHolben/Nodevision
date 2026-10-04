// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlHistoryRestore.test.mjs
// These tests distinguish identity-preserving text and element replay from presentation-sensitive changes without requiring a full DOM or a browser history implementation.
import assert from 'node:assert/strict';
import { htmlHistoryNeedsPresentation,createHtmlHistoryRestore } from './HtmlHistoryRestore.mjs';
const plain={nodeType:1,closest:()=>null,matches:()=>false,querySelector:()=>null};
const image={nodeType:1,closest:()=>image,matches:()=>true};
assert.equal(htmlHistoryNeedsPresentation([{kind:'text',node:{nodeType:3,parentElement:plain}}]),false);
assert.equal(htmlHistoryNeedsPresentation([{kind:'attribute',node:plain,name:'style'}]),false);
assert.equal(htmlHistoryNeedsPresentation([{kind:'children',node:plain,added:[plain],removed:[]}]),false);
assert.equal(htmlHistoryNeedsPresentation([{kind:'children',node:plain,added:[],removed:[image]}]),true);
assert.equal(htmlHistoryNeedsPresentation([{kind:'attribute',node:image,name:'src'}]),true);
let calls=0;const restore=createHtmlHistoryRestore(()=>calls++);
restore({patches:[]});assert.equal(calls,0);
restore({});assert.equal(calls,1,'unknown restore keeps conservative presentation behavior');

const state = { activeHtmlImageContext: { element: image } };
const root = { ownerDocument: { defaultView: { NodevisionState: state } }, contains: node => node === image };
const restoreSelected = createHtmlHistoryRestore(() => calls++, root);
restoreSelected({ patches: [] });
assert.equal(calls, 2, 'selected media context must be cleared even for plain replay');
state.activeHtmlImageContext.element = {};
restoreSelected({ patches: [] });
assert.equal(calls, 2, 'another editor media selection does not trigger restoration');
