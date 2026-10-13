// Nodevision/ApplicationSystem/public/MetaWorld/ProceduralVoxelWorld/VoxelWorldDialog.mjs
// This dialog collects a compact procedural terrain definition using the existing floating-panel component. Validation and cancellation happen before scene mutation, and the dialog closes when its owning world bridge changes.
import { createFloatingInventoryPanel } from '../../PanelInstances/InfoPanels/PlayerInventory.mjs';
import { getActiveMetaWorldLayerBridge, META_WORLD_LAYER_EVENTS } from '../MetaWorldLayerState.mjs';
import { worldAuthoringAllowed } from '../WorldAuthoringPermissions.mjs';
import { definitionFromVoxelForm, voxelWorldForm } from './VoxelAuthoringDefinition.mjs';
export function openVoxelWorldDialog(bridge = getActiveMetaWorldLayerBridge(), objectId = null) {
  if(!bridge?.addVoxelWorld || !worldAuthoringAllowed(window.VRWorldContext?.movementState))return false;
  if(bridge.voxelWorldDialog){bridge.voxelWorldDialog.panel.setVisible(true);return bridge.voxelWorldDialog;}
  const previous=objectId ? bridge.getVoxelWorldDefinition(objectId) : null;
  if(objectId && !previous)return false;
  const values=voxelWorldForm(previous), fields={};
  let closed=false;
  function close(){
    if(closed)return;closed=true;
    window.removeEventListener(META_WORLD_LAYER_EVENTS.bridgeChanged,close);
    panel.dispose();delete bridge.voxelWorldDialog;
  }
  const panel=createFloatingInventoryPanel({title:objectId?'Edit Generation Parameters':'Insert Voxel World',onRequestClose:close});
  const form=document.createElement('form');form.dataset.voxelWorldDialog='';form.style.cssText='display:grid;gap:8px;max-height:75vh;overflow:auto';
  panel.content.append(form);
  function field(key,label,type='number',parent=form){
    const row=document.createElement('label');row.textContent=label;row.style.cssText='display:flex;gap:12px;justify-content:space-between';
    const input=document.createElement('input');input.name=key;input.type=type;
    if(type==='checkbox')input.checked=values[key];else {input.value=values[key];input.required=true;}
    if(type==='number')input.step='.25';
    row.append(input);parent.append(row);fields[key]=input;return input;
  }
  field('name','World Name','text').maxLength=120;field('seed','Seed','text').maxLength=256;
  for(const [key,label] of [['sizeX','World Size X (m)'],['sizeZ','World Size Z (m)'],['maxHeight','Maximum Height (m)'],['minHeight','Minimum Height (m)'],['voxelSize','Voxel Size (m)'],['chunkSize','Chunk Size (voxels)']])field(key,label);
  fields.voxelSize.readOnly=fields.chunkSize.readOnly=true;
  const terrain=document.createElement('label');terrain.textContent='Terrain Type ';const select=document.createElement('select');
  select.add(new Option('Existing terrain generator (V1)','nodevision-terrain-v1'));terrain.append(select);form.append(terrain);
  const advanced=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Advanced';advanced.append(summary);form.append(advanced);
  field('vegetation','Trees and vegetation','checkbox',advanced);field('water','Generate water','checkbox',advanced);field('caves','Generate caves','checkbox',advanced);
  const note=document.createElement('p');note.textContent='V1 uses 0.25 m voxels and 32-voxel chunks. Heights are relative to the object origin; terrain streams near the camera. Biomes and materials follow the existing generator. Generated cells are read-only; manual cell edits are not saved.';form.append(note);
  const status=document.createElement('div');status.setAttribute('role','status');form.append(status);
  const actions=document.createElement('div'),generate=document.createElement('button'),cancel=document.createElement('button');
  generate.type='submit';generate.textContent=objectId?'Regenerate':'Generate';cancel.type='button';cancel.textContent='Cancel';cancel.onclick=close;actions.append(generate,cancel);form.append(actions);
  form.addEventListener('keydown',event=>{event.stopPropagation();if(event.key==='Escape'){event.preventDefault();close();}});
  form.onsubmit=event=>{
    event.preventDefault();if(generate.disabled||closed)return;
    try {
      if(getActiveMetaWorldLayerBridge()!==bridge)throw Error('The active world changed. Reopen Insert → Voxel World.');
      const input=Object.fromEntries(Object.entries(fields).map(([key,field])=>[key,field.type==='checkbox'?field.checked:field.value]));
      const def=definitionFromVoxelForm(input,previous);generate.disabled=true;
      const result=objectId?bridge.regenerateVoxelWorld(objectId,def):bridge.addVoxelWorld(def);
      if(!result)throw Error('This world is not currently editable.');
      close();
    } catch(error){status.textContent=error.message;generate.disabled=false;}
  };
  window.addEventListener(META_WORLD_LAYER_EVENTS.bridgeChanged,close);
  bridge.voxelWorldDialog={panel,close};panel.setVisible(true);fields.name.focus();return bridge.voxelWorldDialog;
}
