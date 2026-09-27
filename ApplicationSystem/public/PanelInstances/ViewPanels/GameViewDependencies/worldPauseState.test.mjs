// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/worldPauseState.test.mjs
// These tests cover the event-driven Escape cycle independently of browser pointer-lock permissions and notification latency.
import assert from 'node:assert/strict';
import { createWorldPauseState } from './worldPauseState.mjs';
let unlocks = 0, locks = 0, menus = [];
const state = createWorldPauseState({ captured: true, unlock: () => unlocks++, lock: () => locks++, onPause: p => menus.push(p) });
state.escape(); assert.equal(state.captured, false); assert.equal(state.paused, false); assert.equal(unlocks, 1);
// No pointerlockchange or time delay is required between two physical presses.
state.escape(); assert.equal(state.paused, true); assert.deepEqual(menus, [true]);
state.pointerLockChanged(false); assert.equal(state.paused, true);
state.escape(); assert.equal(state.paused, false); assert.equal(locks, 1); assert.deepEqual(menus, [true, false]);
state.pointerLockChanged(true);
for (let i = 0; i < 3; i++) {
  state.escape(); assert.equal(state.paused, false); assert.equal(state.captured, false);
  state.escape(); assert.equal(state.paused, true);
  state.escape(); assert.equal(state.paused, false); state.pointerLockChanged(true);
}
state.pointerLockChanged(false); assert.equal(state.paused, false, 'arbitrary loss is not a pause');
state.pause(); assert.equal(state.paused, true); state.resume(); assert.equal(state.paused, false);
assert.equal(state.captured, false, 'failed or pending capture still leaves a running world');
console.log('World pause transitions passed');
