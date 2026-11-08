// Nodevision/ApplicationSystem/public/MetaWorld/TerrainLOD/Controls.mjs
// This module adds ordinary landscape visibility preferences to the existing terrain inspector. Changes pass through the world's authoring bridge so persistence and undo use the same document history as other terrain settings.
import {getActiveMetaWorldLayerBridge} from '../MetaWorldLayerState.mjs';
import {worldAuthoringAllowed} from '../WorldAuthoringPermissions.mjs';
export function appendTerrainStreamingControls(host,runtime) {
  if(!runtime.lod)return;
  const settings=runtime.lod.settings,box=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent='Landscape visibility';box.append(legend);
  const controls={};
  for(const [key,label,type] of [['enabled','Show distant terrain','checkbox'],['predictive','Prepare terrain ahead of movement','checkbox'],['visibilityDistance','Terrain visibility (metres)','number'],['vegetationEnabled','Show distant vegetation','checkbox'],['vegetationDistance','Vegetation visibility (metres)','number']]){
    const row=document.createElement('label'),input=document.createElement('input');row.textContent=label+' ';input.type=type;input.setAttribute('aria-label',label);
    if(type==='checkbox')input.checked=settings[key];else{input.value=settings[key];input.min=key==='vegetationDistance'?32:64;input.max=key==='vegetationDistance'?512:2048;input.step=32;}
    controls[key]=input;row.append(input);box.append(row,document.createElement('br'));
  }
  const apply=document.createElement('button'),status=document.createElement('output');apply.textContent='Apply landscape settings';status.setAttribute('role','status');
  box.disabled=!worldAuthoringAllowed(window.VRWorldContext?.movementState);
  apply.onclick=()=>{try{getActiveMetaWorldLayerBridge().setTerrainStreaming(runtime.definition.id,{...settings,enabled:controls.enabled.checked,predictive:controls.predictive.checked,visibilityDistance:Number(controls.visibilityDistance.value),vegetationEnabled:controls.vegetationEnabled.checked,vegetationDistance:Number(controls.vegetationDistance.value)});status.textContent='Landscape settings updated.';}catch(error){status.textContent=error.message;}};
  box.append(apply,status);host.append(box);
}
