// Nodevision/ApplicationSystem/public/Voxels/GoxControls.mjs
// Accessible viewport tools, color controls and a shared-command form without a separate scripting engine.
export { pointerTools } from './VoxelBuildPointer.mjs';
import { buildTools } from './VoxelBuildPointer.mjs';
import { buildControls } from './VoxelBuildControls.mjs';
import { rgba } from './VoxelModel.mjs';
import { examples } from './GoxCommands.mjs';
export const tools=buildTools;
export function initializeControls(api,root,signal){
  let color=[220,140,60,255];api.color=()=>color.slice();api.syncBuildControls=()=>root.dispatchEvent(new Event('gox-controls-changed'));
  api.pickColor=c=>{rgba(c);color=c.slice();api.syncBuildControls();};
  api.coordinates=document.createElement('output');api.coordinates.setAttribute('aria-label','Voxel coordinates');root.append(api.coordinates);
  let dialog,closeSettings;api.openSettings=()=>{if(dialog){dialog.focus();return;}dialog=document.createElement('dialog');dialog.setAttribute('aria-label','GOX tool settings');root.append(dialog);
    const settings=buildControls(api,dialog),sync=()=>settings.sync();root.addEventListener('gox-controls-changed',sync);
    const close=closeSettings=()=>{root.removeEventListener('gox-controls-changed',sync);dialog?.remove();dialog=null;};
    dialog.addEventListener('cancel',e=>{e.preventDefault();close();});const done=document.createElement('button');done.textContent='Done';done.onclick=close;dialog.append(done);dialog.showModal();settings.open();
  };signal.addEventListener('abort',()=>closeSettings?.(),{once:true});
}
export function controls(api,host){
  const bar=document.createElement('div');bar.style.cssText='display:flex;flex-wrap:wrap;gap:4px;padding:5px;align-items:center';host.append(bar);bar.dataset.goxBlockControls='';
  function button(label,action,args){const b=document.createElement('button');b.textContent=label;b.onclick=()=>api.safe(action,args);bar.append(b);return b;}
  const build=buildControls(api,bar);button('Save','save');button('Undo','undo');button('Redo','redo');button('Frame','frame');button('Layers','layers');button('Finish line','finish');
  const select=document.createElement('select');select.setAttribute('aria-label','Voxel tool');for(const tool of tools)select.add(new Option(({add:'Add Block',brush:'Brush',erase:'Erase',paint:'Paint',pick:'Pick Color',select:'Selection / Transform',orbit:'Orbit'})[tool]||tool,tool));select.onchange=()=>api.safe('tool',{name:select.value});bar.append(select);
  const color=document.createElement('input');color.type='color';color.value='#dc8c3c';color.setAttribute('aria-label','Voxel color');const alpha=document.createElement('input');alpha.type='number';alpha.min=0;alpha.max=255;alpha.value=255;alpha.style.width='55px';alpha.setAttribute('aria-label','Voxel alpha');bar.append(color,alpha);const changeColor=()=>api.safe('color',{rgba:[...color.value.slice(1).match(/../g).map(v=>parseInt(v,16)),Number(alpha.value)]});color.onchange=alpha.onchange=changeColor;
  const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Voxel commands';details.append(summary);bar.append(details);
  const form=document.createElement('form'),action=document.createElement('select'),parameters=document.createElement('textarea'),submit=document.createElement('button');action.setAttribute('aria-label','Voxel action');parameters.setAttribute('aria-label','Action parameters (JSON)');parameters.rows=3;parameters.cols=45;submit.textContent='Run';for(const name of Object.keys(examples))action.add(new Option(name,name));const update=()=>parameters.value=JSON.stringify(examples[action.value]);action.onchange=update;update();form.append(action,parameters,submit);form.onsubmit=e=>{e.preventDefault();try{api.safe(action.value,JSON.parse(parameters.value));}catch(err){api.status.textContent=err.message;}};details.append(form);
  const size=document.createElement('input');size.type='number';size.min=1;size.max=16;size.value=1;size.style.width='50px';size.setAttribute('aria-label','Brush size');size.onchange=()=>api.safe('brush',{size:Number(size.value)});bar.append(size);
  const sync=()=>{build.sync();const active=api.getSelectedTool();for(const option of [...select.options])if(option.value.startsWith('extrude'))option.remove();if(active.startsWith('extrude'))select.add(new Option('Extrude '+(api.extrusion.axis||'Auto'),active));select.value=active;for(const option of select.options)option.disabled=!api.editing&&!['orbit','select','pick'].includes(option.value);const c=api.color();color.value='#'+c.slice(0,3).map(n=>n.toString(16).padStart(2,'0')).join('');alpha.value=c[3];size.value=api.brush.size;};
  api.element.addEventListener('gox-controls-changed',sync);sync();
  const observer=new MutationObserver(()=>{if(!host.isConnected)dispose();});observer.observe(document.body,{childList:true,subtree:true});
  function dispose(){observer.disconnect();api.element.removeEventListener('gox-controls-changed',sync);bar.remove();}host.__nvGoxControlsDispose=dispose;
  const help=document.createElement('p');help.textContent='Orbit: left drag; pan: right drag; zoom: wheel. Editing: left drag; Shift selects additively, Alt subtracts. Shapes: click start and end. Line: click vertices, then Finish line or Enter. Escape cancels. Ctrl+S saves; Ctrl+Z undoes. Commands accept integer voxel coordinates; layer indices start at 0.';help.style.cssText='margin:4px;font-size:12px';details.append(help);
}
