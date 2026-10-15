// Nodevision/ApplicationSystem/public/MetaWorld/Text/TextAuthoringBridge.mjs
// This module integrates text editing, local parent attachments, duplication, and source snapshots with the existing world layer history.

import {normalizeText,TEXT_PARENT_TYPES} from './TextDefinition.mjs';
import {createTextObject} from './TextRuntime.mjs';
let copiedText=null;
export function installTextAuthoring(bridge,{THREE,scene,objects,layerEntries,worldData,changed,select}) {
 const entryFor=id=>layerEntries.find(e=>e.id===id);
 bridge.getTextDefinition=id=>entryFor(id)?.object3d?.userData?.textRuntime?.serialize();
 bridge.syncTextParents=()=>{
  for(const entry of layerEntries) {
   const mesh=entry.object3d,r=mesh?.userData?.textRuntime;if(!r)continue;
   const def=r.serialize(),parent=entryFor(def.parentId)?.object3d;
   let cursor=parent,cycle=false;while(cursor){if(cursor===mesh){cycle=true;break;}cursor=cursor.parent;}
   const destination=parent&&!cycle?parent:scene;
   if(mesh.parent!==destination)destination.add(mesh);
   if(parent&&TEXT_PARENT_TYPES.includes(parent.userData.nvType)){
    parent.userData.preserveLocalTransform=true;entryFor(def.parentId).def.preserveLocalTransform=true;
   }
   mesh.userData.onBreakTarget=()=>bridge.removeObjectLayer(entry.id);
  }
 };
 bridge.updateText=(id,patch)=>{
  const entry=entryFor(id),runtime=entry?.object3d?.userData?.textRuntime;
  if(id&&!runtime)throw Error('Text no longer exists.');
  const def=normalizeText({...runtime?.serialize(),...patch,id:id||crypto.randomUUID()});
  let ancestor=def.parentId;const visited=new Set([def.id]);
  while(ancestor){if(visited.has(ancestor))throw Error('Text parenting would create a cycle.');visited.add(ancestor);ancestor=bridge.getTextDefinition(ancestor)?.parentId;}
  bridge.recordHistory();
  if(runtime){runtime.update(def);worldData.objects[worldData.objects.indexOf(entry.def)]=def;entry.def=def;}
  else {const mesh=createTextObject(THREE,def);scene.add(mesh);objects.push(mesh);worldData.objects.push(def);layerEntries.push({id:def.id,def,object3d:mesh});}
  bridge.syncTextParents();changed(def.id);window.dispatchEvent(new CustomEvent('nodevision:metaworld-layers:selection-changed',{detail:{objectId:def.id}}));return def;
 };
 bridge.copyText=id=>{copiedText=bridge.getTextDefinition(id);return Boolean(copiedText);};
 bridge.pasteText=()=>copiedText?bridge.updateText(null,{...copiedText,position:[copiedText.position[0]+.2,...copiedText.position.slice(1)]}):false;
 bridge.duplicateText=id=>{const def=bridge.getTextDefinition(id);if(!def)return false;return bridge.updateText(null,{...def,position:[def.position[0]+.2,...def.position.slice(1)]});};
 let displayState={};
 bridge.setTextDisplayState=state=>{displayState={...displayState,...state};bridge.updateTextVisibility();};
 bridge.updateTextVisibility=()=>{const camera=window.VRWorldContext?.camera;if(!camera)return;const eye=camera.getWorldPosition(new THREE.Vector3());
  for(const entry of layerEntries){const mesh=entry.object3d;mesh?.userData?.textRuntime?.setDisplayState({...displayState,distance:mesh.getWorldPosition(new THREE.Vector3()).distanceTo(eye)});}
 };
 const setVisibility=bridge.setObjectVisibility;bridge.setObjectVisibility=function(id,visible){const result=setVisibility.call(this,id,visible);const runtime=entryFor(id)?.object3d?.userData?.textRuntime;if(runtime)runtime.setAuthoredVisibility(visible!==false);return result;};
 // Keep attachments valid after history replacement and parent deletion. Orphans retain a stable parent ID.
 for(const name of ['undo','redo','removeObjectLayer','regenerateVoxelWorld','updatePath']){const original=bridge[name];bridge[name]=function(...args){
  const parent=entryFor(args[0])?.object3d;
  const attachments=layerEntries.filter(e=>e.object3d?.userData?.textRuntime&&e.object3d.parent===parent);
  if(['regenerateVoxelWorld','updatePath'].includes(name))for(const e of attachments)scene.add(e.object3d);
  let record;
  if(name==='removeObjectLayer'&&attachments.length){
   // Capture parent-local source before detaching; the underlying removal must not capture a second snapshot.
   bridge.recordHistory();record=bridge.recordHistory;bridge.recordHistory=()=>{};
   for(const e of attachments)scene.attach(e.object3d);
  }
  try{const result=original.apply(this,args);bridge.syncTextParents();return result;}
  finally{if(record)bridge.recordHistory=record;}
 };}
 bridge.syncTextParents();
}
