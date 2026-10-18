// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/hangGliderPhysics.test.mjs
// These regressions verify bounded gravity-powered glide forces, configuration validation and the absence of powered ascent.
import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeHangGliderSettings,hangGliderForces} from './hangGliderPhysics.mjs';
test('settings reject nonfinite values and keep lift below full weight support',()=>{
  const settings=normalizeHangGliderSettings({lift:10,thrust:-1,drag:NaN,steering:null,maxSpeed:Infinity});
  assert.equal(settings.lift,.95);assert.equal(settings.thrust,0);assert.equal(settings.drag,.03);assert.equal(settings.steering,.08);assert.equal(settings.maxSpeed,24);
});
test('gravity is redirected forward while descent stays bounded and strictly downward',()=>{
  for(const gravity of [.005,.012,.03]) {
    let speed=0,velocityY=0;
    for(let frame=0;frame<2000;frame++) {
      const next=hangGliderForces(speed,velocityY,gravity,{});
      speed=next.speed;velocityY=next.velocityY-next.gravity;
      assert.ok(speed>=0 && speed<=24/60);assert.ok(velocityY<0);assert.ok(Number.isFinite(velocityY));
    }
    assert.ok(speed>0);assert.ok(Math.abs(velocityY)<gravity*10);
  }
});
test('thrust needs weight support and rising jumps retain full gravity',()=>{
  assert.equal(hangGliderForces(0,0,0,{}).speed,0);
  assert.equal(hangGliderForces(0,-.1,.012,{lift:0}).speed,0);
  assert.equal(hangGliderForces(0,-.1,.012,{thrust:0}).speed,0);
  const rising=hangGliderForces(.1,.2,.012,{});
  assert.equal(rising.velocityY,.2);assert.equal(rising.gravity,.012);assert.ok(rising.speed<.1);
  assert.ok(hangGliderForces(.3,-.1,.012,{drag:.2}).speed < hangGliderForces(.3,-.1,.012,{drag:.01}).speed);
});
