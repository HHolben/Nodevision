import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../lib/three/three.module.js';
import {mobPlacement} from './AimPlacement.mjs';
function fixture(){const camera=new THREE.PerspectiveCamera(60,1,.1,2000);camera.position.set(3,4,5);return {THREE,camera,objects:[],colliders:[]};}
function near(a,b){assert(new THREE.Vector3(...a).distanceTo(new THREE.Vector3(...b))<1e-6,`${a} ≈ ${b}`);}
test('empty sky places exactly one meter along the active camera world direction',()=>{
 const ctx=fixture(),parent=new THREE.Group();parent.position.set(10,2,8);parent.rotation.y=.6;parent.add(ctx.camera);ctx.camera.rotation.x=.7;parent.updateMatrixWorld(true);
 ctx.panel={_vrViewController:{getActiveCamera:()=>ctx.camera}};
 const expected=ctx.camera.getWorldPosition(new THREE.Vector3()).add(ctx.camera.getWorldDirection(new THREE.Vector3()));
 const placement=mobPlacement(ctx);near(placement.position,expected.toArray());assert.equal(placement.rotation[0],0);assert.equal(placement.rotation[2],0);
});
test('aimed walls and distant noncolliding models accept insertion without ground-foot checks',()=>{
 const ctx=fixture(),wall=new THREE.Mesh(new THREE.BoxGeometry(10,10,.2),new THREE.MeshBasicMaterial());wall.position.set(3,4,-95);ctx.objects.push(wall);near(mobPlacement(ctx).position,[3,4,-94.9]);
 const close=new THREE.Mesh(new THREE.BoxGeometry(2,2,2),new THREE.MeshBasicMaterial());close.position.set(3,4,0);ctx.objects.push(close);ctx.colliders.push({target:close});near(mobPlacement(ctx).position,[3,4,1]);
 close.userData.mobRuntime={};near(mobPlacement(ctx).position,[3,4,-94.9]);wall.visible=false;near(mobPlacement(ctx).position,[3,4,4]);
});
test('ground aim uses the nearest surface and ignores editor helpers',()=>{
 const ctx=fixture();ctx.camera.lookAt(3,0,4);ctx.ground=new THREE.Mesh(new THREE.PlaneGeometry(100,100),new THREE.MeshBasicMaterial());ctx.ground.rotation.x=-Math.PI/2;near(mobPlacement(ctx).position,[3,0,4]);
 const helper=new THREE.Mesh(new THREE.BoxGeometry(2,2,2),new THREE.MeshBasicMaterial());helper.position.set(3,2,5);helper.userData.isEditorHelper=true;ctx.objects.push(helper);near(mobPlacement(ctx).position,[3,0,4]);
});
