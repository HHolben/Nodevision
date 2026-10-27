import assert from 'node:assert/strict';
import {createConstructionEditLayer} from './Layer.mjs';
const stone={materialId:'stone',rgba:[1,2,3,255],solid:true},wood={materialId:'wood',rgba:[5,6,7,127],solid:true};
const baseline=new Map([['-2,0,3',stone],['1,2,6',stone]]),edit=createConstructionEditLayer({baseline});
edit.layer.begin();edit.edit('paint',[[-2,0,3]],wood);edit.edit('erase',[[1,2,6]]);edit.layer.finish();assert.equal(edit.layer.count,2);edit.undo();assert.equal(edit.layer.count,0);edit.redo();assert.equal(edit.layer.effective([-2,0,3]).materialId,'wood');assert.equal(edit.layer.effective([1,2,6]),null);
edit.edit('brush',[[0,20,0],[20,0,0]],wood);assert.equal(edit.layer.effective([0,20,0]).materialId,'wood');edit.undo();
assert.throws(()=>edit.edit('paint',[[-2,0,3]],{...wood,solid:false}),/solid/);edit.edit('revert',[[-2,0,3]]);assert.deepEqual(edit.layer.effective([-2,0,3]),stone);edit.reset();assert.equal(edit.layer.count,0);assert.equal(edit.undo(),false);
edit.batch([{at:[0,1,4],value:wood},{at:[1,2,6],value:null}]);assert.equal(edit.layer.count,2);edit.undo();assert.equal(edit.layer.count,0);edit.dispose();
console.log('Local isolation, boundaries, atomic batches, material restrictions and stroke history passed');
