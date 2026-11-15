// Nodevision/ApplicationSystem/public/MetaWorld/Rendering/ColorBatches.mjs
// This helper combines opaque untextured materials that differ only in base color while retaining every other serialized rendering property. Owned white materials receive the original linear colors through vertex or instance attributes; unsupported and customized materials retain their original rendering path.
import {Material} from '../../lib/three/three.module.js';
export function colorBatches(materials,indices,vertexColors=false){
 const groups=new Map(),mapping=new Map(),owned=[];
 for(const index of indices){
  const m=materials[index];if(!m)continue;
  const safe=(m.isMeshStandardMaterial||m.isMeshBasicMaterial)&&!m.transparent&&m.opacity===1&&!m.vertexColors&&!m.wireframe&&!m.clippingPlanes&&m.onBeforeCompile===Material.prototype.onBeforeCompile&&m.customProgramCacheKey===Material.prototype.customProgramCacheKey&&!Object.values(m).some(v=>v?.isTexture);
  let key=`unique:${index}`;
  if(safe){const json=m.toJSON();for(const field of ['metadata','uuid','name','color','userData'])delete json[field];key=JSON.stringify(json);}
  if(!groups.has(key))groups.set(key,[]);groups.get(key).push(index);
 }
 const batches=[];
 for(const list of groups.values()){
  const original=materials[list[0]],colored=list.length>1;
  const material=colored?original.clone():original;
  if(colored){material.color.setRGB(1,1,1);material.vertexColors=vertexColors;owned.push(material);}
  const batch={material,colored,index:batches.length};batches.push(batch);for(const i of list)mapping.set(i,batch);
 }
 return {batches,mapping,dispose(){for(const m of owned)m.dispose();}};
}
