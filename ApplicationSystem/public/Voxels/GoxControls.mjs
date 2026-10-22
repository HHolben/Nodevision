// Nodevision/ApplicationSystem/public/Voxels/GoxControls.mjs
// Accessible viewport tools, color controls and a shared-command form without a separate scripting engine.
export { pointerTools } from './VoxelBuildPointer.mjs';
import { buildTools } from './VoxelBuildPointer.mjs';
import { buildControls } from './VoxelBuildControls.mjs';
import { chunkKey,rgba } from './VoxelModel.mjs';
import { examples } from './GoxCommands.mjs';
export const tools=buildTools;
export function controls(api,host){
  const bar=document.createElement('div');bar.style.cssText='display:flex;flex-wrap:wrap;gap:4px;padding:5px;align-items:center';host.append(bar);
  function button(label,action,args){const b=document.createElement('button');b.textContent=label;b.onclick=()=>api.safe(action,args);bar.append(b);return b;}
  buildControls(api,bar);button('Save','save');button('Undo','undo');button('Redo','redo');button('Frame','frame');button('Layers','layers');button('Finish line','finish');
  const select=document.createElement('select');select.setAttribute('aria-label','Voxel tool');for(const tool of tools)select.add(new Option(tool,tool));select.onchange=()=>api.safe('tool',{name:select.value});bar.append(select);api.toolSelect=select;
  const color=document.createElement('input');color.type='color';color.value='#dc8c3c';color.setAttribute('aria-label','Voxel color');const alpha=document.createElement('input');alpha.type='number';alpha.min=0;alpha.max=255;alpha.value=255;alpha.style.width='55px';alpha.setAttribute('aria-label','Voxel alpha');bar.append(color,alpha);api.color=()=>[...color.value.slice(1).match(/../g).map(v=>parseInt(v,16)),Number(alpha.value)];api.pickColor=c=>{rgba(c);color.value='#'+c.slice(0,3).map(n=>n.toString(16).padStart(2,'0')).join('');alpha.value=c[3];};
  const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Voxel commands';details.append(summary);bar.append(details);
  const form=document.createElement('form'),action=document.createElement('select'),parameters=document.createElement('textarea'),submit=document.createElement('button');action.setAttribute('aria-label','Voxel action');parameters.setAttribute('aria-label','Action parameters (JSON)');parameters.rows=3;parameters.cols=45;submit.textContent='Run';for(const name of Object.keys(examples))action.add(new Option(name,name));const update=()=>parameters.value=JSON.stringify(examples[action.value]);action.onchange=update;update();form.append(action,parameters,submit);form.onsubmit=e=>{e.preventDefault();try{api.safe(action.value,JSON.parse(parameters.value));}catch(err){api.status.textContent=err.message;}};details.append(form);
  const size=document.createElement('input');size.type='number';size.min=1;size.max=16;size.value=1;size.style.width='50px';size.setAttribute('aria-label','Brush size');size.onchange=()=>api.safe('brush',{size:Number(size.value)});bar.append(size);
  const help=document.createElement('p');help.textContent='Orbit: left drag; pan: right drag; zoom: wheel. Editing: left drag; Shift selects additively, Alt subtracts. Shapes: click start and end. Line: click vertices, then Finish line or Enter. Escape cancels. Ctrl+S saves; Ctrl+Z undoes. Commands accept integer voxel coordinates; layer indices start at 0.';help.style.cssText='margin:4px;font-size:12px';details.append(help);
}
