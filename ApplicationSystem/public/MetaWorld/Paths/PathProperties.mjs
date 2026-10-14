// Nodevision/ApplicationSystem/public/MetaWorld/Paths/PathProperties.mjs
// This module adds path settings and control-point editing to the existing object inspector using the world layer bridge for validation, persistence, selection, and undo.
import { getActiveMetaWorldLayerBridge, META_WORLD_LAYER_EVENTS } from '../MetaWorldLayerState.mjs';
import { loadWorldObjectMaterialCatalog } from '../Materials/WorldObjectMaterialDefaults.mjs';
import { bindPathHandles } from './PathInteraction.mjs';
export function createPathProperties(host,ordinaryControls) {
  const section=document.createElement('section');section.dataset.pathProperties='';section.hidden=true;host.append(section);
  Object.assign(section.style,{display:'none',gap:'8px',maxWidth:'100%',overflow:'auto',font:ordinaryControls.style.font});
  let target=null,release=()=>{},generation=0;
  function hide(){generation++;release();release=()=>{};target?.userData.pathRuntime.setSelected(false);target=null;section.hidden=true;section.style.display='none';ordinaryControls.style.display='flex';}
  function show(mesh){
    hide();target=mesh;const token=generation,runtime=mesh.userData.pathRuntime,def=runtime.serialize();runtime.setSelected(true);
    ordinaryControls.style.display='none';section.hidden=false;section.style.display='grid';section.replaceChildren();
    const heading=document.createElement('h3');heading.textContent=def.name;heading.style.overflowWrap='anywhere';
    const status=document.createElement('output');status.setAttribute('role','status');status.style.color='#ad3030';status.textContent=runtime.warning||'';
    const update=patch=>{try{getActiveMetaWorldLayerBridge()?.updatePath(def.id,patch);}catch(error){status.textContent=error.message;}};
    section.append(heading);
    function field(label,value,change,{choices,type='text',min,max,step}={}) {
      const row=document.createElement('label');Object.assign(row.style,{display:'grid',gridTemplateColumns:'minmax(95px,1fr) minmax(0,1fr)',gap:'8px',alignItems:'center'});
      const input=document.createElement(choices?'select':'input');input.setAttribute('aria-label',label);
      if(choices)for(const value of choices){const o=document.createElement('option');o.value=value;o.textContent=value;input.append(o);}
      else {input.type=type;if(min!==undefined)input.min=min;if(max!==undefined)input.max=max;if(step!==undefined)input.step=step;}
      input.style.minWidth='0';input.style.width=type==='checkbox'?'auto':'100%';input.style.justifySelf='start';input.style.boxSizing='border-box';
      if(type==='checkbox')input.checked=value;else input.value=value;
      input.onchange=()=>change(type==='checkbox'?input.checked:type==='number'?Number(input.value):input.value);
      row.append(document.createTextNode(label),input);section.append(row);return input;
    }
    field('Name',def.name,name=>update({name}));
    field('Width (m)',def.width,width=>update({width}),{type:'number',min:.1,max:50,step:.1});
    field('Interpolation',def.interpolation,interpolation=>update({interpolation}),{choices:['smooth','straight']});
    field('Elevation',def.elevationMode,elevationMode=>update({elevationMode}),{choices:['authored','follow-terrain']});
    field('Terrain',def.terrainInteraction,terrainInteraction=>update({terrainInteraction}),{choices:['grade','none']});
    field('Transition (m)',def.transitionWidth,transitionWidth=>update({transitionWidth}),{type:'number',min:0,max:50,step:.1});
    const material=field('Surface material',def.surfaceMaterial,surfaceMaterial=>update({surfaceMaterial}),{choices:[def.surfaceMaterial]});
    loadWorldObjectMaterialCatalog().then(entries=>{if(token!==generation)return;for(const entry of entries){if(entry.materialId===def.surfaceMaterial||entry.matterState==='liquid'||entry.matterState==='gas')continue;const option=document.createElement('option');option.value=entry.materialId;option.textContent=entry.displayName||entry.materialId;material.append(option);}}).catch(error=>{if(token===generation)status.textContent=error.message;});
    for(const [key,label] of [['visible','Visible'],['collision','Collision'],['proceduralExclusion','Clear vegetation']])field(label,def[key],value=>update({[key]:value}),{type:'checkbox'});
    for(let axis=0;axis<3;axis++)field(`Position ${'XYZ'[axis]}`,def.position[axis],value=>{const position=def.position.slice();position[axis]=value;update({position});},{type:'number',step:.25});
    const title=document.createElement('h4');title.textContent='Control Points';section.append(title);
    const axes=document.createElement('div');Object.assign(axes.style,{display:'grid',gridTemplateColumns:'24px repeat(3,minmax(0,1fr)) 28px 28px',gap:'4px'});
    for(const text of ['#','X','Y','Z','','']){const span=document.createElement('span');span.textContent=text;axes.append(span);}section.append(axes);
    def.controlPoints.forEach((point,index)=>{
      const row=document.createElement('div');Object.assign(row.style,{display:'grid',gridTemplateColumns:'24px repeat(3,minmax(0,1fr)) 28px 28px',gap:'4px'});
      const label=document.createElement('span');label.textContent=index+1;row.append(label);
      point.forEach((value,axis)=>{const input=document.createElement('input');input.type='number';input.step=.25;input.value=value;input.setAttribute('aria-label',`Point ${index+1} ${'XYZ'[axis]}`);input.style.minWidth='0';input.style.width='100%';input.style.boxSizing='border-box';input.onchange=()=>{const controlPoints=structuredClone(def.controlPoints);controlPoints[index][axis]=Number(input.value);update({controlPoints});};row.append(input);});
      const add=document.createElement('button');add.textContent='+';add.title='Insert point on next segment';add.disabled=index===def.controlPoints.length-1;
      add.onclick=()=>{const controlPoints=structuredClone(def.controlPoints);controlPoints.splice(index+1,0,point.map((v,a)=>(v+controlPoints[index+1][a])/2));update({controlPoints});};
      const remove=document.createElement('button');remove.textContent='-';remove.title='Remove control point';remove.disabled=def.controlPoints.length<=2;remove.onclick=()=>update({controlPoints:def.controlPoints.filter((_,i)=>i!==index)});
      row.append(add,remove);section.append(row);
    });
    const remove=document.createElement('button');remove.textContent='Delete Path';remove.onclick=()=>{getActiveMetaWorldLayerBridge()?.removeObjectLayer(def.id);hide();};section.append(remove,status);
    release=bindPathHandles(window.VRWorldContext,mesh,message=>{status.textContent=message;});
    runtime.ready.then(()=>{if(token===generation&&runtime.materialError)status.textContent=runtime.materialError.message;});
    return true;
  }
  const changed=()=>{if(target&&!getActiveMetaWorldLayerBridge()?.getPathDefinition(target.userData.metaWorldLayerId))hide();};
  window.addEventListener(META_WORLD_LAYER_EVENTS.objectsChanged,changed);
  return {show,hide,dispose(){hide();window.removeEventListener(META_WORLD_LAYER_EVENTS.objectsChanged,changed);section.remove();}};
}
