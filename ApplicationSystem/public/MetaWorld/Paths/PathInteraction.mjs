// Nodevision/ApplicationSystem/public/MetaWorld/Paths/PathInteraction.mjs
// This module adapts the shared sequential-line gesture to terrain raycasts and provides transactional control-point dragging without writing incomplete paths into the world.
import { createVectorInteraction } from '../../VectorDrawing/VectorInteraction.mjs';
import { worldAuthoringAllowed } from '../WorldAuthoringPermissions.mjs';
import { getActiveMetaWorldLayerBridge } from '../MetaWorldLayerState.mjs';
import {pathToolState} from './PathTool.mjs';
import {setStatus} from '../../StatusBar.mjs';
import { samplePath, ribbonForPath } from './PathGeometry.mjs';
import { panelActivationKeepsHost } from '../../panels/panelZoomPanParts/ownership.mjs';
export function pathRay(context,event) {
  const {THREE,panel,camera}=context,canvas=context.renderer?.domElement||context.canvas||panel._vrRenderer?.domElement||panel.querySelector('canvas'),rect=canvas?.getBoundingClientRect();
  if(!rect)return null;
  const ray=new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,1-(event.clientY-rect.top)/rect.height*2),panel._vrViewController?.getActiveCamera?.()||camera);
  return ray;
}
export function terrainPoint(context,event) {
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
  if(context.pathDrawing)return true;
  context.controls?.unlock?.();
  const {THREE,panel,scene}=context,canvas=context.renderer?.domElement||context.canvas||panel._vrRenderer?.domElement||panel.querySelector('canvas');if(!canvas)return false;
  const state=pathToolState(bridge),seed=state.points.map(p=>p.slice()),elevations=new Map(),key=p=>`${p.x},${p.y}`;
  const line=new THREE.Line(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:0x00cbd4,depthTest:false}));
  const ribbon=new THREE.Mesh(new THREE.BufferGeometry(),new THREE.MeshBasicMaterial({color:0x00cbd4,transparent:true,opacity:.35,side:THREE.DoubleSide,depthWrite:false}));
  const marker=new THREE.Mesh(new THREE.SphereGeometry(.12,8,6),new THREE.MeshBasicMaterial({color:0xffdd44,depthTest:false}));marker.visible=false;
  for(const object of [line,ribbon,marker]){object.userData.runtimeGenerated=true;object.userData.isEditorHelper=true;object.renderOrder=20;scene.add(object);}
  let hover=null,done=false;
  const message=document.createElement('output');message.setAttribute('role','status');Object.assign(message.style,{position:'absolute',bottom:'8px',left:'8px',background:'#fff',color:'#a12424'});panel.append(message);
  const xyz=p=>[p.x,elevations.get(key(p))??hover?.[1]??0,p.y];
  function preview(_shape,points=[]) {
    let data=points.map(xyz);data=data.filter((p,i)=>!i||Math.hypot(p[0]-data[i-1][0],p[2]-data[i-1][2])>=.05);let samples=data;
    ribbon.visible=false;
    try{if(data.length>=2){const def={...state.settings,id:'draft',controlPoints:data,position:[0,0,0]};samples=samplePath(THREE,def,bridge.pathTerrainHeight);const r=ribbonForPath(def,samples);ribbon.geometry.dispose();ribbon.geometry=new THREE.BufferGeometry();ribbon.geometry.setAttribute('position',new THREE.Float32BufferAttribute(r.vertices.flatMap(p=>[p[0],p[1]+.04,p[2]]),3));ribbon.geometry.setIndex(r.triangles.flat());ribbon.visible=true;message.textContent='Click points; Enter/double-click finishes; G settings; Backspace removes a point; Escape cancels.';}}
    catch(error){message.textContent=error.message;}
    line.geometry.dispose();line.geometry=new THREE.BufferGeometry().setFromPoints(samples.map(p=>new THREE.Vector3(p[0],p[1]+.05,p[2])));
  }
  const remember=()=>{state.points=interaction.points.map(xyz);};
  const interaction=createVectorInteraction({preview,status:text=>{message.textContent=text;},commit(shape){
    const points=shape.points.map(xyz);
    try{if(!worldAuthoringAllowed(context.movementState)||window.VRWorldContext!==context||getActiveMetaWorldLayerBridge()!==bridge)throw Error('The originating world is no longer editable.');if(!bridge.updatePath(state.id,{...state.settings,position:[0,0,0],controlPoints:points}))throw Error('Path placement was rejected.');state.points=[];state.id=null;dispose();}
    catch(error){points.forEach(p=>interaction.down({x:p[0],y:p[2]}));remember();message.textContent=error.message;}
  }});interaction.setTool('line');
  for(const p of seed){const q={x:p[0],y:p[2]};elevations.set(key(q),p[1]);interaction.down(q);}remember();
  function hit(event){let p=terrainPoint(context,event);if(!p)return null;const settings=state.settings;
    if(settings.snap==='grid'){p=[Math.round(p[0]/settings.gridSize)*settings.gridSize,p[1],Math.round(p[2]/settings.gridSize)*settings.gridSize];const y=bridge.pathTerrainHeight?.(p[0],p[2]);if(Number.isFinite(y))p[1]=y;}
    if(settings.snap==='endpoints'){let distance=Math.max(.5,settings.width/2);for(const o of context.objects){const d=o.userData?.pathRuntime?.serialize();if(!d||d.id===state.id)continue;const samples=o.userData.pathRuntime.ribbon?.samples||d.controlPoints.map(q=>q.map((v,i)=>v+d.position[i]));for(const q of [samples[0],samples.at(-1)]){const world=q.slice();const next=Math.hypot(world[0]-p[0],world[2]-p[2]);if(next<distance){world[1]-=settings.elevationOffset||0;p=world;distance=next;}}}}
    return p;
  }
  const down=e=>{
    if(e.button!==0)return;if(!worldAuthoringAllowed(context.movementState)){dispose(true);return;}
    stop(e);if(e.detail>=2){interaction.finish();return;}const p=hit(e);if(!p){message.textContent='Point at terrain or the world ground to place a path point.';return;}
    const q={x:p[0],y:p[2]};elevations.set(key(q),p[1]);if(state.settings.interpolation==='mixed'&&interaction.points.length){const kinds=Array.from({length:interaction.points.length},(_,i)=>state.settings.segmentKinds?.[i]||'straight');state.settings.segmentKinds=kinds;kinds[interaction.points.length-1]=state.settings.nextSegment||'straight';}interaction.down(q,e);remember();
  };
  const move=e=>{if(e.buttons)e.stopPropagation();const p=hit(e);marker.visible=!!p;if(p){hover=p;marker.position.set(p[0],p[1]+.1,p[2]);interaction.move({x:p[0],y:p[2]},e);}};
  const keydown=e=>{if(e.target.closest?.('input,select,textarea,dialog,[contenteditable]'))return;if(e.key==='Escape'){stop(e);dispose();}else if(e.key.toLowerCase()==='g'){stop(e);void import('./PathToolSettings.mjs').then(m=>m.openPathToolSettings());}else if(interaction.key(e.key)){stop(e);if(!done)remember();}};
  const mouseMove=e=>{if(e.buttons)e.stopPropagation();};
  const dbl=e=>{stop(e);interaction.finish();};
  const deactivate=()=>{if(!panel.isConnected||!worldAuthoringAllowed(context.movementState)||window.VRWorldContext!==context||getActiveMetaWorldLayerBridge()!==bridge)dispose(true);};
  const timer=setInterval(deactivate,200),panelChanged=e=>{if(!panelActivationKeepsHost(e,panel))dispose(true);};
  function dispose(preserve=false){if(done)return;if(preserve)remember();else{state.points=[];state.id=null;}done=true;context.pathSettingsClose?.();clearInterval(timer);interaction.cancel();for(const o of [line,ribbon,marker]){scene.remove(o);o.geometry.dispose();o.material.dispose();}message.remove();canvas.style.cursor=oldCursor;
    canvas.removeEventListener('pointerdown',down,true);canvas.removeEventListener('pointermove',move,true);canvas.removeEventListener('mousemove',mouseMove,true);canvas.removeEventListener('dblclick',dbl,true);
    for(const name of ['mousedown','mouseup','click'])canvas.removeEventListener(name,stop,true);
    window.removeEventListener('keydown',keydown,true);window.removeEventListener('activePanelChanged',panelChanged);delete context.cancelPathDrawing;delete context.pathDrawing;context.movementState.skipClickFrame=true;window.dispatchEvent(new CustomEvent('nv-contextual-cursor-family-changed'));}
  const oldCursor=canvas.style.cursor;canvas.style.cursor='crosshair';
  canvas.addEventListener('pointerdown',down,true);canvas.addEventListener('pointermove',move,true);canvas.addEventListener('mousemove',mouseMove,true);canvas.addEventListener('dblclick',dbl,true);
  for(const name of ['mousedown','mouseup','click'])canvas.addEventListener(name,stop,true);
  window.addEventListener('keydown',keydown,true);window.addEventListener('activePanelChanged',panelChanged);context.cancelPathDrawing=dispose;context.pathDrawing={finish:()=>interaction.finish(),refresh:()=>preview(null,interaction.points),suspend:()=>dispose(true)};
  window.dispatchEvent(new CustomEvent('nv-contextual-cursor-family-changed'));setStatus('Path: click terrain to draw; G settings; Enter to finish.');return true;
}
export function bindPathHandles(context,mesh,onError) {
  const canvas=context?.renderer?.domElement||context?.canvas||context?.panel?._vrRenderer?.domElement||context?.panel?.querySelector('canvas');if(!canvas)return ()=>{};
  const runtime=mesh.userData.pathRuntime;let drag=null;
  const down=e=>{
    if(e.button!==0||context.cancelPathDrawing||!worldAuthoringAllowed(context.movementState))return;
    const hit=pathRay(context,e)?.intersectObjects(runtime.handles,false)[0];if(!hit)return;
    stop(e);drag={index:hit.object.userData.pathPointIndex,handle:hit.object,point:null,id:e.pointerId,bridge:getActiveMetaWorldLayerBridge(),plane:new context.THREE.Plane(new context.THREE.Vector3(0,1,0),-hit.object.getWorldPosition(new context.THREE.Vector3()).y)};canvas.setPointerCapture?.(e.pointerId);
  };
  const move=e=>{if(!drag)return;stop(e);const p=runtime.serialize().elevationMode==='follow-terrain'?terrainPoint(context,e):pathRay(context,e)?.ray.intersectPlane(drag.plane,new context.THREE.Vector3())?.toArray();if(p){drag.point=p;drag.handle.position.set(p[0]-mesh.position.x,p[1]-mesh.position.y,p[2]-mesh.position.z);}};
  const up=e=>{
    if(!drag)return;stop(e);const pending=drag;drag=null;canvas.releasePointerCapture?.(pending.id);
    if(!worldAuthoringAllowed(context.movementState)||window.VRWorldContext!==context||getActiveMetaWorldLayerBridge()!==pending.bridge){runtime.setSelected(true);onError('The editable world changed during the drag.');return;}
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
