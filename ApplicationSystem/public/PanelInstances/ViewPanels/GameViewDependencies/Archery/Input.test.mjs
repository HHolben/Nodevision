// Tests the application's input router itself, including sub-frame taps and cancellation rather than synthetic bow activation.
import test from 'node:test';import assert from 'node:assert/strict';import {createInputHandlers} from '../inputHandlers.mjs';
test('configured Use edges retain taps once, ignore repeats, typing and cancel on focus/lock/visibility loss',()=>{
 const oldDocument=globalThis.document,oldWindow=globalThis.window;let typing=false;
 const document=new EventTarget(),window=new EventTarget();document.closest=()=>typing?{}:null;document.visibilityState='visible';document.pointerLockElement={};globalThis.document=document;globalThis.window=window;
 const state={},bindings={use:'q'},router=createInputHandlers({getBindings:()=>bindings,normalizeKeyName:s=>s.toLowerCase(),movementState:state});state.heldKeys=router.heldKeys;
 const event=(type,key,repeat=false)=>{const e=new Event(type);Object.assign(e,{key,repeat});document.dispatchEvent(e);};
 try{
  event('keydown','r');event('keyup','r');assert.equal(state.toolInput.events.length,0);
  event('keydown','q');event('keydown','q',true);event('keyup','q');event('keyup','q');assert.deepEqual(state.toolInput.events.map(e=>e.down),[true,false]);assert.ok(state.toolInput.events[1].time>=state.toolInput.events[0].time);state.toolInput.events.length=0;
  typing=true;event('keydown','q');event('keyup','q');assert.equal(state.toolInput.events.length,0);typing=false;
  for(const type of ['blur','pointerlockchange','visibilitychange','focusin']){
   event('keydown','q');const revision=state.toolInput.revision;if(type==='blur')window.dispatchEvent(new Event(type));else{document.pointerLockElement=null;document.visibilityState='hidden';typing=type==='focusin';document.dispatchEvent(new Event(type));typing=false;}
   assert.equal(state.toolInput.events.length,0);assert.ok(state.toolInput.revision>revision);event('keyup','q');assert.equal(state.toolInput.events.length,0);
  }
  event('keydown','q');event('keydown','Escape');event('keyup','q');assert.equal(state.toolInput.events.length,0);
  bindings.use='mouse0';const down=new Event('mousedown');Object.assign(down,{button:0});document.dispatchEvent(down);const up=new Event('mouseup');Object.assign(up,{button:0});document.dispatchEvent(up);assert.deepEqual(state.toolInput.events.map(e=>e.down),[true,false]);
  router.dispose();event('keydown','q');assert.equal(state.toolInput.events.length,0);
 }finally{router.dispose();globalThis.document=oldDocument;globalThis.window=oldWindow;}
});
