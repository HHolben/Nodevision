// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/goxExtrudeToolbar.mjs
// Shared Edit → Extrude controls invoke existing GOX actions and display the editor-owned modal state.
export function initToolbarWidget(host){queueMicrotask(()=>{
 if(!host.isConnected||!host.closest('#sub-toolbar'))return;const api=window.__nvGoxActive;if(!api?.editing||!api.element.isConnected)return;
 host.__nvExtrudeDispose?.();const buttons=[];host.dataset.goxExtrudeControls='';
 for(const [label,action,axis] of [['Extrude (E)','extrude','auto'],['Extrude X (E, X)','extrude-x','x'],['Extrude Y (E, Y)','extrude-y','y'],['Extrude Z (E, Z)','extrude-z','z']]){const button=document.createElement('button');button.textContent=label;button.onclick=()=>api.safe(action);host.append(button);buttons.push({button,axis});}
 const steps=document.createElement('input');steps.type='number';steps.step=1;steps.value=0;steps.setAttribute('aria-label','Extrusion distance (voxels)');steps.onchange=()=>api.safe('extrude-distance',{steps:steps.value});host.append(steps);
 for(const [label,action] of [['Commit','extrude-commit'],['Cancel','extrude-cancel']]){const button=document.createElement('button');button.textContent=label;button.onclick=()=>api.safe(action);host.append(button);}
 const sync=()=>{const enabled=api.editing&&!api.doc.model.readOnly&&!api.doc.active.locked&&api.doc.active.visible&&api.doc.selection.size>0;for(const {button,axis} of buttons){button.disabled=!enabled;button.title=enabled?'':'Select occupied voxels in a visible unlocked layer';button.setAttribute('aria-pressed',String(api.extrusion.active&&api.extrusion.mode===axis));}steps.disabled=!api.extrusion.active;steps.value=api.extrusion.numeric!==''?api.extrusion.numeric:api.extrusion.plan?.steps||0;};
 api.element.addEventListener('gox-controls-changed',sync);sync();const observer=new MutationObserver(()=>{if(!host.isConnected)dispose();});observer.observe(document.body,{childList:true,subtree:true});
 function dispose(){observer.disconnect();api.element.removeEventListener('gox-controls-changed',sync);host.replaceChildren();}host.__nvExtrudeDispose=dispose;
});}
