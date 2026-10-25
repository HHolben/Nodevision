// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/terrainRepresentationWidget.mjs
// Presents the active generated terrain and its persisted geometric representation with native keyboard-accessible controls.
import {terrainRepresentationCommand} from '../MetaWorld/TerrainRepresentation/Command.mjs';
export function initToolbarWidget(host){
  const terrain=document.createElement('select'),mode=document.createElement('select'),status=document.createElement('output');
  terrain.setAttribute('aria-label','Generated terrain');mode.setAttribute('aria-label','Terrain representation');status.setAttribute('role','status');
  for(const [value,label] of [['voxel','Voxel'],['polygonal','Polygonal']])mode.add(new Option(label,value));
  let entries=[];
  async function refresh(){try{entries=await terrainRepresentationCommand(['list']);const previous=terrain.value;terrain.replaceChildren(...entries.map(e=>new Option(e.name,e.id)));if(entries.some(e=>e.id===previous))terrain.value=previous;mode.disabled=!entries.length;mode.value=entries.find(e=>e.id===terrain.value)?.representation||'voxel';status.textContent=entries.length?'':'No generated terrain in this world.';}catch(error){mode.disabled=true;status.textContent=error.message;}}
  terrain.onchange=()=>{mode.value=entries.find(e=>e.id===terrain.value)?.representation||'voxel';};
  mode.onchange=async()=>{mode.disabled=true;terrain.disabled=true;status.textContent='Preparing terrain…';try{const changed=await terrainRepresentationCommand([mode.value,terrain.value]);status.textContent=changed?'Terrain representation updated.':'Terrain changed during preparation; try again.';}catch(error){status.textContent=error.message;}finally{terrain.disabled=false;const message=status.textContent;await refresh();status.textContent=message;}};
  host.append(terrain,mode,status);void refresh();
}
