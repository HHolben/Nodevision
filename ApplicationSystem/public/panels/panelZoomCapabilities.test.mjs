// Nodevision/ApplicationSystem/public/panels/panelZoomCapabilities.test.mjs
// These tests exercise per-instance and per-mode zoom state, unsupported dispatch, cleanup, and portable modifier mapping.
import assert from 'node:assert/strict';
import { registerPanelZoomCapabilities, getPanelZoomCapabilities, executePanelZoom, panelZoomModeForEvent } from './panelZoomCapabilities.mjs';
const a = {}, b = {}; let aState, bState, semanticState;
const release = registerPanelZoomCapabilities(a, { geometric(command,state) { state.zoom = (state.zoom || 1) * command.factor; aState = state; }, semantic(command,state) { semanticState = state; state.level = command.level; } });
registerPanelZoomCapabilities(b, { geometric(command,state) { state.zoom = (state.zoom || 1) * command.factor; bState = state; } });
assert.equal(executePanelZoom(a, 'geometric', { factor: 2 }), true);
executePanelZoom(b, 'geometric', { factor: 3 }); executePanelZoom(a, 'semantic', { level: 4 });
assert.equal(aState.zoom, 2); assert.equal(bState.zoom, 3); assert.notEqual(aState, semanticState);
assert.equal(executePanelZoom(a, 'fisheye'), false); assert.equal(getPanelZoomCapabilities(a).fisheye, false);
assert.equal(panelZoomModeForEvent({ altKey: true }), 'geometric'); assert.equal(panelZoomModeForEvent({ shiftKey: true }), 'fisheye');
release(); assert.equal(executePanelZoom(a, 'geometric', { factor: 2 }), false);

const { getPanelZoomMode, setPanelZoomMode, getPanelZoomMetadata, setPanelGeometricFallback } = await import('./panelZoomCapabilities.mjs');
const owner = {}; let semanticCalls = 0, geometricCalls = 0;
setPanelGeometricFallback(() => { geometricCalls++; });
const unregister = registerPanelZoomCapabilities(owner, {
  semantic() { semanticCalls++; return true; },
  geometric() { geometricCalls++; return true; },
  metadata: { semantic: { actions: ['zoom', 'set', 'reset'], levels: [{ value:'structure', label:'Structure' }, { value:'annotations', label:'Annotations' }] } }
});
assert.equal(setPanelZoomMode(owner, 'semantic'), true);
assert.equal(getPanelZoomMode(owner), 'semantic');
assert.equal(panelZoomModeForEvent({ shiftKey:true }, owner), 'fisheye');
assert.equal(panelZoomModeForEvent({}, owner), 'semantic');
assert.equal(setPanelZoomMode(owner, 'fisheye'), false);
assert.equal(getPanelZoomMetadata(owner,'semantic').levels.length, 2);
assert.equal(executePanelZoom(owner,'semantic',{ action:'fit' }),false);
assert.equal(semanticCalls,0); assert.equal(geometricCalls,0);
assert.equal(executePanelZoom(owner,'semantic',{ action:'out', factor:.5 }),true);
assert.equal(semanticCalls,1); unregister();
assert.equal(executePanelZoom(owner,'semantic',{action:'zoom',factor:2}),false);
assert.equal(semanticCalls,1); assert.equal(geometricCalls,0);
