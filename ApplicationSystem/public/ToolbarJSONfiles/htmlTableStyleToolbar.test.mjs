// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/htmlTableStyleToolbar.test.mjs
// This test verifies the Edit and Styles table styling routes and their contextual visibility without mixing in structural table commands.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {evaluateToolbarItemState} from '../panels/toolbarConditions.mjs';
const read = async name => JSON.parse(await readFile(new URL(name,import.meta.url),'utf8'));
const edit = await read('editToolbar.json'), styles = await read('stylesToolbar.json');
assert.ok(edit.some(item => item.heading === 'Styles' && item.modes.includes('HTMLediting')));
const table = styles.find(item => item.heading === 'Table');
assert.equal(table.toolbarHeading,'HTML Table Styles');
assert.equal(table.preventDropdown,true);
const controls = styles.filter(item => item.parentHeading === table.toolbarHeading);
assert.equal(controls.length,1);
assert.equal(controls[0].script,'htmlTableStyleToolbar.mjs');
for (const item of [table,...controls]) for (const [currentMode,htmlTableSelected,visible] of [
  ['HTMLediting',true,true],['HTMLediting',false,false],['CSVediting',true,false],['SVGediting',true,false],
]) {
  const result = evaluateToolbarItemState(item,{state:{currentMode,htmlTableSelected},settings:{},attentionSnapshot:{}});
  assert.equal(result.visible,visible,`${currentMode}: table selected=${htmlTableSelected}`);
}
