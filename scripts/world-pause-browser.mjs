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
 const audio={paused:false,pauses:0,plays:0,pause(){this.paused=true;this.pauses++;},play(){this.paused=false;this.plays++;}};
 const adapter=installWorldPause({panel,canvas,controls,movementState,objects:[{userData:{soundRuntime:{audio}}}],isActive:()=>active});
 const input=createInputHandlers({getBindings:()=>({}),normalizeKeyName:s=>s.toLowerCase(),movementState,acceptsInput:adapter.acceptsInput});
 const click=()=>adapter.capture();canvas.addEventListener('click',click);
 const down=(target=canvas,repeat=false)=>target.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true,repeat}));
 const up=()=>document.dispatchEvent(new KeyboardEvent('keyup',{key:'Escape',bubbles:true}));
 try {
  canvas.click();ok(controls.isLocked,'canvas enters real PointerLockControls locked path');
  down();ok(!adapter.state.paused && pendingUnlock,'captured Escape requests unlock, stays running');
  ok(!audio.paused && audio.pauses===0,'freeing pointer leaves audio running');
  down(canvas,true);ok(!adapter.state.paused,'repeat does not advance state');up();
  down();ok(adapter.state.paused && movementState.paused,'rapid second Escape pauses before unlock notification');up();
  ok(audio.paused && audio.pauses===1 && adapter.menu.style.display==='block','pause suspends audio and opens existing menu');
  change(null);down();up();ok(controls.isLocked && !adapter.state.paused,'paused Escape resumes and captures');
  ok(!audio.paused && audio.plays===1 && adapter.menu.style.display==='none','resume restores audio and closes menu');
  for(let cycle=0;cycle<4;cycle++) {
   down();up();ok(!adapter.state.paused && !adapter.state.captured,'repeat cycle frees capture');
   down();up();ok(adapter.state.paused,'repeat cycle pauses');change(null);
   down();up();ok(!adapter.state.paused && controls.isLocked,'repeat cycle resumes');
  }
  ok(panel.querySelectorAll('.nv-world-pause-menu').length===1,'cycles reuse one menu');
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
  const dialog=document.createElement('div');dialog.setAttribute('role','dialog');dialog.tabIndex=0;panel.appendChild(dialog);
  ok(down(dialog),'other dialog owns Escape');up();dialog.remove();
  const oldCell=window.activeCell, oldClass=panel.className;
  panel.classList.add('panel-cell');window.activeCell=panel;
  const other=document.createElement('div');other.className='panel-cell';document.body.appendChild(other);
  window.activeCell=other;window.dispatchEvent(new CustomEvent('activePanelChanged'));
  ok(!adapter.state.captured && !adapter.state.paused && pendingUnlock,'panel change releases without pausing');
  ok(down(other),'another panel retains Escape even if mode remains Virtual World Editing');up();change(null);
  window.activeCell=panel;panel.hidden=true;window.dispatchEvent(new CustomEvent('nv-panel-content-deactivated'));
  ok(down(toolbar),'hidden world tab cannot consume Escape');up();panel.hidden=false;
  panel.classList.add('nv-panel-tab-content');panel.__nvPanelContentLifecycle={state:'inactive'};
  window.dispatchEvent(new CustomEvent('nv-panel-content-deactivated'));
  ok(down(toolbar),'deactivated tab cannot consume Escape before its visibility changes');up();
  delete panel.__nvPanelContentLifecycle;
  panel.className=oldClass;window.activeCell=oldCell;other.remove();
  adapter.state.pause();active=false;window.dispatchEvent(new CustomEvent('activePanelChanged'));
  ok(adapter.menu.style.display==='none' && adapter.state.paused,'deactivation hides but preserves explicit pause');
  active=true;window.dispatchEvent(new CustomEvent('activePanelChanged'));
  ok(adapter.menu.style.display==='block','returning restores the same pause menu');adapter.state.resume();change(null);
  const otherCanvas=document.createElement('canvas');change(otherCanvas);pendingUnlock=false;adapter.state.pause();
  ok(!pendingUnlock && locked===otherCanvas,'explicit pause never unlocks another canvas');adapter.state.resume();change(null);
  // Deliver capture only after the requesting context has changed.
  let completeCapture;
  canvas.requestPointerLock=()=>{captureCalls++;return new Promise(resolve=>{completeCapture=()=>{change(canvas);resolve();};});};
  adapter.capture();adapter.state.pause();pendingUnlock=false;completeCapture();await Promise.resolve();
  ok(pendingUnlock && adapter.state.paused && !adapter.state.captured,'late native capture is released while paused');change(null);
  adapter.state.resume();active=false;window.dispatchEvent(new CustomEvent('activePanelChanged'));
  active=true;pendingUnlock=false;completeCapture();await Promise.resolve();
  ok(pendingUnlock && !adapter.state.captured && !adapter.state.paused,'leaving and returning does not revive old capture request');change(null);
  adapter.capture();window.dispatchEvent(new Event('blur'));pendingUnlock=false;completeCapture();await Promise.resolve();
  ok(pendingUnlock && !adapter.state.captured && !adapter.state.paused,'blur cancels capture without pausing');change(null);
  canvas.requestPointerLock=()=>Promise.reject(new Error('Capture denied'));
  adapter.state.pause();adapter.state.resume();await Promise.resolve();
  ok(!adapter.state.paused && !adapter.state.captured,'denied resume remains running and free');
  canvas.requestPointerLock=()=>{change(canvas);};canvas.click();ok(adapter.state.captured,'fresh canvas click retries capture');change(null);
  canvas.requestPointerLock=()=>new Promise(resolve=>{completeCapture=()=>{change(canvas);resolve();};});
  adapter.capture();adapter.dispose();pendingUnlock=false;completeCapture();await Promise.resolve();
  ok(pendingUnlock && !adapter.state.captured,'pending native request cannot retain capture after teardown');change(null);
  ok(down(toolbar),'disposed adapter no longer consumes Escape');up();
  adapter.dispose();ok(!panel.querySelector('.nv-world-pause-menu'),'teardown removes menu');toolbar.remove();
 } finally {
  input.dispose();adapter.dispose();controls.dispose();canvas.removeEventListener('click',click);
  document.exitPointerLock=oldExit;canvas.requestPointerLock=oldRequest;
  if(lockDescriptor)Object.defineProperty(document,'pointerLockElement',lockDescriptor);else delete document.pointerLockElement;
 }
}
