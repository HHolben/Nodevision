// Nodevision/ApplicationSystem/public/Modeling/ModelActions.mjs
// This action service is shared by menus, properties, keyboard input, and terminal commands. It edits the existing model scene and selection through reversible transactions.
import * as T from '../lib/three/three.module.js';
import { createModelHistory } from './ModelHistory.mjs';
import { primitives,createPrimitive,buildPrimitive,uniqueName } from './PrimitiveRegistry.mjs';
import { editable,selectedRoots,transformObjects,reparent } from './ModelTransforms.mjs';
export function createModelActions(host) {
  const history=createModelHistory(host),cursor=new T.Vector3(),settings={space:'global',snap:false,translate:.1,rotate:15,scale:.1};
  const selection=()=>[...host.selected()].filter(n=>editable(n,host.root()));
  const one=()=>{const nodes=selection();if(nodes.length!==1)throw new Error('Select exactly one object');return nodes[0];};
  const actions={
    insert({type='cube',params={}}){const object=createPrimitive(host.root(),type,params);host.root().add(object);object.position.copy(host.root().worldToLocal(cursor.clone()));host.refresh([object]);return object;},
    select({ids=[],toggle=false}){const list=[];host.root().traverse(n=>{if(ids.includes(n.uuid)&&n!==host.root())list.push(n);});host.select(toggle?[...host.selected()].filter(n=>!list.includes(n)).concat(list.filter(n=>!host.selected().has(n))):list);},
    transform(args){transformObjects(selection(),{space:settings.space,...args,snap:settings.snap?settings[args.mode||'translate']:0});},
    properties({position,rotation,scale,name}){const node=one();for(const [key,value] of Object.entries({position,rotation,scale})){if(!value)continue;if(!Array.isArray(value)||value.length!==3||value.some(v=>!Number.isFinite(Number(v))))throw new Error('Expected three finite coordinates');if(key==='scale'&&value.some(v=>Math.abs(v)<.0001))throw new Error('Scale cannot be zero');node[key].set(...value.map(v=>key==='rotation'?T.MathUtils.degToRad(v):Number(v)));}if(name!==undefined)node.name=String(name).trim()||node.type;},
    duplicate(){const clones=[];for(const source of selectedRoots(selection())){let skinned=false;source.traverse(n=>{if(n.isSkinnedMesh)skinned=true;});if(skinned)throw new Error('Rigged mesh duplication is not supported');const clone=source.clone(true);clone.traverse(n=>{n.name=uniqueName(host.root(),n.name||n.type);});source.parent.add(clone);clones.push(clone);}host.refresh(clones);return clones;},
    delete(){selectedRoots(selection()).forEach(n=>n.removeFromParent());host.refresh([]);},
    rename({name}){actions.properties({name});},
    hide(){selection().forEach(n=>{n.visible=false;});host.refresh([]);},
    unhide(){host.root().traverse(n=>{if(!n.userData.nvBoneDisplay)n.visible=true;});},
    lock(){selection().forEach(n=>{n.userData.nvLocked=true;});host.refresh([]);},
    unlock(){host.root().traverse(n=>{delete n.userData.nvLocked;});},
    group({name='Collection'}={}){const nodes=selectedRoots(selection());if(!nodes.length)throw new Error('Select objects to group');const group=new T.Group();group.name=uniqueName(host.root(),name);group.userData.nvCollection=true;host.root().add(group);reparent(nodes,group);host.refresh([group]);return group;},
    parent({id}){const parent=host.root().getObjectByProperty('uuid',id);if(!parent||!editable(parent,host.root()))throw new Error('Choose an accessible parent');reparent(selection(),parent);},
    unparent(){reparent(selection(),host.root());},
    reset({mode='all'}={}){selection().forEach(n=>{if(mode==='all'||mode==='translate')n.position.set(0,0,0);if(mode==='all'||mode==='rotate')n.quaternion.identity();if(mode==='all'||mode==='scale')n.scale.set(1,1,1);});},
    parameters({params}){const n=one(),meta=n.userData.nvPrimitive;if(!meta)throw new Error('This object is an ordinary mesh');const built=buildPrimitive(meta.type,{...meta.params,...params});if(meta.type==='circle'&&built.params.filled!==meta.params.filled){built.geometry.dispose();throw new Error('Insert a new Circle to change filled/unfilled representation');}n.geometry=built.geometry;n.userData.nvPrimitive={type:meta.type,params:built.params};},
    convert(){const n=one();delete n.userData.nvPrimitive;n.geometry=n.geometry.clone();},
    align({axis='x',value=0}){if(!['x','y','z'].includes(axis)||!Number.isFinite(Number(value)))throw new Error('Choose an axis and finite coordinate');for(const n of selectedRoots(selection())){const p=n.getWorldPosition(new T.Vector3());p[axis]=Number(value);n.position.copy(n.parent.worldToLocal(p));}},
    origin(){const n=one();if(!n.geometry||n.isSkinnedMesh)throw new Error('Select an ordinary mesh');const geometry=n.geometry.clone();geometry.computeBoundingBox();const center=geometry.boundingBox.getCenter(new T.Vector3());const world=n.localToWorld(center.clone());geometry.translate(-center.x,-center.y,-center.z);n.geometry=geometry;n.position.copy(n.parent.worldToLocal(world));delete n.userData.nvPrimitive;},
    cursor({position}){if(!position?.length||position.length!==3||position.some(v=>!Number.isFinite(Number(v))))throw new Error('Cursor requires X, Y, Z');cursor.fromArray(position.map(Number));},
    settings(values){for(const [key,value] of Object.entries(values)){if(key==='space'){if(!['global','local'].includes(value))throw new Error('Choose Global or Local');settings.space=value;}else if(key==='snap')settings.snap=Boolean(value);else if(['translate','rotate','scale'].includes(key)){if(!Number.isFinite(Number(value))||Number(value)<=0)throw new Error('Snap increments must be positive');settings[key]=Number(value);}}},
    undo:()=>history.undo(),redo:()=>history.redo(),
  };
  const transient=new Set(['select','cursor','settings','undo','redo']);
  function execute(action,args={}){if(!actions[action])throw new Error('Unknown modeling action: '+action);const result=transient.has(action)?actions[action](args):history.run(action,()=>actions[action](args));host.changed?.();return result;}
  return {execute,history,settings,cursor,primitives,selection,one,addAction(name,handler,{transient:isTransient=false}={}){actions[name]=handler;if(isTransient)transient.add(name);},dispose:()=>history.dispose()};
}
