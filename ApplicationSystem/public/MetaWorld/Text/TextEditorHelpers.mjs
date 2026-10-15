// Nodevision/ApplicationSystem/public/MetaWorld/Text/TextEditorHelpers.mjs
// This module reuses the Notebook font picker and world material catalog and exposes optional Greek insertion controls in the text properties dialog.
import {GREEK_UPPER,GREEK_LOWER} from './TextDefinition.mjs';
import {greekInscription} from './TextPresets.mjs';
import {loadWorldObjectMaterialCatalog} from '../Materials/WorldObjectMaterialDefaults.mjs';
export function addMaterialChoices(form) {
 const list=document.createElement('datalist');list.id='nv-text-materials-'+crypto.randomUUID();form.append(list);
 for(const input of form.querySelectorAll('input[data-text-key$="Material"],input[data-text-key="material"]'))input.setAttribute('list',list.id);
 loadWorldObjectMaterialCatalog().then(entries=>{if(!form.isConnected)return;for(const entry of entries){const option=document.createElement('option');option.value=entry.materialId;option.label=entry.materialName||entry.materialId;list.append(option);}}).catch(()=>{});
}
export function addNotebookFontPicker(host,onPick,onError) {
 const button=document.createElement('button');button.type='button';button.textContent='Choose Notebook font…';
 const mount=document.createElement('div');mount.hidden=true;host.append(button,mount);
 button.onclick=async()=>{
  try{const {renderFontPicker}=await import('../../ToolbarJSONfiles/insertMediaFont.mjs');mount.hidden=false;
   renderFontPicker(mount,{allowNotebookFile:true,allowExternalUrl:false},font=>{if(font){onPick({font:font.fallback||'serif',fontUrl:'/'+font.notebookPath.replace(/^\/+/, '')});}mount.hidden=true;},onError);
  }catch(error){onError(error);}
 };
}
export function addGreekInsertion(host,textarea,onChange) {
 const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Greek inscription';details.append(summary);
 const controls=document.createElement('div');controls.style.display='flex';controls.style.flexWrap='wrap';controls.style.gap='4px';details.append(controls);
 const names=document.createElement('input');names.type='checkbox';const label=document.createElement('label');label.append(names,document.createTextNode('Include letter name'));details.append(label);
 const lower=document.createElement('input');lower.type='checkbox';const lowerLabel=document.createElement('label');lowerLabel.append(lower,document.createTextNode('Lowercase'));details.append(lowerLabel);
 GREEK_UPPER.split(' ').forEach((letter,index)=>{const button=document.createElement('button');button.type='button';button.textContent=letter;
  button.onclick=()=>{textarea.setRangeText(greekInscription(index,{lowercase:lower.checked,withName:names.checked}),textarea.selectionStart,textarea.selectionEnd,'end');textarea.focus();onChange();};controls.append(button);
 });
 const sigma=document.createElement('button');sigma.type='button';sigma.textContent='ς';sigma.onclick=()=>{textarea.setRangeText('ς',textarea.selectionStart,textarea.selectionEnd,'end');textarea.focus();onChange();};controls.append(sigma);
 const help=document.createElement('p');help.textContent=GREEK_LOWER;details.append(help);host.append(details);
}
