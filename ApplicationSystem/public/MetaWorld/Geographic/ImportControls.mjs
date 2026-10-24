// Nodevision/ApplicationSystem/public/MetaWorld/Geographic/ImportControls.mjs
// This module builds the shared keyboard-accessible geographic import controls and delegates Notebook selection to the existing file manager picker.
import { DEFAULT_MAPPING,GEOGRAPHIC_BIOMES,MAPPING_NOTE } from './Biomes.mjs';
export function importControls(form,old,invalidate) {
  const host=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent='Geographic terrain';host.append(legend);form.append(host);const controls={};
  function input(key,label,value='',type='text') {
    const row=document.createElement('label');row.style.display='block';row.append(label+' ');const el=document.createElement('input');el.name='geo_'+key;el.type=type;el.value=value??'';row.append(el);host.append(row);controls[key]=el;return el;
  }
  for(const [key,label,value] of [['elevation','Elevation GeoTIFF',old?.elevation?.asset.path],['landcover','Land-cover GeoTIFF (optional)',old?.landcover?.asset.path??old?.landcoverSource?.path],['kml','KML polygons (optional)',old?.kml?.path]]) {
    const el=input(key,label,value),button=document.createElement('button');button.type='button';button.textContent='Browse Notebook';el.parentElement.append(button);
    button.onclick=async()=>{
      const root=document.createElement('div');host.append(root);const {mountImageMapNotebookPicker}=await import('../../PanelInstances/Common/ImageMap/ImageMapNotebookPicker.mjs');if(!root.isConnected)return;
      const picker=mountImageMapNotebookPicker(root,{onDone:({path,isDirectory})=>{if(isDirectory)return;el.value='/Notebook/'+path.split('/').map(encodeURIComponent).join('/');invalidate(key);picker.destroy();root.remove();},onCancel:()=>{picker.destroy();root.remove();}});
    };
  }
  input('crop','Crop west,south,east,north (degrees; blank = center or selected polygon)',old?.crop?.join(',')??'');
  input('horizontalScale','World meters per geographic meter',old?.horizontalScale??1,'number').step='any';
  input('verticalExaggeration','Vertical exaggeration',old?.verticalExaggeration??1,'number').step='any';
  input('verticalOffset','Vertical offset (m; blank = crop minimum at 1 m)',old?.verticalOffset??'','number').step='any';
  function select(key,label,entries,value){const row=document.createElement('label');row.textContent=label+' ';const el=document.createElement('select');el.name='geo_'+key;for(const [id,name] of entries)el.add(new Option(name,id));el.value=value;row.append(el);host.append(row);controls[key]=el;return el;}
  select('defaultBiome','Default biome',GEOGRAPHIC_BIOMES.map(b=>[b,b]),old?.defaultBiome??'temperate');
  select('boundary','Crop polygon',[['','No polygon'],...(old?.regions??[]).map(r=>[r.id,r.name])],old?.boundary??'');
  input('mapping','WorldCover mapping (JSON)',JSON.stringify(old?.mapping??DEFAULT_MAPPING));input('attribution','Source attribution',old?.attribution??'');
  input('detail','Add procedural surface detail (up to 0.25 m)','','checkbox').checked=old?.detail??false;
  const note=document.createElement('p');note.textContent=MAPPING_NOTE+' Elevation uses source meters with no datum conversion. Voxels do not increase survey resolution. Preview changes are adopted only by Generate / Regenerate. Version-1 saved terrain stays unchanged until explicitly reimported.';host.append(note);
  for(const [key,c] of Object.entries(controls))c.addEventListener('input',()=>invalidate(key));
  const buttons={};for(const label of ['Fit to source','Fit bounds to polygon','Fit to available coverage','Reset crop','Import / Preview','Cancel import']){const button=document.createElement('button');button.type='button';button.textContent=label;host.append(button);buttons[label]=button;}
  const status=document.createElement('pre');status.style.cssText='white-space:pre-wrap;max-width:600px';status.setAttribute('aria-live','polite');status.dataset.geographicPreview='';host.append(status);
  const canvas=document.createElement('canvas');canvas.width=360;canvas.height=220;canvas.setAttribute('aria-label','Source coverage, requested bounds, effective terrain and missing data');host.append(canvas);
  const heightmap=document.createElement('canvas');heightmap.width=heightmap.height=96;host.append(heightmap);
  return {host,controls,buttons,status,canvas,heightmap};
}
