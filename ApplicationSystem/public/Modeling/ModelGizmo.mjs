// Nodevision/ApplicationSystem/public/Modeling/ModelGizmo.mjs
// This adapter applies a Three.js transform gizmo to a shared selection pivot without reparenting document nodes. A completed drag enters history once and cancellation restores every selected transform.
import * as T from '../lib/three/three.module.js';
import { TransformControls } from '../lib/three/examples/jsm/controls/TransformControls.js';
import { selectedRoots,setWorldMatrix } from './ModelTransforms.mjs';
export function installModelGizmo({api,scene,camera,canvas,controls,changed,status}) {
  const pivot=new T.Object3D(),gizmo=new TransformControls(camera,canvas);scene.add(pivot,gizmo);
  let start=null,objects=[],dragging=false,mode='translate';
  function sync(){if(dragging)return;const nodes=selectedRoots(api.selection());if(!nodes.length){gizmo.detach();return;}
    pivot.position.set(0,0,0);nodes.forEach(n=>pivot.position.add(n.getWorldPosition(new T.Vector3())));pivot.position.divideScalar(nodes.length);pivot.scale.set(1,1,1);pivot.quaternion.identity();
    if(api.settings.space==='local')pivot.quaternion.copy(nodes[0].getWorldQuaternion(new T.Quaternion()));pivot.updateMatrixWorld(true);
    gizmo.attach(pivot);gizmo.setMode(mode);gizmo.setSpace(api.settings.space==='global'?'world':'local');
    gizmo.setTranslationSnap(api.settings.snap?api.settings.translate:null);gizmo.setRotationSnap(api.settings.snap?T.MathUtils.degToRad(api.settings.rotate):null);gizmo.setScaleSnap(api.settings.snap?api.settings.scale:null);
  }
  function down(){try{api.history.begin('gizmo '+mode);pivot.updateMatrixWorld(true);start=pivot.matrixWorld.clone().invert();objects=selectedRoots(api.selection()).map(node=>{node.updateWorldMatrix(true,false);return {node,world:node.matrixWorld.clone()};});dragging=true;controls.enabled=false;}catch(e){status(e.message);}}
  function move(){if(!dragging)return;try{pivot.updateMatrixWorld(true);const delta=pivot.matrixWorld.clone().multiply(start);objects.forEach(({node,world})=>setWorldMatrix(node,delta.clone().multiply(world)));changed();}catch(e){cancel();status(e.message);}}
  function up(){if(!dragging)return;dragging=false;controls.enabled=true;api.history.commit();sync();}
  function cancel(){if(!dragging)return;dragging=false;controls.enabled=true;api.history.cancel();gizmo.dragging=false;sync();}
  gizmo.addEventListener('mouseDown',down);gizmo.addEventListener('objectChange',move);gizmo.addEventListener('mouseUp',up);
  const escape=e=>{if(e.key==='Escape'&&dragging){cancel();e.preventDefault();e.stopImmediatePropagation();}};canvas.ownerDocument.addEventListener('keydown',escape,true);
  return {sync,cancel,busy:()=>dragging||Boolean(gizmo.axis),setMode(value){mode=value;sync();},dispose(){cancel();canvas.ownerDocument.removeEventListener('keydown',escape,true);gizmo.dispose();scene.remove(gizmo,pivot);}};
}
