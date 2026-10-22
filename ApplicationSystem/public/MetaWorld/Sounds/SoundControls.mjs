// Nodevision/ApplicationSystem/public/MetaWorld/Sounds/SoundControls.mjs
// Shared sound-property form for insertion and nested Layers editing, including embedded local audio.
export function soundControls(host,value={},apply,{remove}={}) {
  const form=document.createElement('form');form.style.cssText='display:grid;gap:6px;padding:8px';host.append(form);
  const field=(label,type,initial)=>{const row=document.createElement('label'),input=document.createElement('input');row.textContent=label+' ';input.type=type;if(type==='checkbox')input.checked=initial;else input.value=initial;row.append(input);form.append(row);return input;};
  const src=field('Audio path or URL','text',value.src?.startsWith('data:')?'':value.src||'');src.placeholder='audio/ambience.ogg';
  let embedded=value.src?.startsWith('data:')?value.src:null;
  const upload=field('Choose audio file','file','');upload.accept='audio/*';
  const volume=field('Volume (0–1)','number',value.volume??.8);volume.min='0';volume.max='1';volume.step='.05';volume.required=true;
  const range=field('Audible range (world units)','number',value.range??14);range.min='.1';range.max='10000';range.step='any';range.required=true;
  const loop=field('Loop','checkbox',value.loop!==false),enabled=field('Enabled','checkbox',value.enabled!==false);
  const status=document.createElement('output');status.textContent=embedded?'Embedded audio file':'';form.append(status);
  const save=document.createElement('button');save.type='submit';save.textContent='Apply sound';form.append(save);
  src.oninput=()=>{embedded=null;status.textContent='';};
  upload.onchange=async()=>{const file=upload.files[0];if(!file)return;save.disabled=true;try{embedded=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('Unable to read audio file.'));reader.readAsDataURL(file);});src.value='';status.textContent=file.name;}catch(error){status.textContent=error.message;}finally{save.disabled=false;}};
  form.onsubmit=event=>{event.preventDefault();event.stopPropagation();try{apply({src:embedded||src.value,volume:volume.valueAsNumber,range:range.valueAsNumber,loop:loop.checked,enabled:enabled.checked});status.textContent='Sound applied.';}catch(error){status.textContent=error.message;}};
  if(remove){const button=document.createElement('button');button.type='button';button.textContent='Remove sound';button.onclick=()=>{try{remove();}catch(error){status.textContent=error.message;}};form.append(button);}
  return form;
}
export function renderSoundProperty(wrapper,entry,bridge) {
  if(!bridge?.setSoundProperty||['sound','sound-object'].includes(entry.type))return;
  const details=document.createElement('details');details.dataset.soundParent=entry.id;details.style.cssText='margin:4px 6px 6px 22px;border-left:2px solid #7c98b0;padding-left:8px';
  const summary=document.createElement('summary');summary.textContent=entry.soundProperty?'♫ Sound':'＋ Add Sound property';details.append(summary);wrapper.append(details);
  details.addEventListener('toggle',()=>{if(details.open&&!details.querySelector('form'))soundControls(details,entry.soundProperty||{},sound=>{if(bridge.setSoundProperty(entry.id,sound)===false)throw Error('Sound editing is unavailable in this view.');},{remove:entry.soundProperty?()=>{if(bridge.setSoundProperty(entry.id,null)===false)throw Error('Sound editing is unavailable in this view.');}:null});});
}
