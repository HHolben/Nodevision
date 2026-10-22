// Nodevision/ApplicationSystem/public/MetaWorld/Sounds/SoundTool.mjs
// Places a sound property on a picked shape, or edits the inspected shape using the same Layers controls.
import {ensureEditableMetaWorldBridge} from '../../ToolbarJSONfiles/worldShapeWidget.mjs';
import {getActiveMetaWorldLayerBridge} from '../MetaWorldLayerState.mjs';
import {worldAuthoringAllowed} from '../WorldAuthoringPermissions.mjs';
import {soundControls} from './SoundControls.mjs';
import {setStatus} from '../../StatusBar.mjs';
let cancelPending=null;
export async function activateSoundTool(selected=false) {
  const ctx=window.VRWorldContext;
  try {
    if(!ctx||!worldAuthoringAllowed(ctx.movementState))throw Error('Open an editable 3D world to add sound.');
    const bridge=await ensureEditableMetaWorldBridge();
    const valid=()=>window.VRWorldContext===ctx&&getActiveMetaWorldLayerBridge()===bridge&&worldAuthoringAllowed(ctx.movementState);
    if(!valid()||!bridge?.setSoundProperty)throw Error('Sound authoring is unavailable in this world.');
    cancelPending?.();ctx.cancelSoundPlacement=()=>cancelPending?.();ctx.cancelPathDrawing?.();ctx.controls?.unlock?.();document.exitPointerLock?.();
    function edit(id){
      if(!valid())return;
      const entry=bridge.listObjects().find(e=>e.id===id);if(!entry)return;
      const dialog=document.createElement('dialog'),title=document.createElement('h3');title.textContent='Sound · '+entry.name;dialog.append(title);
      soundControls(dialog,entry.soundProperty||{},sound=>{if(!valid())throw Error('The originating world is no longer editable.');bridge.setSoundProperty(id,sound);dialog.close();setStatus('Sound','Attached to '+entry.name+'. Edit its Sound child in Layers.');});
      const close=document.createElement('button');close.type='button';close.textContent='Cancel';close.onclick=()=>dialog.close();dialog.append(close);
      dialog.addEventListener('close',()=>{dialog.remove();cancelPending=null;},{once:true});document.body.append(dialog);dialog.showModal();cancelPending=()=>dialog.close();
    }
    if(selected){const id=ctx.objectInspector?.getActiveTarget?.()?.userData?.metaWorldLayerId;if(!id)throw Error('Select a shape first, or use Place sound and click a shape.');edit(id);return true;}
    const canvas=ctx.renderer?.domElement||ctx.canvas||ctx.panel?._vrRenderer?.domElement;
    if(!canvas)throw Error('The world canvas is unavailable.');
    const oldCursor=canvas.style.cursor;canvas.style.cursor='crosshair';
    const ray=new ctx.THREE.Raycaster(),pointer=new ctx.THREE.Vector2();
    const stop=event=>{if(event.target===canvas){event.preventDefault();event.stopImmediatePropagation();}};
    const down=event=>{
      if(event.target!==canvas||event.button!==0)return;stop(event);if(!valid()){cleanup();return;}
      const rect=canvas.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2);
      ray.setFromCamera(pointer,ctx.panel?._vrViewController?.getActiveCamera?.()||ctx.camera);
      const hits=ray.intersectObjects(ctx.objects.filter(o=>o.visible!==false),true);let id=null;
      for(const hit of hits){let object=hit.object;while(object&&!object.userData?.metaWorldLayerId)object=object.parent;if(object){id=object.userData.metaWorldLayerId;break;}}
      if(!id){setStatus('Sound','Click a world shape to attach sound. Escape cancels.');return;}
      // Keep swallowing the remaining mouse events from this placement gesture.
      setTimeout(()=>{cleanup();edit(id);},0);
    };
    const key=event=>{if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();cleanup();}};
    const timer=setInterval(()=>{if(!valid()||!canvas.isConnected)cleanup();},200);
    function cleanup(){clearInterval(timer);canvas.style.cursor=oldCursor;window.removeEventListener('pointerdown',down,true);for(const name of ['mousedown','mouseup','click'])window.removeEventListener(name,stop,true);window.removeEventListener('keydown',key,true);cancelPending=null;}
    window.addEventListener('pointerdown',down,true);for(const name of ['mousedown','mouseup','click'])window.addEventListener(name,stop,true);window.addEventListener('keydown',key,true);cancelPending=cleanup;
    setStatus('Sound','Click a shape to attach sound. Escape cancels.');return true;
  }catch(error){setStatus('Sound',error.message);return false;}
}
