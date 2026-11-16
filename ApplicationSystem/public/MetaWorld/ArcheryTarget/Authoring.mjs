// Uses the existing world object registry, history snapshots, selection and educational associations.
import {targetDefinition} from './Definition.mjs';import {createArcheryTarget} from './Runtime.mjs';
export function installTargetAuthoring(bridge,{THREE,scene,objects,colliders,layerEntries,worldData,changed,select}){
 const entry=id=>layerEntries.find(e=>e.id===id);
 bridge.getArcheryTarget=id=>entry(id)?.object3d?.userData.archeryTargetRuntime?.serialize();
 bridge.updateArcheryTarget=(id,patch)=>{
  const current=entry(id),runtime=current?.object3d?.userData.archeryTargetRuntime;if(id&&!runtime)throw Error('Archery Target no longer exists.');const def=targetDefinition({...runtime?.serialize(),...patch,id:id||crypto.randomUUID()});if(current?.def.educationalLinks)def.educationalLinks=structuredClone(current.def.educationalLinks);
  bridge.recordHistory();if(runtime){runtime.update(def);worldData.objects[worldData.objects.indexOf(current.def)]=def;current.def=def;}
  else{const mesh=createArcheryTarget(THREE,def,colliders);mesh.userData.onBreakTarget=()=>bridge.removeObjectLayer(def.id);scene.add(mesh);objects.push(mesh);worldData.objects.push(def);layerEntries.push({id:def.id,def,object3d:mesh});}
  changed(def.id);select?.(def.id);return def;
 };
 bridge.duplicateArcheryTarget=id=>{const def=bridge.getArcheryTarget(id);return def?bridge.updateArcheryTarget(null,{...def,position:def.position.map((n,i)=>n+(i===0?.5:0))}):false;};
}
