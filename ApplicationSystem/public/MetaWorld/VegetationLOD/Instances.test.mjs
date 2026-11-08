// Nodevision/ApplicationSystem/public/MetaWorld/VegetationLOD/Instances.test.mjs
// These tests exercise the installed proxy matrices and residency masks after box merging. They verify exact world bounds, material ownership, restored instances, and shared resource lifetime across detailed chunk handoffs.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../lib/three/three.module.js';
import {vegetationInstances} from './Instances.mjs';
test('merged instances preserve bounds, counted cells and independent chunk handoff',()=>{
 const geometry=new THREE.BoxGeometry(),material=new THREE.MeshBasicMaterial();
 const cells=[0,2,4,6].map(x=>({p:[x,0,-2],id:'tree',chunk:x<4?'a':'b',material:1}));
 const tile=vegetationInstances(THREE,{cells,step:2},geometry,[material],-3),mesh=tile.group.children[0];
 assert.equal(mesh.count,2);assert.equal(mesh.material,material);
 const matrix=new THREE.Matrix4(),bounds=new THREE.Box3();
 mesh.getMatrixAt(0,matrix);bounds.setFromBufferAttribute(geometry.attributes.position).applyMatrix4(matrix);
 assert.deepEqual(bounds.min.toArray(),[0,-3,-.5]);assert.deepEqual(bounds.max.toArray(),[1,-2.5,0]);
 assert.deepEqual(tile.mask(()=>false),{cells:4,boxes:2,ids:new Set(['tree'])});
 assert.deepEqual(tile.mask(key=>key==='a'),{cells:2,boxes:1,ids:new Set(['tree'])});
 mesh.getMatrixAt(0,matrix);assert.equal(matrix.determinant(),0);
 mesh.getMatrixAt(1,matrix);assert.ok(matrix.determinant()>0);
 assert.equal(tile.mask(()=>true).cells,0);assert.equal(mesh.visible,false);
 assert.equal(tile.mask(()=>false).cells,4);assert.equal(mesh.visible,true);
 mesh.getMatrixAt(0,matrix);assert.ok(matrix.determinant()>0);
 let released=false;geometry.addEventListener('dispose',()=>{released=true;});tile.dispose();assert.equal(released,false);
 geometry.dispose();material.dispose();
});
