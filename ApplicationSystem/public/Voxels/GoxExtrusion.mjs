// Nodevision/ApplicationSystem/public/Voxels/GoxExtrusion.mjs
// Modal GOX extrusion shares document sweeps with terminal actions and owns cancellable pointer/keyboard listeners for the editor lifetime.
import * as THREE from '/lib/three/three.module.js';
import {VoxelExtrusion} from './VoxelExtrusion.mjs';
import {VoxelExtrusionOverlay} from './VoxelExtrusionOverlay.mjs';
import {projectExtrusionAxes,extrusionDistance,inferExtrusionAxis} from './VoxelExtrusionProjection.mjs';
import {notifyActiveToolChanged} from '/CursorFamilies/PanelActiveTool.mjs';
export function installExtrusion(api,viewport,signal){
 const canvas=viewport.renderer.domElement,root=api.element;let state=null,last=null,suppressUp=false;
 const notify=()=>{api.syncBuildControls();notifyActiveToolChanged(root);};
 const status=()=>{if(state)api.status.textContent=`Extrude ${state.axis?.toUpperCase()||'Auto'}: ${state.plan.steps>=0?'+':''}${state.plan.steps} voxels${state.numeric!==''?' (numeric)':''} · ${state.plan.added.size} new · ${state.plan.overlap.size} occupied · Enter/click commits; Escape/right click cancels`;};
 function cancel(){if(!state)return;state.overlay.dispose();viewport.controls.enabled=state.controlsEnabled;state=null;api.status.textContent='Extrusion cancelled';notify();}
 function update(axis,steps){if(!state)throw Error('Start extrusion first');try{state.plan.update(axis,steps);state.valid=true;state.axis=axis;state.overlay.update(state.plan);api.previewExtrusion?.(state.plan,state.overlay);status();notify();}catch(error){state.valid=false;api.status.textContent=error.message;throw error;}}
 function start(axis='auto',steps){
  if(!['auto','x','y','z'].includes(axis))throw Error('Extrusion axis must be auto, x, y or z');
  if(!api.editing)throw Error('Switch to Selection / Transform or Build mode first');
  if(!state){api.cancelTool?.();const plan=new VoxelExtrusion(api.doc);state={plan,overlay:new VoxelExtrusionOverlay(viewport),vectors:projectExtrusionAxes(THREE,viewport,plan.center),origin:last?.slice()||null,axis:null,mode:axis,controlsEnabled:viewport.controls.enabled,valid:true,numeric:''};viewport.controls.enabled=false;viewport.cursor(null);}
  state.mode=axis;state.axis=axis==='auto'?null:axis;state.valid=true;
  canvas.focus({preventScroll:true});
  if(steps!==undefined)state.numeric=String(steps);
  if(state.numeric!=='')applyNumeric();
  else{update(axis==='auto'?'x':axis,0);if(axis==='auto')state.axis=null;status();notify();}return true;
 }
 function applyNumeric(){
  const value=state.numeric,axis=state.axis;
  let error=!/^-?\d+$/.test(value)?'Enter a signed integer voxel distance; fractions are not supported':!Number.isSafeInteger(Number(value))?'Extrusion distance is too large':!axis?'Move the pointer to infer an axis, or choose X, Y or Z first':null;
  if(!error){try{return update(axis,Number(value));}catch(e){error=e.message;}}
  // An invalid/pending value must never leave an older preview available to commit.
  state.valid=false;state.plan.update(axis||'x',0);state.overlay.update(state.plan);
  api.status.textContent=`Extrude ${axis?.toUpperCase()||'Auto'}: ${value} voxels · ${error}`;notify();
  throw Error(api.status.textContent);
 }
 function numericKey(key){
  if(key==='backspace')state.numeric=state.numeric.slice(0,-1);
  else if(key==='-'){if(!state.numeric)state.numeric='-';}
  else state.numeric+=key;
  if(state.numeric===''){const axis=state.axis;update(axis||'x',0);state.axis=axis;status();notify();}
  else applyNumeric();
 }
 function commit(){if(!state)return false;if(!state.valid)throw Error('Choose a valid extrusion distance before committing');const plan=state.plan;const changed=plan.commit();cancel();api.status.textContent=changed?'Extrusion committed':'Extrusion produced no new voxels';return changed;}
 const run=(action,args={})=>{
  if(action==='extrude-cancel'){cancel();return true;}
  if(action==='extrude-commit')return commit();
  if(action==='extrude-distance'){if(!state)throw Error('Start extrusion first');if(args.axis){if(!['x','y','z'].includes(args.axis))throw Error('Choose X, Y or Z');state.axis=args.axis;state.mode=args.axis;}state.numeric=String(args.steps);return applyNumeric();}
  return start(action==='extrude'?args.axis||'auto':action.slice(-1),args.steps);
 };
 api.extrusion={get active(){return !!state;},get mode(){return state?.mode;},get axis(){return state?.axis;},get plan(){return state?.plan;},get numeric(){return state?.numeric??'';},run,cancel,
  beforeAction(action){if(state&&!action.startsWith('extrude')&&!['save','save-as','download'].includes(action))cancel();}};
 const guard=fn=>{try{fn();}catch(error){api.status.textContent=error.message;}};
 window.addEventListener('pointermove',e=>{
  if(e.target===canvas)last=[e.clientX,e.clientY];if(!state)return;
  if(!state.origin){state.origin=[e.clientX,e.clientY];return;}
  const dx=e.clientX-state.origin[0],dy=e.clientY-state.origin[1];
  const axis=state.axis||inferExtrusionAxis(state.vectors,dx,dy,state.plan.exposure);if(!axis)return;
  if(state.numeric!==''){if(!state.axis){state.axis=axis;guard(applyNumeric);}return;}
  const steps=extrusionDistance(state.vectors['xyz'.indexOf(axis)],dx,dy);if(state.valid&&state.axis===axis&&state.plan.steps===steps)return;
  guard(()=>update(axis,steps));
 },{capture:true,signal});
 const intercept=e=>{e.preventDefault();e.stopImmediatePropagation();};
 canvas.addEventListener('pointermove',e=>{if(state)intercept(e);},{capture:true,signal});
 canvas.addEventListener('pointerdown',e=>{if(!state||![0,2].includes(e.button))return;intercept(e);suppressUp=true;guard(()=>e.button===2?cancel():commit());},{capture:true,signal});
 canvas.addEventListener('pointerup',e=>{if(state||suppressUp){intercept(e);suppressUp=false;}},{capture:true,signal});
 canvas.addEventListener('pointerleave',e=>{if(state)e.stopImmediatePropagation();},{capture:true,signal});
 canvas.addEventListener('pointercancel',cancel,{signal});
 root.addEventListener('keydown',e=>{
  if(e.target.closest('input,textarea,select,dialog,[contenteditable]:not([contenteditable="false"]),[role="textbox"]')||e.ctrlKey||e.metaKey||e.altKey)return;
  const key=e.key.toLowerCase();if(key==='e'&&!e.repeat){intercept(e);guard(()=>start());}
  else if(state&&['x','y','z'].includes(key)){intercept(e);guard(()=>start(key));}
  else if(state&&(/^[0-9]$/.test(key)||['-','.','backspace'].includes(key))){intercept(e);guard(()=>numericKey(key));}
  else if(state&&key==='enter'){intercept(e);guard(commit);}
  else if(state&&key==='escape'){intercept(e);cancel();}
 },{capture:true,signal});
 window.addEventListener('activePanelChanged',()=>{if(!window.activeCell?.contains(root)||root.closest('[hidden],[aria-hidden="true"]'))cancel();},{signal});
 window.addEventListener('blur',cancel,{signal});signal.addEventListener('abort',cancel,{once:true});
}
