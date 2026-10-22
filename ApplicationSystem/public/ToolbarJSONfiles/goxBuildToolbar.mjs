// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/goxBuildToolbar.mjs
// Routes standard View/Insert toolbar controls to the active native GOX document.
import { executeVoxelCommand } from '/Voxels/GoxCommands.mjs';
import { buildTools } from '/Voxels/VoxelBuildPointer.mjs';
export function initToolbarWidget(host){
 const invoke=(action,args)=>executeVoxelCommand([action,args]).catch(error=>{const api=window.__nvGoxActive;if(api)api.status.textContent=error.message;});
 const modes=document.createElement('select');modes.setAttribute('aria-label','GOX mode');modes.add(new Option('Interaction mode',''));for(const mode of ['view','build','selection'])modes.add(new Option(mode,mode));modes.onchange=()=>{if(modes.value)invoke('mode',{name:modes.value});};
 const tools=document.createElement('select');tools.setAttribute('aria-label','GOX building tool');tools.add(new Option('Choose tool',''));for(const tool of buildTools)tools.add(new Option(tool,tool));tools.onchange=()=>{if(tools.value)invoke('tool',{name:tools.value});};
 const settings=document.createElement('button');settings.textContent='Tool settings (G)';settings.onclick=()=>invoke('settings-open',{});host.append(modes,tools,settings);
}
