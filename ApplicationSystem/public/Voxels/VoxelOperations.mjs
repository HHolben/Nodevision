// Nodevision/ApplicationSystem/public/Voxels/VoxelOperations.mjs
// Validated sparse editing, selection, layers and transaction history shared by GUI and terminal commands.
import { extrudeVoxels } from './VoxelExtrusion.mjs';
import { enclosedRegion } from './VoxelEmptyFill.mjs';
import { editMaterial } from './GoxMaterials.mjs';
import { key, point, position, rgba, chunkKey, newLayer, getVoxel, setVoxel, voxels } from './VoxelModel.mjs';
const snapshot = layers => layers.map(l=>({...l,attributes:new Map(l.attributes),chunks:new Map(l.chunks)}));
export { region } from './VoxelBuildGeometry.mjs';
import { geometry,region } from './VoxelBuildGeometry.mjs';
import { transformed,transfer } from './VoxelTransfers.mjs';
export function* shapePoints(kind,a,b,hollow=false){yield* geometry(kind,{at:a,to:b,hollow});}
export class VoxelDocument {
  constructor(model,onChange=()=>{}) { this.model=model;this.onChange=onChange;this.layer=0;this.selection=new Set();this.clipboard=[];this.undoStack=[];this.redoStack=[];this.revision=0;this.savedRevision=0;this.sequence=0; }
  get dirty() { return this.revision!==this.savedRevision; }
  get active() { return this.model.layers[this.layer]; }
  editable() { if(this.model.readOnly) throw Error('This document has unsupported features and is read-only'); if(!this.active || this.active.locked || !this.active.visible) throw Error('Choose a visible, unlocked layer'); }
  begin() { this.editable(); if(!this.pending) this.pending={layers:snapshot(this.model.layers),extras:this.model.extras.slice(),selection:new Set(this.selection),layer:this.layer,revision:this.revision,touched:new Set(),changed:false}; }
  write(pos,color,layer=this.active) { position(pos);rgba(color); if(!this.pending) throw Error('No editing transaction'); const name=chunkKey(pos),token=this.model.layers.indexOf(layer)+':'+name; if(!this.pending.touched.has(token)) { if(layer.chunks.has(name)) layer.chunks.set(name,layer.chunks.get(name).slice());this.pending.touched.add(token); } if(setVoxel(layer,pos,color)) this.pending.changed=true; }
  commit() { const before=this.pending;this.pending=null;if(!before?.changed)return;this.undoStack.push(before);if(this.undoStack.length>64)this.undoStack.shift();this.redoStack=[];this.revision=++this.sequence;this.onChange(); }
  cancel() { if(!this.pending)return;Object.assign(this,{layer:this.pending.layer,selection:this.pending.selection});this.model.layers=this.pending.layers;this.model.extras=this.pending.extras;this.pending=null;this.onChange(); }
  history(redo=false) { if(this.pending)this.cancel();const from=redo?this.redoStack:this.undoStack,to=redo?this.undoStack:this.redoStack,s=from.pop();if(!s)return;to.push({layers:snapshot(this.model.layers),extras:this.model.extras.slice(),selection:new Set(this.selection),layer:this.layer,revision:this.revision});this.model.layers=s.layers;this.model.extras=s.extras;this.selection=s.selection;this.layer=s.layer;this.revision=s.revision;this.onChange(); }
  connected(start, sameColor=true) { position(start);const color=getVoxel(this.active,start),found=new Set();if(!color[3])return found;const queue=[start];found.add(key(start));for(let i=0;i<queue.length;i++){if(queue.length>262144)throw Error('Connected region exceeds operation limit');for(let axis=0;axis<3;axis++)for(const d of [-1,1]){const p=queue[i].slice();p[axis]+=d;const k=key(p),c=getVoxel(this.active,p);if(!found.has(k)&&c[3]&&(!sameColor||c.every((v,n)=>v===color[n]))){found.add(k);queue.push(p);}}}return found; }
  select(args={},visible=this.active?.visible) { if(!visible) throw Error("Choose a visible layer");const mode=args.mode||'replace';let found;if(args.kind==='connected')found=this.connected(args.at,args.sameColor!==false);else if(args.kind==='color')found=new Set([...voxels(this.active)].filter(v=>v.color.every((c,i)=>c===(args.color||getVoxel(this.active,args.at))[i])).map(v=>key(v.pos)));else if(args.kind==='all'||args.kind==='layer')found=new Set([...voxels(this.active)].map(v=>key(v.pos)));else if(args.to)found=new Set([...shapePoints('box',args.at,args.to)].filter(p=>getVoxel(this.active,p)[3]).map(key));else found=new Set(getVoxel(this.active,position(args.at))[3]?[key(args.at)]:[]);if(mode==='replace')this.selection.clear();for(const k of found){if(mode==='subtract'||(mode==='invert'&&this.selection.has(k)))this.selection.delete(k);else this.selection.add(k);}this.onChange(); }
  execute(action,args={}) {
    if(action==='extrude')return extrudeVoxels(this,args);
    if(action==='undo'||action==='redo')return this.history(action==='redo');
    if(action==='cancel'){this.cancel();this.selection.clear();return this.onChange();}
    if(action==='select')return this.select(args);
    if(action==='copy'){this.clipboard=[...this.selection].map(k=>({pos:point(k),color:getVoxel(this.active,point(k))}));return;}
    if(action==='active-layer'){if(!this.model.layers[args.index])throw Error('Invalid layer');this.layer=args.index;this.selection.clear();return this.onChange();}
    if(action==='cut')this.execute('copy');
    if(action==='layer'&&args.kind==='lock'){if(this.model.readOnly)throw Error('Read-only document');this.active.locked=!!args.value;this.onChange();return;}
    // Visibility and lock changes may operate on the current hidden/locked layer; geometry never does.
    const layerAction=action==='layer';if(layerAction){if(this.model.readOnly)throw Error('Read-only document');this.pending={layers:snapshot(this.model.layers),extras:this.model.extras.slice(),selection:new Set(this.selection),layer:this.layer,revision:this.revision,touched:new Set(),changed:false};}else this.begin();
    try {
      const color=action==='material'?null:rgba(args.color||[220,140,60,255]);
      if(['add','erase','paint'].includes(action)){const p=position(args.at);if(action!=='paint'||getVoxel(this.active,p)[3])this.write(p,action==='erase'?[0,0,0,0]:color);}
      else if(['box','sphere','ellipsoid','cylinder','rectangle','line'].includes(action))for(const p of geometry(action,args))this.write(p,color);
      else if(action==='stamp'){if(!Array.isArray(args.points)||args.points.length>262144)throw Error('Invalid stamp');if(args.collision==='cancel'&&args.points.some(p=>getVoxel(this.active,p)[3]))throw Error('Destination collision');for(const p of args.points)if(args.collision==='replace'||!getVoxel(this.active,p)[3])this.write(p,color);}
      else if(action==='replace-color'){const match=rgba(args.match);for(const k of this.selection){const p=point(k);if(getVoxel(this.active,p).every((v,i)=>v===match[i]))this.write(p,color);}}
      else if(action==='fill-empty')for(const p of enclosedRegion(this.active,args))this.write(p,color);
      else if(action==='fill')for(const k of this.connected(args.at,args.sameColor!==false))this.write(point(k),color);
      else if(action==='delete'||action==='cut'){for(const k of this.selection)this.write(point(k),[0,0,0,0]);this.selection.clear();}
      else if(action==='paste'){const offset=position(args.offset||[0,0,0]);transfer(this,this.clipboard.map(v=>({...v,next:position(v.pos.map((n,i)=>n+offset[i]))})),this.active,args.collision);}
      else if(['move','rotate','mirror','move-layer','duplicate'].includes(action))this.transform(action,args);
      else if(action==='material'){editMaterial(this.model,args.index??this.active.material,args);this.pending.changed=true;}
      else if(layerAction)this.changeLayer(args);
      else throw Error('Unknown voxel action: '+action);
      this.commit();
    }catch(error){this.cancel();throw error;}
  }
  transform(action,args){
    const destination=action==='move-layer'?this.model.layers[args.index]:this.active;if(!destination||destination.locked||!destination.visible)throw Error('Invalid destination layer');
    transfer(this,transformed(this,action,args),destination,args.collision,action!=='duplicate');if(action==='move-layer')this.layer=args.index;
  }

  changeLayer(args){
    const layers=this.model.layers,l=this.active,kind=args.kind;
    if(kind==='create'){layers.push(newLayer(String(args.name||'Layer')));this.layer=layers.length-1;}
    else if(kind==='delete'){if(layers.length===1)throw Error('Keep at least one layer');layers.splice(this.layer,1);this.layer=Math.min(this.layer,layers.length-1);}
    else if(kind==='material'){const count=this.model.extras.filter(e=>e.type==='MATE').length;if(!Number.isInteger(args.index)||args.index<0||args.index>=Math.max(1,count))throw Error('Invalid material reference');l.material=args.index;}
    else if(kind==='rename')l.name=String(args.name||'Layer');
    else if(kind==='visible')l.visible=!!args.value;
    else if(kind==='lock')l.locked=!!args.value;
    else if(kind==='duplicate'){const copy=snapshot([l])[0];copy.name+=' copy';copy.attributes.delete('id');layers.splice(this.layer+1,0,copy);this.layer++;}
    else if(kind==='reorder'){if(!Number.isInteger(args.index)||!layers[args.index])throw Error('Invalid layer index');layers.splice(this.layer,1);layers.splice(args.index,0,l);this.layer=args.index;}
    else if(kind==='merge'){const target=layers[args.index];if(target===l||!target||target.locked||l.locked||!target.visible||!l.visible||target.material!==l.material)throw Error('Merge needs two visible unlocked layers with matching materials');for(const v of voxels(l))this.write(v.pos,v.color,target);layers.splice(this.layer,1);this.layer=layers.indexOf(target);}
    else throw Error('Unknown layer operation');this.selection.clear();this.pending.changed=true;
  }
}
