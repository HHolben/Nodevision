// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelWorldProperties.mjs
// This view adds procedural terrain properties to the existing object inspector without exposing mesh-level controls that cannot apply to streamed chunks. Its status timer belongs to the visible inspector and is released on hide or disposal.
import { openVoxelWorldDialog } from './VoxelWorldDialog.mjs';
import { getActiveMetaWorldLayerBridge, META_WORLD_LAYER_EVENTS } from '../MetaWorldLayerState.mjs';
export function createVoxelWorldProperties(host, ordinaryControls) {
  const container=document.createElement('section');container.dataset.voxelWorldProperties='';container.hidden=true;host.append(container);
  let timer=null, target=null;
  function hide(){clearInterval(timer);timer=null;target=null;container.hidden=true;ordinaryControls.style.display='flex';}
  function show(root){
    hide();target=root;ordinaryControls.style.display='none';container.hidden=false;container.replaceChildren();
    const runtime=root.userData.proceduralVoxelRuntime, def=runtime.serialize();
    const title=document.createElement('h3');title.textContent=def.name || 'Voxel World';
    const summary=document.createElement('p');
    summary.textContent=`Seed: ${def.generator.seed} · ${def.generator.id} / version ${def.generator.version}. Size: ${def.size[0]} × ${def.size[2]} m. Elevation: ${def.heightLimits?.min || 0} to ${def.heightLimits?.max ?? def.size[1]} m. Voxels: ${def.voxelSize} m; chunks: ${def.chunks.voxelsPerAxis}³. Position: ${def.position.join(', ')}.`;
    const edit=document.createElement('button');edit.textContent='Edit Generation Parameters';edit.onclick=()=>openVoxelWorldDialog(getActiveMetaWorldLayerBridge(),def.id);
    const status=document.createElement('p');status.setAttribute('role','status');
    const note=document.createElement('p');note.textContent='Terrain cells are generated and read-only. Authored objects are separate and survive regeneration. Move this object with the editor’s translation controls; rotation and scaling are unsupported.';
    container.append(title,summary,edit,status,note);
    const update=()=>{status.textContent=runtime.materialError ? 'Material loading failed: '+runtime.materialError.message : `${runtime.stats.loaded} chunks loaded; ${runtime.stats.queued} queued chunks/columns. Terrain streams as the camera moves.`;};
    update();timer=setInterval(update,500);return true;
  }
  const changed=()=>{if(target && !getActiveMetaWorldLayerBridge()?.listObjects().some(entry=>entry.id===target.userData.metaWorldLayerId))hide();};
  window.addEventListener(META_WORLD_LAYER_EVENTS.objectsChanged,changed);
  return {show,hide,dispose(){hide();window.removeEventListener(META_WORLD_LAYER_EVENTS.objectsChanged,changed);container.remove();}};
}
