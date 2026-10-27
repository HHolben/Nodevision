// Nodevision/ApplicationSystem/public/MetaWorld/Constructions/Controls.mjs
// Numeric construction fields shared by the Insert dialog and native object inspector.
export function field(host,label,value,change,type='text'){
 const row=document.createElement('label');row.style.cssText='display:grid;grid-template-columns:1fr 1fr;gap:8px;margin:6px 0';row.textContent=label;
 const input=document.createElement('input');input.type=type;input.setAttribute('aria-label',label);input.style.minWidth='0';if(type==='checkbox')input.checked=value;else input.value=value;if(type==='number')input.step=1;
 input.onchange=()=>change(type==='checkbox'?input.checked:type==='number'?Number(input.value):input.value);row.append(input);host.append(row);return input;
}
export function definitionFields(host,def,change){
 field(host,'Name',def.name,name=>change({name}));
 for(let i=0;i<3;i++)field(host,'Position '+ 'XYZ'[i]+' (voxels)',def.position[i],value=>{const position=def.position.slice();position[i]=value;change({position});},'number');
 field(host,'GOX reference (relative to construction)',def.geometry?.source||'',source=>change({geometry:source?{source,position:def.geometry?.position||[0,0,0]}:null}));
 if(def.geometry)for(let i=0;i<3;i++)field(host,'Geometry offset '+ 'XYZ'[i]+' (voxels)',def.geometry.position[i],value=>{const position=def.geometry.position.slice();position[i]=value;change({geometry:{...def.geometry,position}});},'number');
}
