// Existing layer history owns authored instances; runtime reload deliberately resets session injury.
import {mobDefinition} from './Definition.mjs';import {createMob} from './Runtime.mjs';import {resolveCreature} from './Registry.mjs';import {resourcePath} from '../Creatures/Document.mjs';
export function installMobAuthoring(bridge,{THREE,scene,objects,colliders,layerEntries,worldData,changed,select}){
 const entry=id=>layerEntries.find(e=>e.id===id);
 function replace(current,def,behaviorOverrides=def.behavior||{}){const old=current?.object3d;if(old){old.userData.mobRuntime?.dispose();const i=objects.indexOf(old);if(i>=0)objects.splice(i,1);}const mesh=createMob(THREE,def,colliders,{worldPath:bridge.sourcePath,behaviorOverrides});mesh.userData.onBreakTarget=()=>bridge.removeObjectLayer(def.id);scene.add(mesh);objects.push(mesh);if(current)current.object3d=mesh;return mesh;}
 bridge.getMob=id=>entry(id)?.object3d?.userData.mobRuntime?.serialize();
 bridge.updateMob=(id,patch)=>{
  const current=entry(id),runtime=current?.object3d?.userData.mobRuntime;if(id&&!runtime)throw Error('Mob no longer exists.');const before=runtime?.serialize(),def=mobDefinition({...before,...(before?.creatureRoot?{creatureDocument:current.object3d.userData.creatureDocument}:{}),...patch,id:id||crypto.randomUUID()},bridge.sourcePath);if(current?.def.educationalLinks)def.educationalLinks=structuredClone(current.def.educationalLinks);
  bridge.recordHistory();if(runtime){if(runtime.missing||before.speciesId!==def.speciesId||before.creatureDocument!==def.creatureDocument)replace(current,def,{...before.behavior,...patch.behavior});else runtime.update(def,def.creatureDocument?{...before.behavior,...patch.behavior}:def.behavior);worldData.objects[worldData.objects.indexOf(current.def)]=def;current.def=def;}
  else{const mesh=replace(null,def,patch.behavior||{});worldData.objects.push(def);layerEntries.push({id:def.id,def,object3d:mesh});}
  changed(def.id);select?.(def.id);return def;
 };
 bridge.reloadMob=async id=>{const current=entry(id);if(!current)throw Error('Mob no longer exists');const def=bridge.getMob(id);if(def.creatureRoot)throw Error('Reopen the creature document to reload it');if(!def.creatureDocument)throw Error('Legacy built-in instance: reopen the application to reload the built-in');const reference=resourcePath(def.creatureDocument,bridge.sourcePath),assembly=await resolveCreature(reference,{reload:true});if(assembly.species.id!==def.speciesId)throw Error('Species identity changed; relink the instance explicitly');replace(current,def);delete current.def.creatureError;select?.(id);return true;};
 bridge.relinkMob=async(id,reference)=>{const assembly=await resolveCreature(resourcePath(reference,bridge.sourcePath),{reload:true});return bridge.updateMob(id,{speciesId:assembly.species.id,creatureDocument:reference,creatureError:undefined});};
 bridge.duplicateMob=id=>{const def=bridge.getMob(id);if(def?.creatureRoot)throw Error('A creature document has one authoritative root');return def?bridge.updateMob(null,{...def,position:def.position.map((n,i)=>n+(i===0?.5:0))}):false;};
}
