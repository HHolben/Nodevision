// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/hangGliderSettings.mjs
// This module presents hang glider aerodynamic settings while keeping dialog keyboard and pointer input separate from world commands.
import {HANG_GLIDER_FIELDS,normalizeHangGliderSettings} from './hangGliderPhysics.mjs';
export function openHangGliderSettings({panel,movementState,controls,item,onClose}) {
  const dialog=document.createElement('dialog');dialog.dataset.hangGliderSettings='';dialog.setAttribute('aria-label','Hang glider aerodynamics');
  Object.assign(dialog.style,{background:'var(--nv-world-pause-background, #202830)',color:'var(--nv-world-pause-color, white)',padding:'20px',border:'1px solid #789',borderRadius:'8px'});
  const heading=document.createElement('h2');heading.textContent='Hang glider aerodynamics';dialog.append(heading);
  const settings=normalizeHangGliderSettings(item.hangGliderSettings);
  for(const field of HANG_GLIDER_FIELDS) {
    const label=document.createElement('label');label.textContent=field.label+' ';
    Object.assign(label.style,{display:'flex',justifyContent:'space-between',gap:'16px',margin:'10px 0'});
    const input=document.createElement('input');input.type='number';input.dataset.field=field.key;
    input.min=field.min;input.max=field.max;input.step=field.step;input.value=settings[field.key];
    input.addEventListener('input',()=>{
      if(input.value==='' || !input.checkValidity())return;
      settings[field.key]=Number(input.value);item.hangGliderSettings=normalizeHangGliderSettings(settings);
    });label.append(input);dialog.append(label);
  }
  const hint=document.createElement('p');hint.textContent='Jump again in midair to deploy or fold. Look left or right to steer. Lift reduces descent; thrust redirects part of your weight forward. Changes apply immediately.';
  hint.style.maxWidth='420px';dialog.append(hint);
  const done=document.createElement('button');done.type='button';done.textContent='Done';dialog.append(done);
  const wasEditing=movementState.textEditing;
  const clearInput=()=>{for(const key of Object.keys(movementState.heldKeys || {}))movementState.heldKeys[key]=false;};
  movementState.textEditing=true;clearInput();controls.unlock?.();
  let closed=false;
  const close=()=>{if(closed)return;closed=true;dialog.close();dialog.remove();movementState.textEditing=wasEditing;movementState.skipClickFrame=true;clearInput();onClose();};
  done.addEventListener('click',close);dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  for(const type of ['keydown','keyup','pointerdown','mousedown','click'])dialog.addEventListener(type,event=>event.stopPropagation());
  panel.append(dialog);dialog.showModal();dialog.querySelector('input').focus();
  return {dialog,close};
}
