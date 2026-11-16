// Uses the existing world object registry, history snapshots, selection and educational associations.
import {mobDefinition} from './Definition.mjs';import {createMob} from './Runtime.mjs';
export function installMobAuthoring(bridge,{THREE,scene,objects,colliders,layerEntries,worldData,changed,select}){
 const entry=id=>layerEntries.find(e=>e.id===id);
 bridge.getMob=id=>entry(id)?.object3d?.userData.mobRuntime?.serialize();
 bridge.updateMob=(id,patch)=>{
  const current=entry(id),runtime=current?.object3d?.userData.mobRuntime;if(id&&!runtime)throw Error('Mob no longer exists.');const def=mobDefinition({...runtime?.serialize(),...patch,id:id||crypto.randomUUID()});if(current?.def.educationalLinks)def.educationalLinks=structuredClone(current.def.educationalLinks);
  bridge.recordHistory();if(runtime){runtime.update(def);worldData.objects[worldData.objects.indexOf(current.def)]=def;current.def=def;}
  else{const mesh=createMob(THREE,def,colliders);mesh.userData.onBreakTarget=()=>bridge.removeObjectLayer(def.id);scene.add(mesh);objects.push(mesh);worldData.objects.push(def);layerEntries.push({id:def.id,def,object3d:mesh});}
  changed(def.id);select?.(def.id);return def;
 };
 bridge.duplicateMob=id=>{const def=bridge.getMob(id);return def?bridge.updateMob(null,{...def,position:def.position.map((n,i)=>n+(i===0?.5:0))}):false;};
}
