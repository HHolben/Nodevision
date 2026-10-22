// Nodevision/scripts/sound-properties-browser.mjs
// Exercises shape-owned sound editing, playback distance, history, Layers and world persistence with real world modules.
import * as THREE from '/lib/three/three.module.js';
import {loadWorldFromFile} from '/PanelInstances/ViewPanels/GameViewDependencies/worldLoading.mjs';
import {serializeMesh,saveCurrentWorldFile} from '/PanelInstances/ViewPanels/GameViewDependencies/worldSave.mjs';
import {getActiveMetaWorldLayerBridge} from '/MetaWorld/MetaWorldLayerState.mjs';
import {renderSoundProperty} from '/MetaWorld/Sounds/SoundControls.mjs';
import {activateSoundTool} from '/MetaWorld/Sounds/SoundTool.mjs';
import {acquireWorldViewPermissions} from '/MetaWorld/WorldAuthoringPermissions.mjs';
let checks=0;const ok=(v,m)=>{if(!v)throw Error(m);checks++;},tick=()=>new Promise(r=>setTimeout(r,30));
try {
  const RealAudio=window.Audio;const audio=[];
  window.Audio=class extends EventTarget {constructor(src){super();this.src=src;this.paused=true;this.volume=0;audio.push(this);}play(){this.paused=false;return Promise.resolve();}pause(){this.paused=true;}load(){}};
  window.NodevisionState={currentMode:'Virtual World Editing'};
  const panel=document.createElement('div');document.body.append(panel);const canvas=document.createElement('canvas');canvas.width=800;canvas.height=600;panel.append(canvas);
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(55,4/3,.1,100),state={currentWorldPath:'sounds.html'},movementState={playerMode:'creative',environment:{}};
  const context=window.VRWorldContext={THREE,scene,camera,panel,canvas,state,movementState,objects:[],colliders:[],lights:[],portals:[],collisionActions:[],useTargets:[],spawnPoints:[],waterVolumes:[],measurementVisuals:[],controls:{getObject:()=>camera,unlock(){}}};
  let definition={name:'Sounds',type:'world',worldType:'NodevisionMetaWorld',objects:[{id:'cylinder',type:'cylinder',position:[0,0,0],size:[1,3],isSolid:true,color:'#aa7777'}]},savedHtml='';
  const original=window.fetch;window.fetch=async(url,options)=>{
    if(url==='/api/load-world')return {ok:true,json:async()=>({worldDefinition:structuredClone(definition)})};
    if(url==='/Notebook/sounds.html')return {ok:true,text:async()=>'<html><body>Keep this page</body></html>'};
    if(url==='/api/save'){savedHtml=JSON.parse(options.body).content;return {ok:true,json:async()=>({success:true})};}
    return original(url,options);
  };
  await loadWorldFromFile('sounds.html',state,THREE);let bridge=getActiveMetaWorldLayerBridge();
  const shape=()=>context.objects.find(o=>o.userData.metaWorldLayerId==='cylinder');
  bridge.setSoundProperty('cylinder',{src:'audio/loop.ogg',volume:.6,range:10});let mesh=shape();
  ok(mesh.userData.nvType==='cylinder'&&serializeMesh(mesh).type==='cylinder','Sound preserves shape type');
  ok(serializeMesh(mesh).soundProperty.src==='audio/loop.ogg','Property serialized under shape');
  mesh.userData.updateSoundObjectRuntime(new THREE.Vector3(0,0,0));await tick();let runtime=mesh.userData.soundRuntime;
  ok(runtime.audio.loop&&!runtime.audio.paused&&runtime.audio.volume===.6,'Nearby looping playback');
  mesh.userData.updateSoundObjectRuntime(new THREE.Vector3(5,0,0));ok(Math.abs(runtime.audio.volume-.3)<1e-6,'Distance attenuation');
  mesh.userData.updateSoundObjectRuntime(new THREE.Vector3(20,0,0));ok(runtime.audio.paused&&runtime.audio.volume===0,'Outside range pauses');
  mesh.visible=false;mesh.userData.updateSoundObjectRuntime(new THREE.Vector3());ok(runtime.audio.paused&&runtime.audio.volume===0,'Hidden parent stays silent');mesh.visible=true;
  mesh.position.x=30;mesh.userData.updateSoundObjectRuntime(new THREE.Vector3(30,0,0));await tick();ok(!runtime.audio.paused&&runtime.audio.volume===.6,'Audio follows moved shape');
  const parent=new THREE.Group();parent.position.x=10;scene.add(parent);parent.add(mesh);mesh.userData.updateSoundObjectRuntime(new THREE.Vector3(40,0,0));await tick();ok(runtime.audio.volume===.6,'Sound uses parent world transform');scene.attach(mesh);scene.remove(parent);
  bridge.setSoundProperty('cylinder',{src:'audio/loop.ogg',volume:0,range:10});ok(shape().userData.soundRuntime.audio.volume===0,'Zero volume retained');
  bridge.undo();ok(shape().userData.soundProperty.volume===.6,'Undo property edit');bridge.redo();ok(shape().userData.soundProperty.volume===0,'Redo property edit');
  const host=document.createElement('div');document.body.append(host);renderSoundProperty(host,bridge.listObjects()[0],bridge);const details=host.querySelector('details');details.open=true;await tick();
  ok(details.dataset.soundParent==='cylinder'&&details.querySelector('summary').textContent.includes('Sound'),'Sound is nested under parent layer');
  const inputs=details.querySelectorAll('input');inputs[2].value='.5';details.querySelector('form').requestSubmit();ok(shape().userData.soundProperty.volume===.5,'Layers form updates property');
  context.objectInspector={getActiveTarget:shape,inspectTarget(){}};
  ok(await activateSoundTool(true),'Selected-shape editor opens');ok(document.querySelector('dialog form'),'Shared editor form rendered');document.querySelector('dialog').close();
  camera.position.set(0,0,10);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);shape().position.set(0,0,0);scene.updateMatrixWorld(true);
  ok(await activateSoundTool(),'Placement tool activates');const rect=canvas.getBoundingClientRect();canvas.dispatchEvent(new PointerEvent('pointerdown',{clientX:rect.left+rect.width/2,clientY:rect.top+rect.height/2,button:0,bubbles:true}));await tick();
  ok(document.querySelector('dialog form'),'Picking cylinder opens sound editor');document.querySelector('dialog').close();
  await saveCurrentWorldFile({state,movementState,objects:context.objects,lights:[]});definition=JSON.parse(new DOMParser().parseFromString(savedHtml,'text/html').querySelector('script').textContent);
  ok(definition.objects[0].soundProperty.volume===.5&&savedHtml.includes('Keep this page'),'World save retains nested property and host HTML');
  await loadWorldFromFile('sounds.html',state,THREE);bridge=getActiveMetaWorldLayerBridge();ok(shape().userData.soundProperty.volume===.5&&shape().userData.soundRuntime,'Reload restores sound');
  const oldAudio=shape().userData.soundRuntime.audio;bridge.removeObjectLayer('cylinder');ok(!shape()&&oldAudio.paused&&oldAudio.src==='','Deleting parent disposes audio');bridge.undo();ok(shape()?.userData.soundRuntime,'Undo parent deletion restores audio');
  bridge.setSoundProperty('cylinder',null);ok(!shape().userData.soundRuntime&&!serializeMesh(shape()).soundProperty,'Removing property retains shape and clears audio');bridge.undo();ok(shape().userData.soundRuntime,'Undo removal restores audio');
  const release=acquireWorldViewPermissions({authoring:false});ok(bridge.setSoundProperty('cylinder',null)===false&&shape().userData.soundRuntime,'Read-only rejects edits');release();
  const {createPlayerInventory}=await import('/PanelInstances/ViewPanels/GameViewDependencies/playerInventory.mjs');
  context.inventory=createPlayerInventory({panel});ok(context.inventory.items.some(item=>item.id==='sound'),'Sound editor tool is available in inventory');context.inventory.assignItemToSlot(0,'sound');context.inventory.selectDominantSlot(0);await tick();ok(canvas.style.cursor==='crosshair','Equipping Sound activates placement');window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));ok(canvas.style.cursor!=='crosshair','Escape cancels sound placement');context.inventory.dispose();
  // Decode an actual embedded WAV through Chromium; playback assertions above use a deterministic Audio double.
  window.Audio=RealAudio;
  const bytes=new Uint8Array(844),view=new DataView(bytes.buffer),text=(offset,s)=>{for(let i=0;i<s.length;i++)bytes[offset+i]=s.charCodeAt(i);};
  text(0,'RIFF');view.setUint32(4,836,true);text(8,'WAVE');text(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,8000,true);view.setUint32(28,8000,true);view.setUint16(32,1,true);view.setUint16(34,8,true);text(36,'data');view.setUint32(40,800,true);bytes.fill(128,44);
  bridge.setSoundProperty('cylinder',{src:'data:audio/wav;base64,'+btoa(String.fromCharCode(...bytes)),volume:0,range:10});
  const real=shape().userData.soundRuntime.audio;
  await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Audio decoding timed out')),4000);real.addEventListener('loadeddata',()=>{clearTimeout(timer);resolve();},{once:true});real.addEventListener('error',()=>{clearTimeout(timer);reject(Error('Embedded WAV failed to decode'));},{once:true});});
  ok(real.readyState>=2&&real.loop,'Embedded audio decodes in Chromium');bridge.setSoundProperty('cylinder',null);
  document.getElementById('result').textContent=`PASS: ${checks} sound property checks`;
}catch(error){document.getElementById('result').textContent='FAIL: '+error.stack;}
