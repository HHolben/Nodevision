import {chooseConstructionEdit} from '../ConstructionEditing/Controls.mjs';
// Nodevision/ApplicationSystem/public/MetaWorld/Constructions/Properties.mjs
// Construction settings in the existing inspector preserve activation separately from visual visibility.
import {getActiveMetaWorldLayerBridge,META_WORLD_LAYER_EVENTS} from '../MetaWorldLayerState.mjs';
import {definitionFields,field} from './Controls.mjs';
export function createConstructionProperties(host,ordinary){
 const section=document.createElement('section');section.dataset.constructionProperties='';section.hidden=true;host.append(section);let target=null;
 function hide(){target?.userData?.constructionRuntime?.setSelected(false);target=null;section.hidden=true;ordinary.style.display='flex';}
 function show(object){hide();target=object;ordinary.style.display='none';section.hidden=false;section.replaceChildren();const runtime=object.userData.constructionRuntime,def=runtime.getDefinition(),id=runtime.source.id;runtime.setSelected(true);
  const heading=document.createElement('h3');heading.textContent=def?.name||'Unresolved construction';section.append(heading);const status=document.createElement('output');status.setAttribute('role','status');status.textContent=runtime.warning;
  const update=async patch=>{try{await getActiveMetaWorldLayerBridge().updateConstruction(id,patch);const next=window.VRWorldContext.objects.find(o=>o.userData.metaWorldLayerId===id);if(window.VRWorldContext.objectInspector)window.VRWorldContext.objectInspector.inspectTarget(next);else show(next);}catch(e){status.textContent=e.message;}};
  if(def){definitionFields(section,def,update);field(section,'Active (terrain and collision)',runtime.source.active!==false,active=>update({active}),'checkbox');field(section,'Visible (geometry only)',object.visible,visible=>update({visible}),'checkbox');}
  field(section,'Construction reference',runtime.source.constructionFile,constructionFile=>update({constructionFile}));
  const edit=document.createElement('button');edit.textContent='Edit Construction';edit.disabled=!def;edit.onclick=()=>{try{chooseConstructionEdit({id});}catch(e){status.textContent=e.message;}};section.append(edit);
  const save=document.createElement('button');save.textContent='Save construction definition';save.disabled=!def;save.onclick=async()=>{try{status.textContent='Saved '+await getActiveMetaWorldLayerBridge().saveConstruction(id);}catch(e){status.textContent=e.message;}};
  const remove=document.createElement('button');remove.textContent='Remove from world';remove.onclick=()=>{getActiveMetaWorldLayerBridge().removeObjectLayer(id);hide();};section.append(save,remove,status);if(!runtime.loaded)runtime.ready.then(()=>{if(target===object&&!runtime.disposed)show(object);});return true;
 }
 const changed=()=>{if(target&&!window.VRWorldContext?.objects.includes(target))hide();};window.addEventListener(META_WORLD_LAYER_EVENTS.objectsChanged,changed);
 return {show,hide,dispose(){hide();window.removeEventListener(META_WORLD_LAYER_EVENTS.objectsChanged,changed);section.remove();}};
}
