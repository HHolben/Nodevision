// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/worldCycleSleep.test.mjs
// These regressions verify cycle activation, sleep wraparound and shared temporal speed behavior without a browser renderer.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { cycleOnEnable, createCycleSleepRuntime } from './worldCycleSleep.mjs';

function fixture(cycle) {
  let milliseconds = 0;
  const source = readFileSync(new URL('./initScene.mjs', import.meta.url), 'utf8');
  const code = source.slice(source.indexOf('function clampTemporalNumber'), source.indexOf('function createTemporalManipulatorPanel'));
  const temporal = vm.runInNewContext(`${code}\ncreateTemporalController({ objects: [], movementState: {} })`, { performance: { now: () => milliseconds } });
  let brightnessTime;
  const context = { temporalController: temporal, consolePanels: {
    getEnvironmentDefinition: () => ({ dayNightCycle: cycle }),
    updateEnvironmentLighting: time => { brightnessTime = time; }
  } };
  return { temporal, sleep: createCycleSleepRuntime(context), tick(seconds) { milliseconds += seconds * 1000; temporal.update(); }, get brightnessTime() { return brightnessTime; } };
}
const defaultCycle = () => ({ enabled: true, durationSeconds: 120, periods: [{ time: 0, brightness: 1 }] });
test('enabling the default creates varying brightness while preserving custom and disabled cycles', () => {
  assert.deepEqual(cycleOnEnable(defaultCycle()).periods.map(p => p.time), [0, 30, 60, 90]);
  const custom = { ...defaultCycle(), periods: [{ time: 0, brightness: 0.3 }] };
  assert.equal(cycleOnEnable(custom), custom);
  const disabled = { ...defaultCycle(), enabled: false };
  assert.equal(cycleOnEnable(disabled), disabled);
  assert.deepEqual(fixture(disabled).sleep.sleepOptions(), []);
});
test('sleep uses the next period, wraps the cycle, and updates lighting immediately', () => {
  const f = fixture(cycleOnEnable(defaultCycle()));
  assert.equal(f.sleep.sleepOptions()[0].id, '1');
  assert.equal(f.sleep.sleep('1').ok, true);
  assert.equal(f.temporal.getTimeSeconds(), 30);
  assert.equal(f.brightnessTime, 30);
  f.sleep.sleep('0');
  assert.equal(f.temporal.getTimeSeconds(), 120);
  assert.equal(f.sleep.sleep('invalid').ok, false);
});
test('temporal speed, reverse and static time share the sleep clock', () => {
  const f = fixture(cycleOnEnable(defaultCycle()));
  f.temporal.applySettings({ timeScale: 10 });
  f.tick(3);
  assert.equal(f.temporal.getTimeSeconds(), 30);
  assert.equal(f.sleep.sleepOptions()[0].id, '2');
  f.temporal.applySettings({ timeScale: -10 });
  f.tick(4);
  assert.equal(f.temporal.getTimeSeconds(), -10);
  f.sleep.sleep('0');
  assert.equal(f.temporal.getTimeSeconds(), 0);
  f.temporal.applySettings({ staticTimeEnabled: true, staticTimeSeconds: 10 });
  f.sleep.sleep('1');
  f.tick(5);
  assert.equal(f.temporal.getTimeSeconds(), 30);
  assert.equal(f.temporal.getSettings().staticTimeEnabled, true);
});
