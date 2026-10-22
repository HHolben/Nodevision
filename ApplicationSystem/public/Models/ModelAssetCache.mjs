// Nodevision/ApplicationSystem/public/Models/ModelAssetCache.mjs
// Shared immutable source resources; each instance owns its materials and skeleton pose.
import {GLTFLoader} from '/lib/three/examples/jsm/loaders/GLTFLoader.js';
import {acquireGoxAsset,invalidateGoxAsset} from '/Voxels/GoxAssetCache.mjs';
import {VoxelScene} from '/Voxels/VoxelScene.mjs';
const entries=new Map();
function disposeScene(root){const resources=new Set();root.traverse(o=>{if(o.geometry)resources.add(o.geometry);for(const m of (Array.isArray(o.material)?o.material:[o.material]).filter(Boolean)){resources.add(m);for(const value of Object.values(m))if(value?.isTexture)resources.add(value);}});for(const r of resources)r.dispose();}
export function invalidateModelAsset(path){if(path.toLowerCase().endsWith('.gox'))invalidateGoxAsset(path);else entries.delete(path);}
export function acquireModelAsset(path){
 if(path.toLowerCase().endsWith('.gox'))return acquireGoxAsset(path);
 let entry=entries.get(path);if(!entry){const url='/Notebook/'+path.split('/').map(encodeURIComponent).join('/');entry={refs:0,promise:new GLTFLoader().loadAsync(url)};entries.set(path,entry);}entry.refs++;let released=false;
 return {model:entry.promise,release(){if(released)return;released=true;if(--entry.refs===0){if(entries.get(path)===entry)entries.delete(path);entry.promise.then(g=>disposeScene(g.scene)).catch(()=>{});}}};
}
export function createModelRenderer(path){
 if(path.toLowerCase().endsWith('.gox')){const view=new VoxelScene();view.root.rotation.x=-Math.PI/2;return view;}
 let root=null;const materials=new Set();return {get root(){return root;},async load(gltf,{signal}){signal.throwIfAborted();root=gltf.scene.clone(true);const originals=[],clones=[];gltf.scene.traverse(o=>originals.push(o));root.traverse(o=>clones.push(o));const mapping=new Map(originals.map((o,i)=>[o,clones[i]]));root.traverse(o=>{if(o.material){const clone=m=>{const c=m.clone();materials.add(c);return c;};o.material=Array.isArray(o.material)?o.material.map(clone):clone(o.material);}if(o.isSkinnedMesh){const original=originals[clones.indexOf(o)];o.skeleton=original.skeleton.clone();o.skeleton.bones=original.skeleton.bones.map(b=>mapping.get(b));o.bindMatrix.copy(original.bindMatrix);o.bindMatrixInverse.copy(original.bindMatrixInverse);}});},dispose(){root?.traverse(o=>{if(o.isSkinnedMesh)o.skeleton.dispose();});for(const m of materials)m.dispose();materials.clear();root?.removeFromParent();}};
}
