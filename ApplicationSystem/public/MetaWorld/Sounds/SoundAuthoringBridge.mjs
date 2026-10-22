// Nodevision/ApplicationSystem/public/MetaWorld/Sounds/SoundAuthoringBridge.mjs
// Attaches sound properties without replacing shapes, and restores their runtimes with world history.
import {normalizeSoundProperty} from './SoundProperty.mjs';
import {worldAuthoringAllowed} from '../WorldAuthoringPermissions.mjs';
export function installSoundAuthoring(bridge,{layerEntries,attach,dispose,changed}) {
  const sync=()=>{
    for(const entry of layerEntries){
      const mesh=entry.object3d;if(!mesh)continue;
      const property=entry.def.soundProperty;
      if(!property){if(mesh.userData.soundProperty){dispose(mesh);delete mesh.userData.soundProperty;delete mesh.userData.updateSoundObjectRuntime;delete mesh.userData.syncSoundObjectRuntime;}continue;}
      try {
        const sound=normalizeSoundProperty(property);
        Object.assign(mesh.userData,{soundProperty:sound,soundObject:sound,soundSource:sound.src,soundFile:'',soundLinkedPath:'',soundDataUrl:'',soundVolume:sound.volume,soundRange:sound.range,soundLoop:sound.loop,soundEnabled:sound.enabled});
        attach(mesh,sound);
      }catch(error){dispose(mesh);console.warn('Invalid sound property:',error.message);}
    }
  };
  bridge.setSoundProperty=(id,value)=>{
    if(!worldAuthoringAllowed(window.VRWorldContext?.movementState))throw Error('Sound editing requires an editable world.');
    const entry=layerEntries.find(e=>e.id===id);
    if(!entry?.object3d || ['sound','sound-object'].includes(entry.def.type))throw Error('Select a world shape to assign a sound.');
    const sound=value===null?null:normalizeSoundProperty(value);
    bridge.recordHistory();
    if(sound)entry.def.soundProperty=sound;else delete entry.def.soundProperty;
    sync();changed(id);return sound;
  };
  for(const name of ['undo','redo','regenerateExpressionLayer']){
    const original=bridge[name];if(!original)continue;
    bridge[name]=function(...args){const result=original.apply(this,args);sync();return result;};
  }
  sync();
}
