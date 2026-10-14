// Nodevision/ApplicationSystem/public/MetaWorld/Paths/PathInteraction.mjs
// This module adapts the shared sequential-line gesture to terrain raycasts and provides transactional control-point dragging without writing incomplete paths into the world.
import { createVectorInteraction } from '../../VectorDrawing/VectorInteraction.mjs';
import { worldAuthoringAllowed } from '../WorldAuthoringPermissions.mjs';
import { getActiveMetaWorldLayerBridge } from '../MetaWorldLayerState.mjs';
import { samplePath } from './PathGeometry.mjs';
import { panelActivationKeepsHost } from '../../panels/panelZoomPanParts/ownership.mjs';
export function pathRay(context,event) {
  const {THREE,panel,camera}=context,canvas=panel._vrRenderer?.domElement||panel.querySelector('canvas'),rect=canvas?.getBoundingClientRect();
  if(!rect)return null;
  const ray=new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2),panel._vrViewController?.getActiveCamera?.()||camera);
  return ray;
}
function terrainPoint(context,event) {
  const ray=pathRay(context,event);if(!ray)return null;
  const candidates=context.objects.filter(o=>o.visible&&(o.userData?.proceduralVoxelRuntime||o.userData?.nvType==='terrain-surface'));
  const hit=ray.intersectObjects(candidates,false)[0];
  if(hit)return hit.point.toArray();
  const ground=context.ground;
  return ground?.isObject3D&&ground.visible!==false ? ray.intersectObject(ground,true)[0]?.point.toArray() : null;
}
const stop=e=>{e.preventDefault();e.stopImmediatePropagation();};
export function beginPathDrawing(context=window.VRWorldContext) {
  if(!context||!worldAuthoringAllowed(context.movementState))return false;
  const bridge=getActiveMetaWorldLayerBridge();if(!bridge?.updatePath)return false;
  context.cancelPathDrawing?.();context.controls?.unlock?.();
  const {THREE,panel,scene}=context,canvas=panel._vrRenderer?.domElement||panel.querySelector('canvas');if(!canvas)return false;
  const elevations=new Map(),key=p=>`${p.x},${p.y}`,line=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0x00cbd4,depthTest:false}));
  line.userData.runtimeGenerated=true;line.renderOrder=20;scene.add(line);
  let hover=null,done=false;
  const message=document.createElement('output');message.setAttribute('role','status');Object.assign(message.style,{position:'absolute',bottom:'8px',left:'8px',background:'#fff',color:'#a12424'});panel.append(message);
  const xyz=p=>[p.x,elevations.get(key(p))??hover?.[1]??0,p.y];
  function preview(_shape,points=[]) {
    const data=points.map(xyz);let samples=data;
    try{if(data.length>=2)samples=samplePath(THREE,{controlPoints:data,position:[0,0,0],interpolation:'smooth'});}catch{}
    line.geometry.dispose();line.geometry=new THREE.BufferGeometry().setFromPoints(samples.map(p=>new THREE.Vector3(p[0],p[1]+.05,p[2])));
  }
  const interaction=createVectorInteraction({preview,commit(shape){
    try{bridge.updatePath(null,{controlPoints:shape.points.map(xyz)});dispose();}
    catch(error){shape.points.forEach(p=>interaction.down(p));message.textContent=error.message;}
  }});interaction.setTool('line');
  const down=e=>{
    if(e.button!==0)return;
    if(!worldAuthoringAllowed(context.movementState)){dispose();return;}
    stop(e);if(e.detail>=2){interaction.finish();return;}
    const p=terrainPoint(context,e);if(!p)return;
    const q={x:p[0],y:p[2]};elevations.set(key(q),p[1]);interaction.down(q,e);
  };
  const move=e=>{const p=terrainPoint(context,e);if(p){hover=p;interaction.move({x:p[0],y:p[2]},e);}};
  const keydown=e=>{if(e.target.closest?.('input,select,textarea'))return;if(e.key==='Escape'){stop(e);dispose();}else if(interaction.key(e.key))stop(e);};
  const dbl=e=>{stop(e);interaction.finish();};
  const deactivate=()=>{if(!panel.isConnected||!worldAuthoringAllowed(context.movementState)||window.VRWorldContext!==context||getActiveMetaWorldLayerBridge()!==bridge||!['Virtual World Editing','VR World Editing'].includes(window.NodevisionState?.currentMode))dispose();};
  const timer=setInterval(deactivate,200);
  const panelChanged=e=>{if(!panelActivationKeepsHost(e,panel))dispose();};
  function dispose(){if(done)return;done=true;clearInterval(timer);interaction.cancel();scene.remove(line);line.geometry.dispose();line.material.dispose();message.remove();
    canvas.removeEventListener('pointerdown',down,true);canvas.removeEventListener('pointermove',move,true);canvas.removeEventListener('dblclick',dbl,true);
    for(const name of ['mousedown','mouseup','click'])canvas.removeEventListener(name,stop,true);
    window.removeEventListener('keydown',keydown,true);window.removeEventListener('activePanelChanged',panelChanged);delete context.cancelPathDrawing;}
  canvas.addEventListener('pointerdown',down,true);canvas.addEventListener('pointermove',move,true);canvas.addEventListener('dblclick',dbl,true);
  for(const name of ['mousedown','mouseup','click'])canvas.addEventListener(name,stop,true);
  window.addEventListener('keydown',keydown,true);window.addEventListener('activePanelChanged',panelChanged);context.cancelPathDrawing=dispose;return true;
}
export function bindPathHandles(context,mesh,onError) {
  const canvas=context?.panel?._vrRenderer?.domElement||context?.panel?.querySelector('canvas');if(!canvas)return ()=>{};
  const runtime=mesh.userData.pathRuntime;let drag=null;
  const down=e=>{
    if(e.button!==0||context.cancelPathDrawing||!worldAuthoringAllowed(context.movementState))return;
    const hit=pathRay(context,e)?.intersectObjects(runtime.handles,false)[0];if(!hit)return;
    stop(e);drag={index:hit.object.userData.pathPointIndex,handle:hit.object,point:null,id:e.pointerId};canvas.setPointerCapture?.(e.pointerId);
  };
  const move=e=>{if(!drag)return;stop(e);const p=terrainPoint(context,e);if(p){drag.point=p;drag.handle.position.set(p[0]-mesh.position.x,p[1]-mesh.position.y,p[2]-mesh.position.z);}};
  const up=e=>{
    if(!drag)return;stop(e);const pending=drag;drag=null;canvas.releasePointerCapture?.(pending.id);
    if(pending.point){const d=runtime.serialize();d.controlPoints[pending.index]=pending.point.map((n,i)=>n-d.position[i]);
      try{getActiveMetaWorldLayerBridge()?.updatePath(d.id,{controlPoints:d.controlPoints});}catch(error){runtime.setSelected(true);onError(error.message);}}
  };
  const cancel=()=>{if(drag){drag=null;runtime.setSelected(true);}};
  const key=e=>{if(e.key==='Escape'&&drag){stop(e);cancel();}};
  const mouse=e=>{if(drag)stop(e);};
  canvas.addEventListener('pointerdown',down,true);canvas.addEventListener('pointermove',move,true);canvas.addEventListener('pointerup',up,true);canvas.addEventListener('pointercancel',cancel,true);
  canvas.addEventListener('mousedown',mouse,true);window.addEventListener('keydown',key,true);
  return ()=>{cancel();canvas.removeEventListener('pointerdown',down,true);canvas.removeEventListener('pointermove',move,true);canvas.removeEventListener('pointerup',up,true);canvas.removeEventListener('pointercancel',cancel,true);canvas.removeEventListener('mousedown',mouse,true);window.removeEventListener('keydown',key,true);};
}
