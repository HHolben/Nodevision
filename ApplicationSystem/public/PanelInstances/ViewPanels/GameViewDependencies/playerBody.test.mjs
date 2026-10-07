// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/playerBody.test.mjs
// These regressions verify foot-origin avatar normalization and the physical jump apex across gravity, skill and crouch multipliers.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../../../lib/three/three.module.js';
import { createFallbackAvatar, normalizeAvatar } from './playerAvatarVisual.mjs';
import { applyGroundMovement } from './movementSteps.mjs';
import { cappedJumpImpulse } from './playerJump.mjs';
test('default and custom centered avatars normalize to a 1.75 metre foot origin',()=>{
  for(const avatar of [createFallbackAvatar(THREE),normalizeAvatar(THREE,new THREE.Mesh(new THREE.BoxGeometry(1,4,1),new THREE.MeshBasicMaterial()))]){
    let box=new THREE.Box3().setFromObject(avatar);assert.ok(Math.abs(box.min.y)<1e-6);assert.ok(Math.abs(box.max.y-1.75)<1e-6);
    for(const ground of [0,18,20.25,100])for(const height of [1.75,1.2]){
      const wrapper=new THREE.Group();wrapper.add(avatar);wrapper.scale.y=height/1.75;wrapper.position.y=ground;
      box=new THREE.Box3().setFromObject(wrapper);assert.ok(Math.abs(box.min.y-ground)<1e-6);assert.ok(Math.abs(box.max.y-(ground+height))<1e-6);
      wrapper.remove(avatar);
    }
  }
});
test('normal, crouch and skill-enhanced ground jumps never exceed 0.6 metres',()=>{
  for(const gravity of [.005,.012,.03])for(const speed of [.28,4])for(const multiplier of [1,1.5,4]){
    const object=new THREE.Object3D();object.position.y=1.75;
    const movementState={playerHeight:1.75,isGrounded:true,velocityY:0};let peak=0;
    for(let i=0;i<200;i++){
      applyGroundMovement({controls:{getObject:()=>object},inputState:{jump:i===0,jumpForceMultiplier:multiplier},movementState,gravity,jumpSpeed:speed,crouching:true,groundLevel:0,wouldCollide:()=>false});
      peak=Math.max(peak,object.position.y-1.75);
    }
    assert.ok(peak<=.600001);assert.ok(peak>.58);assert.equal(object.position.y,1.75);assert.equal(movementState.isGrounded,true);
  }
  assert.equal(cappedJumpImpulse(.02,.012),.02);assert.equal(cappedJumpImpulse(4,0),0);
});
