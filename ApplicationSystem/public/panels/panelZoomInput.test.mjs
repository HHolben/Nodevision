// Nodevision/ApplicationSystem/public/panels/panelZoomInput.test.mjs
// These tests verify centralized modifier preference, configurable fallback, wheel units, keyboard actions, and reserved fisheye intent.
import assert from 'node:assert/strict';
import { ZoomIntent, panelZoomModeForEvent, panelZoomCommandForEvent, configurePanelZoomInput } from './panelZoomInput.mjs';
assert.equal(panelZoomModeForEvent({ctrlKey:true}),ZoomIntent.Semantic);
assert.equal(panelZoomModeForEvent({ctrlKey:true,getModifierState:key=>key==='Fn'}),ZoomIntent.Geometric);
assert.equal(panelZoomModeForEvent({ctrlKey:true,altKey:true}),ZoomIntent.Geometric);
configurePanelZoomInput({geometricModifier:'None'});
assert.equal(panelZoomModeForEvent({ctrlKey:true,altKey:true}),ZoomIntent.Semantic);
assert.equal(panelZoomModeForEvent({ctrlKey:true,getModifierState:key=>key==='Fn'}),ZoomIntent.Geometric);
assert.throws(()=>configurePanelZoomInput({geometricModifier:'invented'}));
configurePanelZoomInput();
assert.equal(panelZoomModeForEvent({ctrlKey:true,shiftKey:true,altKey:true}),ZoomIntent.Fisheye);
assert.equal(panelZoomModeForEvent({type:'keydown',key:'+',shiftKey:true}),ZoomIntent.Semantic);
assert.equal(panelZoomCommandForEvent({type:'wheel',deltaY:1}),null);
assert.equal(panelZoomCommandForEvent({type:'wheel',ctrlKey:true,deltaY:NaN}),null);
const wheel = deltaMode => panelZoomCommandForEvent({type:'wheel',ctrlKey:true,deltaY:1,deltaMode},100);
assert.equal(wheel(1).delta,16);assert.equal(wheel(2).delta,100);
for(const [key,action] of [['+','in'],['-','out'],['0','reset']])assert.equal(panelZoomCommandForEvent({type:'keydown',ctrlKey:true,altKey:true,key}).action,action);
assert.equal(panelZoomCommandForEvent({type:'keydown',ctrlKey:true,key:'s'}),null);
