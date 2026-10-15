// Nodevision/ApplicationSystem/public/MetaWorld/Text/TextPlacement.mjs
// This module implements cancellable raycast placement with a surface-aligned preview and stable parent-local transforms.

import {ensureEditableMetaWorldBridge,readCameraPlacement} from '../../ToolbarJSONfiles/worldShapeWidget.mjs';
import {openTextEditor} from './TextEditor.mjs';
import {worldAuthoringAllowed} from '../WorldAuthoringPermissions.mjs';
let cancelPending=null;
export async function insertWorldText(kind='free-standing') {
 const ctx=window.VRWorldContext;if(!ctx||!worldAuthoringAllowed(ctx.movementState))return false;
 await ensureEditableMetaWorldBridge();cancelPending?.();
 if(kind==='free-standing')return openTextEditor(null,{kind,position:readCameraPlacement(),depth:0});
 const {THREE,scene,camera,objects}=ctx,canvas=ctx.renderer?.domElement||ctx.canvas;
 if(!canvas)return false;
 document.exitPointerLock?.();
 const preview=new THREE.Mesh(new THREE.PlaneGeometry(2,1),new THREE.MeshBasicMaterial({color:'#42ccff',opacity:.35,transparent:true,side:THREE.DoubleSide,depthWrite:false}));preview.visible=false;scene.add(preview);
 const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();let placement=null;
 function move(event){const rect=canvas.getBoundingClientRect();pointer.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(pointer,camera);
  const hit=ray.intersectObjects(ctx.ground?[...objects,ctx.ground]:objects,true).find(h=>h.face&&!h.object.userData.textRoot&&!h.object.userData.textRuntime);if(!hit){preview.visible=false;placement=null;return;}
  let parent=hit.object;while(parent&&!parent.userData.metaWorldLayerId)parent=parent.parent;
  if(!parent&&kind!=='sign'){preview.visible=false;placement=null;return;}
  parent=parent||scene;
  const normal=hit.face.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)).normalize();
  preview.position.copy(hit.point).addScaledVector(normal,.006);preview.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),normal);preview.visible=true;preview.updateMatrixWorld(true);
  if(kind==='sign'&&Math.abs(normal.y)>.6){preview.quaternion.identity();preview.position.y+=1.6;}
  preview.updateMatrixWorld(true);parent.updateWorldMatrix(true,false);
  const matrix=parent.matrixWorld.clone().invert().multiply(preview.matrixWorld),position=new THREE.Vector3(),quaternion=new THREE.Quaternion(),scale=new THREE.Vector3();matrix.decompose(position,quaternion,scale);
  placement={kind,parentId:parent.userData.metaWorldLayerId||'',position:position.toArray(),rotation:new THREE.Euler().setFromQuaternion(quaternion).toArray().slice(0,3),scale:scale.toArray()};
 }
 function cleanup(){canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerdown',place,true);window.removeEventListener('keydown',key,true);preview.removeFromParent();preview.geometry.dispose();preview.material.dispose();cancelPending=null;}
 function place(event){event.preventDefault();event.stopImmediatePropagation();if(event.button!==0||!placement)return;const def=placement;cleanup();openTextEditor(null,def);}
 function key(event){if(event.key==='Escape'){event.preventDefault();event.stopImmediatePropagation();cleanup();}}
 canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerdown',place,true);window.addEventListener('keydown',key,true);cancelPending=cleanup;return true;
}
