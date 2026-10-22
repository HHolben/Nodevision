// Nodevision/ApplicationSystem/public/Voxels/VoxelScene.mjs
// Shared disposable Three.js chunk renderer with incremental updates and cancellable initial meshing.
import * as THREE from '/lib/three/three.module.js';
import { readMaterial } from './GoxMaterials.mjs';
import { meshChunk, affectedChunks } from './VoxelMesher.mjs';
export class VoxelScene {
  constructor(){this.root=new THREE.Group();this.layers=[];this.materials=[];this.vertices=0;}
  *changes(model){
    while(this.layers.length>model.layers.length)this.removeLayer(this.layers.pop());
    for(let index=0;index<model.layers.length;index++){
      const layer=model.layers[index];let entry=this.layers[index];if(!entry){entry={group:new THREE.Group(),chunks:new Map(),data:new Map(),materials:[]};this.layers.push(entry);this.root.add(entry.group);}
      const payload=model.extras.filter(e=>e.type==='MATE')[layer.material]?.payload;
      if(!entry.materials.length||entry.materialPayload!==payload){const m=readMaterial(payload),pair=[false,true].map(transparent=>new THREE.MeshStandardMaterial({vertexColors:true,color:new THREE.Color(...m.color.slice(0,3)),opacity:m.color[3],transparent:transparent||m.color[3]<1,depthWrite:!transparent&&m.color[3]===1,metalness:m.metallic,roughness:m.roughness,emissive:new THREE.Color(...m.emission)}));entry.group.traverse(o=>{if(o.isMesh)o.material=pair[o.userData.alphaBatch||0];});entry.materials.forEach(m=>m.dispose());entry.materials=pair;entry.materialPayload=payload;}
      entry.group.visible=layer.visible;entry.group.userData.layerIndex=index;entry.group.matrixAutoUpdate=!layer.matrix;if(layer.matrix)entry.group.matrix.fromArray(layer.matrix);
      const dirty=new Set();for(const name of new Set([...entry.data.keys(),...layer.chunks.keys()]))if(entry.data.get(name)!==layer.chunks.get(name))for(const n of affectedChunks(name))dirty.add(n);
      for(const name of dirty)yield{entry,layer,name,index};entry.data=new Map(layer.chunks);
    }
  }
  removeChunk(entry,name){const old=entry.chunks.get(name);if(!old)return;old.traverse(o=>{if(o.geometry){this.vertices-=o.geometry.attributes.position.count;o.geometry.dispose();}});entry.group.remove(old);entry.chunks.delete(name);}
  rebuild({entry,layer,name,index}){
    this.removeChunk(entry,name);if(!layer.chunks.has(name))return;const batches=meshChunk(layer,name),count=batches.reduce((n,b)=>n+b.position.length/3,0);
    if(this.vertices+count>3000000)throw Error('Model exceeds the 3 million rendered vertex limit');
    const group=new THREE.Group();batches.forEach((batch,i)=>{if(!batch.position.length)return;const geometry=new THREE.BufferGeometry();for(const attr of ['position','normal','color'])geometry.setAttribute(attr,new THREE.Float32BufferAttribute(batch[attr],attr==='color'?4:3));geometry.computeBoundingSphere();const mesh=new THREE.Mesh(geometry,entry.materials[i]);mesh.userData.alphaBatch=i;mesh.userData.layerIndex=index;group.add(mesh);});entry.chunks.set(name,group);entry.group.add(group);this.vertices+=count;
  }
  update(model){for(const task of this.changes(model))this.rebuild(task);}
  async load(model,{signal,progress=()=>{}}={}){let n=0;for(const task of this.changes(model)){signal?.throwIfAborted();if(this.closed)throw Error('Voxel scene disposed');this.rebuild(task);if(++n%8===0){progress(n);await new Promise(resolve=>setTimeout(resolve,0));}}}
  removeLayer(entry){for(const name of entry.chunks.keys())this.removeChunk(entry,name);entry.materials.forEach(m=>m.dispose());this.root.remove(entry.group);}
  dispose(){this.closed=true;for(const entry of this.layers)this.removeLayer(entry);for(const m of this.materials)m.dispose();this.layers=[];}
}
