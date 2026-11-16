// Personal bow preferences are stored outside the world document, with the existing equipment dialog/input conventions.
import {settings,validSettings} from './Physics.mjs';
const KEY='nodevision.archery.v1';
export function loadSettings(){try{return settings(JSON.parse(localStorage.getItem(KEY)||'{}'));}catch{return settings();}}
export function saveSettings(s){if(!validSettings(s))return false;try{localStorage.setItem(KEY,JSON.stringify(s));}catch{}return true;}
export function openSettings({world,ctx,value,onChange,onClose}){
 const dialog=document.createElement('dialog');dialog.dataset.archerySettings='';dialog.setAttribute('aria-label','Archery Bow settings');
 Object.assign(dialog.style,{background:'var(--nv-world-pause-background,#202830)',color:'var(--nv-world-pause-color,white)',padding:'20px',border:'1px solid #789',borderRadius:'8px'});
 const title=document.createElement('h2');title.textContent='Archery Bow';dialog.append(title);const inputs={};
 for(const [key,label,min,max,step] of [['minForce','Minimum effective launch force (N)',.1,500,.1],['maxForce','Maximum effective launch force (N)',.1,500,.1],['drawTime','Time to full draw (s)',.05,10,.05],['trace','Predictive trajectory trace']]){
  const row=document.createElement('label');row.textContent=label+' ';Object.assign(row.style,{display:'flex',gap:'16px',justifyContent:'space-between',margin:'10px 0'});
  const input=document.createElement('input');input.dataset.field=key;input.type=key==='trace'?'checkbox':'number';if(key==='trace')input.checked=value.trace;else{input.min=min;input.max=max;input.step=step;input.value=value[key];}inputs[key]=input;row.append(input);dialog.append(row);
 }
 const error=document.createElement('output');error.setAttribute('role','status');dialog.append(error);
 const hint=document.createElement('p');hint.textContent='Unlimited arrows. Changes cancel drawing and apply to subsequent shots. Personal settings; arrows are temporary session objects. Teal dots indicate a confirmed impact; sand-colored dots have an unverified endpoint.';hint.style.maxWidth='440px';dialog.append(hint);
 const done=document.createElement('button');done.textContent='Done';dialog.append(done);
 const state=ctx.movementState,wasEditing=state.textEditing;state.textEditing=true;ctx.controls.unlock?.();
 const clear=()=>{for(const k of Object.keys(ctx.heldKeys))ctx.heldKeys[k]=false;if(state.toolInput){state.toolInput.events.length=0;state.toolInput.revision++;}};clear();
 let closed=false;function close(){if(closed)return;closed=true;dialog.close();dialog.remove();state.textEditing=wasEditing;state.skipClickFrame=true;clear();world.panel.querySelector('canvas')?.focus();onClose();}
 done.onclick=()=>{const next={minForce:Number(inputs.minForce.value),maxForce:Number(inputs.maxForce.value),drawTime:Number(inputs.drawTime.value),trace:inputs.trace.checked};if(!Object.values(inputs).every(i=>i.checkValidity())||!validSettings(next)){error.textContent='Enter finite positive values; maximum force must be at least minimum force.';return;}saveSettings(next);onChange(next);close();};
 dialog.addEventListener('cancel',e=>{e.preventDefault();close();});for(const type of ['keydown','keyup','pointerdown','mousedown','click'])dialog.addEventListener(type,e=>e.stopPropagation());world.panel.append(dialog);dialog.showModal();inputs.minForce.focus();return {dialog,close};
}
