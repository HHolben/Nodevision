// Nodevision/scripts/world-pause-browser.mjs
// Exercises the shared input adapter with real DOM events and PointerLockControls, using deterministic pointer-lock notifications where headless browser user-gesture requirements prevent native capture.
import { PointerLockControls } from '/lib/three/PointerLockControls.js';
import * as THREE from '/lib/three/three.module.js';
import { installWorldPause } from '/PanelInstances/ViewPanels/GameViewDependencies/worldPause.mjs';
import { createInputHandlers } from '/PanelInstances/ViewPanels/GameViewDependencies/inputHandlers.mjs';
import { installFramePreflightAbility } from '/PanelInstances/ViewPanels/GameViewDependencies/Abilities/CommandAbilities/FramePreflightAbility.mjs';
export async function checkWorldPause(panel,canvas) {
 const ok=(v,m)=>{if(!v)throw Error(m);};
 let active=true, locked=null, captureCalls=0, pendingUnlock=false;
 const oldExit=document.exitPointerLock, oldRequest=canvas.requestPointerLock;
 const lockDescriptor=Object.getOwnPropertyDescriptor(document,'pointerLockElement');
 Object.defineProperty(document,'pointerLockElement',{configurable:true,get:()=>locked});
 const change=target=>{locked=target;document.dispatchEvent(new Event('pointerlockchange'));};
 canvas.requestPointerLock=()=>{captureCalls++;change(canvas);};
 document.exitPointerLock=()=>{pendingUnlock=true;};
 const controls=new PointerLockControls(new THREE.PerspectiveCamera(),canvas), movementState={};
 const adapter=installWorldPause({panel,canvas,controls,movementState,objects:[],isActive:()=>active});
 const input=createInputHandlers({getBindings:()=>({}),normalizeKeyName:s=>s.toLowerCase(),movementState,acceptsInput:adapter.acceptsInput});
 const click=()=>adapter.capture();canvas.addEventListener('click',click);
 const down=(target=canvas,repeat=false)=>target.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true,repeat}));
 const up=()=>document.dispatchEvent(new KeyboardEvent('keyup',{key:'Escape',bubbles:true}));
 try {
  canvas.click();ok(controls.isLocked,'canvas enters real PointerLockControls locked path');
  down();ok(!adapter.state.paused && pendingUnlock,'captured Escape requests unlock, stays running');
  down(canvas,true);ok(!adapter.state.paused,'repeat does not advance state');up();
  down();ok(adapter.state.paused && movementState.paused,'rapid second Escape pauses before unlock notification');up();
  change(null);down();up();ok(controls.isLocked && !adapter.state.paused,'paused Escape resumes and captures');
  // Browser-consumed first Escape: loss + keyup alone simply enters pointer-free state.
  change(null);up();ok(!adapter.state.paused,'native pointer-lock loss never pauses');
  const toolbar=document.createElement('button');toolbar.textContent='Toolbar';document.body.appendChild(toolbar);
  const captures=captureCalls;toolbar.click();ok(!adapter.state.paused && captureCalls===captures,'toolbar neither pauses nor recaptures');
  toolbar.dispatchEvent(new MouseEvent('mousedown',{button:0,bubbles:true}));ok(!input.heldKeys.mouse0,'toolbar clicks cannot grab or attack');
  toolbar.dispatchEvent(new KeyboardEvent('keydown',{key:'w',bubbles:true}));ok(!input.heldKeys.w,'toolbar keyboard does not move player');
  const preflight={api:{ensureWheelHandler(){},updateSoundObjectRuntimes(){},updateGrabbedObjectFollow(){},updateGizmoHandleOrientations(){}},
   controls,getBindings:()=>({}),heldKeys:input.heldKeys,movementState,listenerPosition:()=>null,stlVertexMarkers:[]};
  installFramePreflightAbility(preflight);ok(!preflight.api.runFramePreflight().stop,'unlocked world reaches physics update');
  toolbar.focus();down(toolbar);up();ok(adapter.state.paused,'second Escape works after toolbar interaction');
  adapter.menu.querySelector('button').click();ok(!adapter.state.paused && controls.isLocked,'explicit Resume uses same path');
  adapter.state.pause();ok(adapter.state.paused,'explicit Pause still works');adapter.state.resume();
  active=false;const before=adapter.state.captured;const allowed=down(toolbar);up();ok(allowed && adapter.state.captured===before,'outside world context Escape remains unhandled');
  active=true;const field=document.createElement('input');panel.appendChild(field);ok(down(field),'text-field Escape is not hijacked');up();field.remove();
  adapter.dispose();ok(!panel.querySelector('.nv-world-pause-menu'),'teardown removes menu');toolbar.remove();
 } finally {
  input.dispose();adapter.dispose();controls.dispose();canvas.removeEventListener('click',click);
  document.exitPointerLock=oldExit;canvas.requestPointerLock=oldRequest;
  if(lockDescriptor)Object.defineProperty(document,'pointerLockElement',lockDescriptor);else delete document.pointerLockElement;
 }
}
