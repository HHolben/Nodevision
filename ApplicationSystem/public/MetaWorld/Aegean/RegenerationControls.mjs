// Nodevision/ApplicationSystem/public/MetaWorld/Aegean/RegenerationControls.mjs
// These inspector controls communicate vegetation-only regeneration scopes and commit through the existing terrain bridge and undo history.
import { AEGEAN_BIOMES } from './Biomes.mjs';
import { regenerateVegetationDefinition } from './Regeneration.mjs';
export function appendRegenerationControls(host,def,bridge) {
  if(def.environment?.id!=='aegean')return;
  const form=document.createElement('form'),title=document.createElement('p');title.textContent='Regenerate procedural vegetation only. Ground, paths and authored objects are preserved. Bounds are local meters from the terrain minimum corner.';form.append(title);
  const fields=[];
  for(const [label,value] of [['Min X',0],['Min Z',0],['Max X',def.size[0]],['Max Z',def.size[2]]]){
    const row=document.createElement('label');row.textContent=label+' ';const input=document.createElement('input');input.type='number';input.step='.25';input.value=value;input.required=true;row.append(input);form.append(row);fields.push(input);
  }
  const select=document.createElement('select');select.setAttribute('aria-label','Regenerate biome');select.add(new Option('All biomes',''));
  for(const biome of AEGEAN_BIOMES)select.add(new Option(biome.name,biome.id));form.append(select);
  const submit=document.createElement('button');submit.type='submit';submit.textContent='Regenerate vegetation in this scope';form.append(submit);
  const status=document.createElement('p');status.setAttribute('role','status');form.append(status);
  form.onsubmit=event=>{event.preventDefault();try{
    const current=bridge.getVoxelWorldDefinition(def.id);if(!current)throw Error('Terrain no longer exists.');
    const next=regenerateVegetationDefinition(current,{bounds:fields.map(f=>Number(f.value)*4),biome:select.value||null});
    if(!bridge.regenerateVoxelWorld(def.id,next))throw Error('World is not editable.');
  }catch(error){status.textContent=error.message;}};
  host.append(form);
}
