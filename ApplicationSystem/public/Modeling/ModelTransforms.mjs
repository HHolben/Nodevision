// Nodevision/ApplicationSystem/public/Modeling/ModelTransforms.mjs
// These operations transform top-level selected nodes in world or local coordinates. Matrix validation prevents silent shear loss when a rotated child inherits nonuniform parent scale.
import * as T from '../lib/three/three.module.js';
export function selectedRoots(objects){const set=new Set(objects);return objects.filter(n=>{for(let p=n.parent;p;p=p.parent)if(set.has(p))return false;return true;});}
export function editable(node,root){for(let p=node;p&&p!==root;p=p.parent)if(p.userData.nvLocked||!p.visible)return false;return true;}
export function setWorldMatrix(object,matrix) {
  object.parent?.updateWorldMatrix(true,false);
  const local=object.parent?object.parent.matrixWorld.clone().invert().multiply(matrix):matrix.clone();
  const p=new T.Vector3(),q=new T.Quaternion(),s=new T.Vector3();local.decompose(p,q,s);
  const check=new T.Matrix4().compose(p,q,s);
  if(check.elements.some((v,i)=>!Number.isFinite(v)||Math.abs(v-local.elements[i])>1e-5))throw new Error('This transform would shear a nested object. Use Local mode or a uniformly scaled parent.');
  object.position.copy(p);object.quaternion.copy(q);object.scale.copy(s);object.updateMatrixWorld(true);
}
export function transformObjects(objects,{mode='translate',axis='x',value=0,space='global',snap=0}={}) {
  if(!['translate','rotate','scale'].includes(mode)||!['x','y','z','all'].includes(axis)||!['global','local'].includes(space))throw new Error('Invalid transform mode, axis, or space');
  value=Number(value);if(!Number.isFinite(value))throw new Error('Transform requires a finite number');
  if(snap>0)value=Math.round(value/snap)*snap;
  if(mode==='scale'&&Math.abs(value)<.0001)throw new Error('Scale must be nonzero');
  const nodes=selectedRoots(objects),pivot=new T.Vector3();nodes.forEach(n=>pivot.add(n.getWorldPosition(new T.Vector3())));pivot.divideScalar(nodes.length||1);
  const direction=new T.Vector3(axis==='x'?1:0,axis==='y'?1:0,axis==='z'?1:0);
  if(axis==='all'&&mode!=='scale')throw new Error('Choose X, Y, or Z for translation or rotation');
  for(const node of nodes){
    node.updateWorldMatrix(true,false);
    if(space==='local'){
      if(mode==='translate'){const delta=direction.clone().applyQuaternion(node.getWorldQuaternion(new T.Quaternion())).multiplyScalar(value);const world=node.matrixWorld.clone();world.setPosition(node.getWorldPosition(new T.Vector3()).add(delta));setWorldMatrix(node,world);}
      else if(mode==='rotate')node.rotateOnAxis(direction,T.MathUtils.degToRad(value));
      else if(axis==='all')node.scale.multiplyScalar(value);else node.scale[axis]*=value;
    }else{
      const delta=new T.Matrix4();
      if(mode==='translate')delta.makeTranslation(...direction.multiplyScalar(value).toArray());
      else {const change=mode==='rotate'?new T.Matrix4().makeRotationAxis(direction,T.MathUtils.degToRad(value)):new T.Matrix4().makeScale(...['x','y','z'].map(a=>axis==='all'||axis===a?value:1));delta.makeTranslation(...pivot.toArray()).multiply(change).multiply(new T.Matrix4().makeTranslation(...pivot.clone().negate().toArray()));}
      setWorldMatrix(node,delta.multiply(node.matrixWorld));
    }
  }
}
export function reparent(objects,parent){
  if(!parent)throw new Error('Choose a parent');
  const nodes=selectedRoots(objects);
  for(const node of nodes){for(let p=parent;p;p=p.parent)if(p===node)throw new Error('Cannot parent an object to itself or its descendants');}
  for(const node of nodes){node.updateWorldMatrix(true,false);const world=node.matrixWorld.clone();parent.add(node);setWorldMatrix(node,world);}
}
