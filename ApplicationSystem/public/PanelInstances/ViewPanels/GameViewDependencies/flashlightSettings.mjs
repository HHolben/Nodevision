// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/flashlightSettings.mjs
// This module validates flashlight settings and presents a focused configuration dialog while isolating its controls from world movement input.
export const FLASHLIGHT_DEFAULTS = Object.freeze({color:'#fff4dc',intensity:100,radius:3});
export function normalizeFlashlightSettings(values = {}) {
  const bounded = (key,min,max) => Number.isFinite(Number(values[key])) ? Math.max(min,Math.min(max,Number(values[key]))) : FLASHLIGHT_DEFAULTS[key];
  return {color:/^#[0-9a-f]{6}$/i.test(values.color || '') ? values.color : FLASHLIGHT_DEFAULTS.color,
    intensity:bounded('intensity',0,2000),radius:bounded('radius',0.1,15)};
}
export function openFlashlightSettings({panel,movementState,controls,settings,onChange,onClose}) {
  const dialog = document.createElement('dialog');
  dialog.dataset.flashlightSettings = ''; dialog.setAttribute('aria-label','Flashlight settings');
  Object.assign(dialog.style,{background:'var(--nv-world-pause-background, #202830)',color:'var(--nv-world-pause-color, white)',padding:'20px',border:'1px solid #789',borderRadius:'8px'});
  const heading = document.createElement('h2'); heading.textContent = 'Flashlight'; dialog.append(heading);
  const inputs = {};
  for (const [key,label,type,min,max,step] of [
    ['color','Color','color'],['intensity','Intensity','number',0,2000,1],['radius','Beam radius at 10 m (m)','number',0.1,15,0.1],
  ]) {
    const row = document.createElement('label'); row.textContent = label + ' ';
    Object.assign(row.style,{display:'flex',justifyContent:'space-between',gap:'16px',margin:'10px 0'});
    const input = document.createElement('input'); input.type = type; input.value = settings[key]; input.dataset.field = key;
    if (min !== undefined) { input.min = min; input.max = max; input.step = step; }
    input.addEventListener('input',()=>{
      if (input.value === '' || !input.checkValidity()) return;
      settings = normalizeFlashlightSettings({...settings,[key]:input.value}); onChange(settings);
    });
    inputs[key] = input; row.append(input); dialog.append(row);
  }
  const hint = document.createElement('p'); hint.textContent = 'Changes apply immediately. The beam reaches up to 50 m.'; dialog.append(hint);
  const done = document.createElement('button'); done.type = 'button'; done.textContent = 'Done'; dialog.append(done);
  const wasEditing = movementState.textEditing;
  const clearInput = () => { for (const key of Object.keys(movementState.heldKeys || {})) movementState.heldKeys[key] = false; };
  movementState.textEditing = true; clearInput(); controls?.unlock?.();
  let closed = false;
  const close = () => {
    if (closed) return; closed = true;
    dialog.close(); dialog.remove(); movementState.textEditing = wasEditing;
    movementState.skipClickFrame = true; clearInput(); onClose();
  };
  done.addEventListener('click',close);
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  // Keep G, mouse presses, and Escape inside this modal instead of world tools.
  for (const type of ['keydown','keyup','pointerdown','mousedown','click']) dialog.addEventListener(type,event=>event.stopPropagation());
  panel.append(dialog); dialog.showModal(); inputs.color.focus();
  return {close,dialog};
}
