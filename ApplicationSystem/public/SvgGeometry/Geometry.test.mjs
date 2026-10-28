// Nodevision/ApplicationSystem/public/SvgGeometry/Geometry.test.mjs
// These tests verify curve integration, compound winding semantics, coordinate units, and inspector menu availability without a browser. Browser integration tests separately exercise live SVG DOM geometry and workspace panel lifecycles.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { pathContours } from './PathContours.mjs';
import { filledRegion, regionMeasurements } from './FilledRegion.mjs';
import { documentUnits } from './Coordinates.mjs';
import { evaluateToolbarItemState } from '../panels/toolbarConditions.mjs';
const identity={a:1,b:0,c:0,d:1,e:0,f:0};
const measurements=(d,rule)=>regionMeasurements(filledRegion(pathContours(d,identity),rule));
test('cubic enclosed area agrees with analytic integral',()=>{
 const result=measurements('M0 0C0 10 10 10 10 0Z');
 assert.ok(Math.abs(result.area-60)<0.0001);assert.ok(Math.abs(result.perimeter-30)<0.0001);
});
test('winding cancellation and hole perimeter',()=>{
 const d='M0 0h20v20h-20z M5 5h10v10h-10z';
 assert.deepEqual(measurements(d,'nonzero'),{area:400,perimeter:80});
 assert.deepEqual(measurements(d,'evenodd'),{area:300,perimeter:120});
 assert.deepEqual(measurements('M0 0h20v20h-20z M5 5v10h10v-10z','nonzero'),{area:300,perimeter:120});
});
test('opposite overlapping winding does not subtract nonoverlapping geometry',()=>{
 assert.deepEqual(measurements('M0 0h10v10h-10z M5 0v10h10v-10z'),{area:100,perimeter:60});
});
test('self-intersections fail explicitly',()=>{
 assert.throws(()=>measurements('M0 0L10 10L0 10L10 0Z'),/Self-intersecting/);
});
test('translated area avoids cancellation at large offsets',()=>{
 const contours=pathContours('M0 0h20v10h-20z',{...identity,e:1e9,f:-1e9});
 assert.equal(regionMeasurements(filledRegion(contours)).area,200);
});
test('physical scaling requires reliable absolute dimensions',()=>{
 const root=attrs=>({getAttribute:name=>attrs[name],viewBox:{baseVal:{width:200,height:100}}});
 assert.equal(documentUnits(root({width:'100px',height:'50px'})).name,'SVG user units');
 assert.equal(documentUnits(root({width:'100mm',height:'5cm'})).x,0.5);
 const anisotropic=documentUnits(root({width:'100mm',height:'100mm',preserveAspectRatio:'none'}));
 assert.equal(anisotropic.x,0.5);assert.equal(anisotropic.y,1);
});
test('SVG menu works in editor and viewer and uses shared panel identity',async()=>{
 const items=JSON.parse(await readFile(new URL('../ToolbarJSONfiles/viewToolbar.json',import.meta.url),'utf8'));
 const item=items.find(item=>item.heading==='Geometry Inspector');
 assert.equal(item.panelTemplate,'GeometryInspectorPanel');assert.equal(item.replaceActive,false);
 for(const currentMode of ['Default','SVG Editing','GraphicalEditing'])assert.equal(evaluateToolbarItemState(item,{state:{currentMode,activeFileIsSvg:true},attentionSnapshot:{},settings:{}}).visible,true);
 assert.equal(evaluateToolbarItemState(item,{state:{activeFileIsSvg:false},attentionSnapshot:{},settings:{}}).visible,false);
});
