// Nodevision/ApplicationSystem/public/Modeling/PrimitiveRegistry.mjs
// This registry defines bounded procedural primitives independently of menu widgets. Construction parameters remain in glTF extras until a user explicitly converts the object to a manually editable mesh.
import * as T from '../lib/three/three.module.js';
const number=(value,min,max)=>({value,min,max});
export const primitives = {
  plane:{label:'Plane',params:{width:number(2,.001,10000),depth:number(2,.001,10000),subdivisions:number(1,1,128)},build:p=>new T.PlaneGeometry(p.width,p.depth,p.subdivisions,p.subdivisions).rotateX(-Math.PI/2)},
  cube:{label:'Cube',params:{width:number(2,.001,10000),height:number(2,.001,10000),depth:number(2,.001,10000)},build:p=>new T.BoxGeometry(p.width,p.height,p.depth)},
  sphere:{label:'UV Sphere',params:{radius:number(1,.001,10000),segments:number(32,3,128),rings:number(16,2,128)},build:p=>new T.SphereGeometry(p.radius,p.segments,p.rings)},
  icosphere:{label:'Icosphere',params:{radius:number(1,.001,10000),subdivisions:number(1,0,5)},build:p=>new T.IcosahedronGeometry(p.radius,p.subdivisions)},
  cylinder:{label:'Cylinder',params:{radius:number(1,.001,10000),depth:number(2,.001,10000),segments:number(32,3,128),caps:{value:true}},build:p=>new T.CylinderGeometry(p.radius,p.radius,p.depth,p.segments,1,!p.caps)},
  cone:{label:'Cone',params:{topRadius:number(0,0,10000),bottomRadius:number(1,.001,10000),depth:number(2,.001,10000),segments:number(32,3,128)},build:p=>new T.CylinderGeometry(p.topRadius,p.bottomRadius,p.depth,p.segments)},
  torus:{label:'Torus',params:{majorRadius:number(1,.001,10000),minorRadius:number(.25,.001,10000),segments:number(48,3,128)},build:p=>new T.TorusGeometry(p.majorRadius,p.minorRadius,16,p.segments).rotateX(-Math.PI/2)},
  circle:{label:'Circle',params:{radius:number(1,.001,10000),vertices:number(32,3,256),filled:{value:true}},build:p=>p.filled?new T.CircleGeometry(p.radius,p.vertices).rotateX(-Math.PI/2):new T.BufferGeometry().setFromPoints(Array.from({length:p.vertices},(_,i)=>new T.Vector3(Math.cos(i*2*Math.PI/p.vertices)*p.radius,0,Math.sin(i*2*Math.PI/p.vertices)*p.radius)))},
  grid:{label:'Grid',params:{width:number(2,.001,10000),depth:number(2,.001,10000),subdivisions:number(10,1,128)},build:p=>new T.PlaneGeometry(p.width,p.depth,p.subdivisions,p.subdivisions).rotateX(-Math.PI/2)},
  capsule:{label:'Capsule',params:{radius:number(.5,.001,10000),depth:number(1,.001,10000),segments:number(16,4,64)},build:p=>new T.CapsuleGeometry(p.radius,p.depth,8,p.segments)},
  pyramid:{label:'Pyramid',params:{radius:number(1,.001,10000),depth:number(2,.001,10000)},build:p=>new T.CylinderGeometry(0,p.radius,p.depth,4).rotateY(Math.PI/4)},
};
export function buildPrimitive(type,values={}) {
  const entry=primitives[type];if(!entry)throw new Error('Unknown mesh primitive: '+type);
  const params={};
  for(const [key,rule] of Object.entries(entry.params)) {
    const value=values[key]??rule.value;
    if(typeof rule.value==='boolean'){if(typeof value!=='boolean')throw new Error(key+' must be true or false');params[key]=value;continue;}
    if(!Number.isFinite(Number(value))||Number(value)<rule.min||Number(value)>rule.max)throw new Error(`${key} must be between ${rule.min} and ${rule.max}`);
    params[key]=['segments','rings','vertices','subdivisions'].includes(key)?Math.floor(Number(value)):Number(value);
  }
  return {geometry:entry.build(params),params};
}
export function uniqueName(root,label) {
  const names=new Set();root.traverse(n=>names.add(n.name));
  if(!names.has(label))return label;
  for(let i=1;;i++){const name=label+'.'+String(i).padStart(3,'0');if(!names.has(name))return name;}
}
export function createPrimitive(root,type,values={}) {
  const {geometry,params}=buildPrimitive(type,values),line=type==='circle'&&!params.filled;
  const material=line?new T.LineBasicMaterial({color:0x8299ad}):new T.MeshStandardMaterial({color:0x8299ad,roughness:.65,metalness:0,side:T.DoubleSide});
  const object=line?new T.LineLoop(geometry,material):new T.Mesh(geometry,material);
  object.name=uniqueName(root,primitives[type].label);object.userData.nvPrimitive={type,params};return object;
}
