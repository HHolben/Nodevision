// Nodevision/ApplicationSystem/public/Voxels/VoxelExtrusion.mjs
// Incremental integer selection sweeps preserve occupied cells and source RGBA; commits use the existing document transaction and endpoint selection.
import {getVoxel,key,point,position} from './VoxelModel.mjs';
export class VoxelExtrusion {
 constructor(doc){
  doc.editable();if(doc.pending)throw Error('Finish the current edit before extruding');
  this.doc=doc;this.layer=doc.active;this.layerIndex=doc.layer;this.revision=doc.revision;this.selection=new Set(doc.selection);
  this.sources=[...this.selection].map(k=>({pos:position(point(k)),color:getVoxel(this.layer,point(k))})).filter(v=>v.color[3]).sort((a,b)=>a.pos[0]-b.pos[0]||a.pos[1]-b.pos[1]||a.pos[2]-b.pos[2]);
  if(!this.sources.length)throw Error('Select one or more occupied voxels in the active layer before extruding');
  if(this.sources.length>65536)throw Error('Extrusion supports at most 65536 selected voxels');
  this.center=[0,1,2].map(i=>this.sources.reduce((n,v)=>n+v.pos[i]+.5,0)/this.sources.length);
  this.exposure='xyz'.split('').map((_,i)=>[-1,1].map(sign=>this.sources.reduce((n,v)=>{const p=v.pos.slice();p[i]+=sign;return n+Number(!getVoxel(this.layer,p)[3]);},0)));
  this.reset('x',1);
 }
 validate(){this.doc.editable();if(this.doc.layer!==this.layerIndex||this.doc.active!==this.layer||this.doc.revision!==this.revision||this.doc.selection.size!==this.selection.size||[...this.selection].some(k=>!this.doc.selection.has(k)))throw Error('Selection or document changed; restart extrusion');}
 reset(axis,sign){this.axis=axis;this.sign=sign;this.steps=0;this.added=new Map();this.overlap=new Map();this.levels=[];}
 update(axis,steps){
  this.validate();if(typeof axis!=='string'||!'xyz'.includes(axis)||axis.length!==1||!Number.isInteger(steps))throw Error('Extrusion needs X, Y or Z and an integer distance');
  const count=Math.abs(steps),sign=Math.sign(steps)||this.sign,i='xyz'.indexOf(axis);
  if(count>4096||count*this.sources.length>262144)throw Error('Extrusion exceeds 4096 steps or 262144 source-cell visits; reduce distance or selection');
  for(const v of this.sources){const p=v.pos.slice();p[i]+=steps;position(p);}
  if(axis!==this.axis||sign!==this.sign)this.reset(axis,sign);
  while(this.levels.length>count){const removed=this.levels.pop();for(const k of removed.added)this.added.delete(k);for(const k of removed.overlap)this.overlap.delete(k);}
  while(this.levels.length<count){const step=this.levels.length+1,level={added:[],overlap:[]};
   for(const source of this.sources){const pos=source.pos.slice();pos[i]+=step*sign;const k=key(pos);if(this.added.has(k)||this.overlap.has(k))continue;
    if(getVoxel(this.layer,pos)[3]){if(!this.selection.has(k)){this.overlap.set(k,{pos});level.overlap.push(k);}continue;}
    this.added.set(k,{pos,color:source.color,source:source.pos});level.added.push(k);
   }this.levels.push(level);
  }
  this.steps=steps;return this;
 }
 commit(){
  this.validate();const i='xyz'.indexOf(this.axis),endpoint=new Set(this.sources.map(v=>{const p=v.pos.slice();p[i]+=this.steps;return key(p);}));
  if(!this.added.size){this.doc.selection=endpoint;this.doc.onChange();return false;}
  this.doc.begin();try{for(const v of this.added.values())this.doc.write(v.pos,v.color);this.doc.selection=endpoint;this.doc.commit();return true;}catch(error){this.doc.cancel();throw error;}
 }
}
export function extrudeVoxels(doc,{axis='x',steps=0}={}){return new VoxelExtrusion(doc).update(axis,steps).commit();}
