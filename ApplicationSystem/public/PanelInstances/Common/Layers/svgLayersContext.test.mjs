// Nodevision/ApplicationSystem/public/PanelInstances/Common/Layers/svgLayersContext.test.mjs
// These tests verify declarative Layers availability and active-document provider routing without bootstrapping the application workspace.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { evaluateToolbarItemState } from '../../../panels/toolbarConditions.mjs';
import { getActiveSvgLayersContext, getActiveSvgDocumentPath } from './svgLayersContext.mjs';
const items=JSON.parse(await readFile(new URL('../../../ToolbarJSONfiles/viewToolbar.json',import.meta.url),'utf8'));
const svgCommand=items.find(item=>item.callbackKey==='ViewLayers' && item.conditions?.activeFileIsSvg);
assert.ok(svgCommand);assert.equal(svgCommand.modes,undefined,'SVG availability is document-based, not editor-mode-gated');
for(const currentMode of ['Default','SVG Editing','GraphicalEditing']) {
 assert.equal(evaluateToolbarItemState(svgCommand,{state:{currentMode,activeFileIsSvg:true},attentionSnapshot:{},settings:{}}).visible,true);
}
assert.equal(evaluateToolbarItemState(svgCommand,{state:{currentMode:'Default',activeFileIsSvg:false},attentionSnapshot:{},settings:{}}).visible,false);
const other=items.find(item=>item.callbackKey==='ViewLayers' && item.modes);
assert.ok(other.modes.includes('HTMLviewing'));assert.ok(other.modes.includes('KMLviewerMode'));
const viewer={filePath:'drawing.svg',svgRoot:{isConnected:true},layers:{attachHost(){}}};
const editor={...viewer};
globalThis.window={NodevisionState:{currentMode:'Default',activeFileViewPath:'drawing.svg',activeEditorFilePath:'other.svg'},SVGViewLayersContext:viewer,SVGEditorContext:editor};
assert.equal(getActiveSvgLayersContext(),viewer,'viewer wins over stale editor');
window.NodevisionState={currentMode:'SVG Editing',activeEditorFilePath:'drawing.svg'};
assert.equal(getActiveSvgLayersContext(),editor,'editor wins over retained viewer');
window.NodevisionState={currentMode:'Default',activeFileViewPath:'drawing.png'};
assert.equal(getActiveSvgLayersContext(),null,'non-SVG contexts do not reuse stale SVG providers');
window.NodevisionState={currentMode:'Default',activeFileViewPath:'loading.svg'};
assert.equal(getActiveSvgDocumentPath(),'loading.svg','Layers can open before the iframe finishes loading');
assert.equal(getActiveSvgLayersContext(),null);
delete globalThis.window;
console.log('SVG Layers context and toolbar availability tests passed');
