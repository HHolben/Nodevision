// Nodevision/ApplicationSystem/public/MetaWorld/Text/TextEditor.mjs
// This module provides native Unicode editing with live previews, explicit commit and cancel, and a single world-history transaction per edit.

import {getActiveMetaWorldLayerBridge} from '../MetaWorldLayerState.mjs';
import {normalizeText,SIGN_PRESETS,APPEARANCES} from './TextDefinition.mjs';
import {signPresetPatch} from './TextPresets.mjs';
import {addMaterialChoices,addNotebookFontPicker,addGreekInsertion} from './TextEditorHelpers.mjs';
import {createTextObject} from './TextRuntime.mjs';
import {worldAuthoringAllowed} from '../WorldAuthoringPermissions.mjs';
let active=null;
export function openTextEditor(target=null,initial={}) {
 const ctx=window.VRWorldContext;if(!worldAuthoringAllowed(ctx?.movementState))return false;
 active?.();const bridge=getActiveMetaWorldLayerBridge(),runtime=target?.userData?.textRuntime;
 const original=runtime?.serialize(),draft=normalizeText(original||initial),dialog=document.createElement('dialog');
 let previewObject=null;
 if(!runtime){previewObject=createTextObject(ctx.THREE,draft);const parent=ctx.objects.find(o=>o.userData.metaWorldLayerId===draft.parentId)||ctx.scene;parent.add(previewObject);}
 const previewRuntime=runtime||previewObject?.userData.textRuntime;
 dialog.setAttribute('aria-label','World text properties');Object.assign(dialog.style,{width:'min(560px,90vw)',maxHeight:'85vh',overflow:'auto'});
 const heading=document.createElement('h3');heading.textContent='Text and sign properties';dialog.append(heading);
 const notice=document.createElement('p');notice.textContent='Surface placement is planar. Engraving is visual only; collision geometry is unchanged. Raised contours have limited resolution.';dialog.append(notice);
 const form=document.createElement('div');Object.assign(form.style,{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px'});dialog.append(form);
 let timer;
 function preview(){clearTimeout(timer);timer=setTimeout(()=>{try{previewRuntime?.update(normalizeText(draft));}catch(error){notice.textContent=error.message;}},100);}
 function field(key,label,options=null,type='text',container=draft) {
  const row=document.createElement('label');row.textContent=label;row.style.display='grid';
  const input=document.createElement(options?'select':key==='content'?'textarea':'input');
  if(options)for(const value of options){const option=document.createElement('option');option.value=value;option.textContent=value;input.append(option);}
  else if(key!=='content'){input.type=type;if(type==='number')input.step='any';}
  if(key==='content'){input.rows=5;row.style.gridColumn='1 / -1';}
  if(container===draft)input.dataset.textKey=key;input.setAttribute('aria-label',label);input.value=container[key]??'';input.addEventListener('input',()=>{container[key]=type==='number'?Number(input.value):input.value;if(key==='roughness'||key==='metalness'){draft.materialProperties=false;refreshFields();}preview();});row.append(input);form.append(row);return input;
 }
 const content=field('content','Content');const font=field('font','Font family');const fontUrl=field('fontUrl','Font URL (application or /Notebook/ path)');
 font.addEventListener('input',()=>{draft.fontUrl='';fontUrl.value='';preview();});
 const fontPreset=field('fontPreset','Greek font style',['classical-inspired','modern','handwritten']);fontPreset.onchange=()=>{
  draft.font=fontPreset.value==='modern'?'sans-serif':fontPreset.value==='handwritten'?'cursive':'serif';
  draft.fontUrl=fontPreset.value==='handwritten'?'':'/fonts/dejavu/'+(fontPreset.value==='modern'?'DejaVuSans.ttf':'DejaVuSerif.ttf');font.value=draft.font;fontUrl.value=draft.fontUrl;preview();
 };
 field('parentId','Parent layer ID (blank for independent object)');field('emissive','Emissive color (optional)');
 field('kind','Text type',['free-standing','surface','engraved','raised','sign']);
 field('alignment','Alignment',['left','center','right']);field('color','Color',null,'color');field('background','Background color (optional)');
 for(const [k,label] of Object.entries({width:'Wrapping width',height:'Height',fontSize:'Font size',lineSpacing:'Line spacing',letterSpacing:'Letter spacing',opacity:'Opacity',depth:'Extrusion depth',bevel:'Bevel (raster contour)',engravingDepth:'Visual engraving depth',surfaceOffset:'Surface offset',roughness:'Roughness',metalness:'Metalness',weathering:'Weathering',thickness:'Sign thickness',maxDistance:'Visibility distance'}))field(k,label,null,'number');
 for(const k of ['material','sideMaterial','surfaceMaterial','frameMaterial'])field(k,k+' (catalog ID)');
 const signPreset=field('signPreset','Sign preset',SIGN_PRESETS);signPreset.onchange=()=>{Object.assign(draft,signPresetPatch(signPreset.value));refreshFields();preview();};field('displayMode','Memory visibility',['always','interaction','learning','hide-recall']);
 for(const key of ['frame','support','materialProperties']){const row=document.createElement('label'),input=document.createElement('input');input.type='checkbox';input.dataset.textKey=key;input.checked=draft[key];input.onchange=()=>{draft[key]=input.checked;preview();};row.append(input,document.createTextNode(key==='materialProperties'?'Use material shading':key));form.append(row);}
 for(const key of ['position','rotation','scale'])for(let i=0;i<3;i++)field(i,`${key} ${'XYZ'[i]}${key==='rotation'?' (radians)':''}`,null,'number',draft[key]);
 for(const key of ['file','memoryAnchor','station','audio','note'])field(key,key+' reference',null,'text',draft.links);
 function refreshFields(){for(const input of form.querySelectorAll('[data-text-key]')){const key=input.dataset.textKey;if(!(key in draft))continue;if(input.type==='checkbox')input.checked=draft[key];else input.value=draft[key];}}
 const preset=field('appearance','Appearance preset',['',...Object.keys(APPEARANCES)]);preset.onchange=()=>{Object.assign(draft,APPEARANCES[preset.value]);refreshFields();preview();};
 addGreekInsertion(dialog,content,()=>{draft.content=content.value;preview();});
 addMaterialChoices(form);
 addNotebookFontPicker(dialog,patch=>{Object.assign(draft,patch);refreshFields();preview();},error=>{notice.textContent=error.message;});
 const fontNote=document.createElement('p');fontNote.textContent='Greek styles: sans-serif (modern), serif (classical inspired), cursive (handwritten). Historical styles are not exact reconstructions. Missing fonts fall back to serif.';dialog.append(fontNote);
 function finish(){clearTimeout(timer);previewObject?.userData.textRuntime.dispose();dialog.close();dialog.remove();if(ctx?.movementState)ctx.movementState.textEditing=false;active=null;}
 function cancel(){if(runtime)runtime.update(original);finish();}
 for(const [label,action] of [['Apply',()=>{try{clearTimeout(timer);if(runtime)runtime.update(original);bridge.updateText(original?.id,draft);finish();}catch(error){notice.textContent=error.message;}}],['Cancel',cancel],...(original?[['Duplicate',()=>{cancel();bridge.duplicateText(original.id);}],['Copy object',()=>bridge.copyText(original.id)],['Paste object',()=>{cancel();bridge.pasteText();}],['Delete',()=>{cancel();bridge.removeObjectLayer(original.id);}]]:[])]){
  const button=document.createElement('button');button.textContent=label;button.type='button';button.onclick=action;dialog.append(button);
 }
 dialog.addEventListener('cancel',event=>{event.preventDefault();cancel();});
 // Native textarea history and clipboard shortcuts remain local to the dialog.
 for(const type of ['keydown','keyup','pointerdown','pointerup'])dialog.addEventListener(type,event=>event.stopPropagation());
 document.body.append(dialog);document.exitPointerLock?.();window.dispatchEvent(new Event('blur'));
 if(ctx?.movementState)ctx.movementState.textEditing=true;active=cancel;dialog.showModal();content.focus();return true;
}
