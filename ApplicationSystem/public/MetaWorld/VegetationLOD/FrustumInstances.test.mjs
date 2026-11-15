// Nodevision/ApplicationSystem/public/MetaWorld/VegetationLOD/FrustumInstances.test.mjs
// These tests verify conservative instance culling, stationary buffer reuse, camera reversal and ownership restoration with real Three.js matrices. Full regional bounds remain independent of the last culled draw range so another camera can restore all eligible boxes.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../lib/three/three.module.js';
import {vegetationInstances} from './Instances.mjs';
test('offscreen boxes stop submitting, unchanged views avoid uploads, and turning restores eligible owners',()=>{
 const geometry=new THREE.BoxGeometry(),material=new THREE.MeshBasicMaterial(),cells=[{p:[0,0,-40],id:'front',chunk:'front',material:1},{p:[0,0,40],id:'back',chunk:'back',material:1}];
 const tile=vegetationInstances(THREE,{cells,step:2},geometry,[material],0),mesh=tile.group.children[0],camera=new THREE.PerspectiveCamera(60,1,.1,100);
 tile.group.updateMatrixWorld(true);camera.updateMatrixWorld(true);const radius=mesh.boundingSphere.radius;
 tile.prepareView(camera);assert.equal(mesh.count,1);assert.equal(mesh.boundingSphere.radius,radius);
 const matrix=new THREE.Matrix4();mesh.getMatrixAt(0,matrix);assert.ok(matrix.elements[14]<0);
 const version=mesh.instanceMatrix.version;tile.prepareView(camera);assert.equal(mesh.instanceMatrix.version,version);
 camera.lookAt(0,0,10);camera.updateMatrixWorld(true);tile.prepareView(camera);assert.equal(mesh.count,1);mesh.getMatrixAt(0,matrix);assert.ok(matrix.elements[14]>0);
 tile.mask(key=>key==='back');tile.prepareView(camera);assert.equal(mesh.count,0);assert.equal(mesh.visible,true,'zero last-view count must not prevent a different camera restoring instances');
 camera.lookAt(0,0,-10);camera.updateMatrixWorld(true);tile.prepareView(camera);assert.equal(mesh.count,1);
 tile.mask(()=>false);tile.prepareView(camera);assert.equal(mesh.count,1);assert.equal(tile.mask(()=>false).ids.size,2,'availability is independent of the camera');
 mesh.frustumCulled=false;tile.prepareView(camera);assert.equal(mesh.count,2);mesh.frustumCulled=true;
 material.onBeforeCompile=()=>{};tile.prepareView(camera);assert.equal(mesh.count,2);delete material.onBeforeCompile;
 tile.prepareView(null);assert.equal(mesh.count,2,'unknown or stereo views retain all owners');const allVersion=mesh.instanceMatrix.version;tile.prepareView(null);assert.equal(mesh.instanceMatrix.version,allVersion);
 tile.dispose();geometry.dispose();material.dispose();
});
test('transformed boxes and partially intersecting conservative bounds remain visible',()=>{
 const geometry=new THREE.BoxGeometry(),material=new THREE.MeshBasicMaterial(),tile=vegetationInstances(THREE,{cells:[{p:[0,0,0],size:[16,16,16],id:'large',chunk:'a',material:1}],step:2},geometry,[material],0);
 tile.group.position.set(5,-2,-10);tile.group.scale.set(2,1,3);tile.group.rotation.y=.4;tile.group.updateMatrixWorld(true);
 const camera=new THREE.PerspectiveCamera(60,1,.1,100);camera.updateMatrixWorld(true);const mesh=tile.group.children[0];tile.prepareView(camera);assert.equal(mesh.count,1);
 tile.dispose();geometry.dispose();material.dispose();
});
