// Nodevision/ApplicationSystem/public/MetaWorld/Constructions/ConstructionRuntime.mjs
// Loads independent construction/GOX references using the existing codec/cache/renderer and owns exact voxel collision plus a transient footprint outline.
import {acquireGoxAsset} from '../../Voxels/GoxAssetCache.mjs';
import {VoxelScene} from '../../Voxels/VoxelScene.mjs';
import {getVoxel,setVoxel,chunkKey,voxels} from '../../Voxels/VoxelModel.mjs';
import {validateConstruction,resolveReference,reference,constructionBounds,scenePrimitives,terrainBounds,unionBounds,SIZE} from './Definition.mjs';
export function createConstruction(THREE,input,worldPath,colliders){
 const source=structuredClone(input),root=new THREE.Group(),abort=new AbortController();let def=null,asset=null,view=null,layers=[],model=null,display=null,sessionBinding=null,previewVolumes=null,editGeometry=null,geometryLocalBounds=null,selected=false,enabled=false,disposed=false;
 Object.assign(root.userData,{nvType:'construction',metaWorldLayerId:source.id,preserveLocalTransform:true});
 const outline=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial({color:0xe5a133,wireframe:true,depthTest:false}));outline.visible=false;root.add(outline);
 root.position.fromArray(source.position||[0,0,0]);root.visible=source.visible!==false;
 const effective=()=>{if(!def)return null;return {...def,terrainVolumes:previewVolumes||def.terrainVolumes,position:root.position.toArray().map((n,i)=>Math.round((n-def.gridOrigin[i])/SIZE))};};
 function refresh(){if(!def)return;const d=effective();root.name=d.name;root.position.fromArray(d.position.map((n,i)=>d.gridOrigin[i]+n*SIZE));root.rotation.set(0,0,0);root.scale.set(1,1,1);
  const b=constructionBounds(d);outline.position.fromArray(b.min.map((n,i)=>(n+b.max[i])/2-root.position.getComponent(i)));outline.scale.fromArray(b.max.map((n,i)=>Math.max(SIZE,n-b.min[i])));outline.visible=selected||!!runtime.warning;outline.material.color.set(runtime.warning?0xff3355:0xe5a133);
  if(view)view.root.visible=enabled;root.updateMatrixWorld(true);
 }
 const sampleVoxel=p=>{if(!enabled||!def)return null;const offset=def.geometry?.position||[0,0,0],local=p.map((n,i)=>(n-root.position.getComponent(i))/SIZE-offset[i]);
  const point=new THREE.Vector3(local[0],-local[2],local[1]);
  for(let i=layers.length-1;i>=0;i--){const {layer,inverse}=layers[i],v=point.clone().applyMatrix4(inverse).toArray().map(Math.floor),color=getVoxel(layer,v);if(color[3]){const material=def.metadata?.capture?.materials?.[model.layers.indexOf(layer)];return {...(material||{materialId:'gox-rgba',solid:true}),rgba:color,customColor:true,source:{construction:source.id,goxFile:def.geometry?.source}};}}return null;
 };
 const sample=p=>sampleVoxel(p)?.rgba||null;
 const collisionSample=p=>{const opinion=sessionBinding?.session.opinion(sessionBinding.toCell(p));return opinion!==undefined?opinion:editGeometry?editGeometry.sample(p):sampleVoxel(p);};
 function updateSession(points){if(!display||!sessionBinding)return;const dirty=new Set();
  for(const p of points){const offset=def.geometry?.position||[0,0,0],local=p.map((n,i)=>(n-root.position.getComponent(i))/SIZE-offset[i]),point=new THREE.Vector3(local[0],-local[2],local[1]);
   for(const {layer,inverse} of layers){const i=model.layers.indexOf(layer),at=point.clone().applyMatrix4(inverse).toArray().map(Math.floor),name=chunkKey(at),target=display.layers[i];if(!layer.chunks.has(name))continue;
    const k=i+':'+name;if(!dirty.has(k)){const chunk=target.chunks.get(name)||new Uint8Array(16384);target.chunks.set(name,chunk.slice());dirty.add(k);}setVoxel(target,at,sessionBinding.session.opinion(sessionBinding.toCell(p))!==undefined?[0,0,0,0]:getVoxel(layer,at));
   }
  }view.update(display);
 }
 const sourceGeometryBounds=()=>{if(!view||!layers.length)return null;if(!geometryLocalBounds){root.updateMatrixWorld(true);const b=new THREE.Box3();for(const entry of view.layers)if(entry.group.visible)b.union(new THREE.Box3().setFromObject(entry.group));if(b.isEmpty())return null;geometryLocalBounds={min:b.min.sub(root.position).toArray(),max:b.max.sub(root.position).toArray()};}return {min:geometryLocalBounds.min.map((n,i)=>n+root.position.getComponent(i)),max:geometryLocalBounds.max.map((n,i)=>n+root.position.getComponent(i))};};
 const geometryBounds=()=>{const boxes=[sourceGeometryBounds(),editGeometry?.bounds].filter(Boolean);return boxes.length?unionBounds(boxes):null;};
 const collider={type:'expression-heightfield',voxelTerrain:true,activeWhenHidden:true,target:root,layerId:source.id,materialId:'stone',physicsMaterialId:'stone',
  sampleGroundY(x,z,maxY=Infinity){const b=geometryBounds();if(!enabled||!b||x<b.min[0]||x>=b.max[0]||z<b.min[2]||z>=b.max[2])return NaN;
   for(let y=Math.min(Math.floor((maxY-root.position.y)/SIZE),Math.ceil((b.max[1]-root.position.y)/SIZE));y>Math.floor((b.min[1]-root.position.y)/SIZE);y--){const m=collisionSample([x,root.position.y+(y-.5)*SIZE,z]);if(m){const materialId=m.materialId==='gox-rgba'?'stone':m.materialId;Object.assign(collider,{materialId,physicsMaterialId:materialId,materialFile:m.materialFile,MatterState:m.matterState||'solid'});return root.position.y+y*SIZE;}}return NaN;},
  intersectsPlayer(p,r,minY,maxY,step=0){if(!enabled)return false;const lo=[p.x-r,minY,p.z-r].map((n,i)=>Math.floor((n-root.position.getComponent(i))/SIZE)),hi=[p.x+r,maxY,p.z+r].map((n,i)=>Math.floor((n-root.position.getComponent(i))/SIZE));
   for(let y=lo[1];y<=hi[1];y++)for(let z=lo[2];z<=hi[2];z++)for(let x=lo[0];x<=hi[0];x++){const cell=[x,y,z].map((n,i)=>root.position.getComponent(i)+n*SIZE);if(cell[1]+SIZE<=minY+step+.001||cell[1]>=maxY)continue;
    const dx=Math.max(cell[0]-p.x,0,p.x-cell[0]-SIZE),dz=Math.max(cell[2]-p.z,0,p.z-cell[2]-SIZE);if(dx*dx+dz*dz<r*r&&collisionSample(cell.map(n=>n+SIZE/2)))return true;}return false;}
 };collider.sampleMaterial=(x,y,z)=>sampleVoxel([x,y,z]);colliders.push(collider);
 const runtime={loaded:false,warning:'',definition:null,ready:null,source,root,
  attachColliders(next){const i=colliders.indexOf(collider);if(i>=0)colliders.splice(i,1);colliders=next;if(!next.includes(collider))next.push(collider);},
  bindSession(binding){sessionBinding=binding;if(display){display.layers.forEach((layer,i)=>{layer.chunks=new Map(model.layers[i].chunks);});view.update(display);}},updateSession,
  *geometryCells(){const seen=new Set();for(let i=layers.length-1;i>=0;i--){const {layer,inverse}=layers[i],matrix=inverse.clone().invert();for(const {pos} of voxels(layer)){const p=new THREE.Vector3(...pos.map(n=>n+.5)).applyMatrix4(matrix),at=[p.x,p.z,-p.y].map((n,j)=>Math.floor(n)+(def.geometry.position[j]||0)),key=at.join(',');if(seen.has(key))continue;seen.add(key);yield {at,value:sampleVoxel(at.map((n,j)=>root.position.getComponent(j)+(n+.5)*SIZE))};}}},
  getDefinition:effective,setEditGeometry(value){editGeometry=value;},setPreviewVolumes(volumes){previewVolumes=volumes;refresh();},get cuts(){return def?terrainBounds(effective()):[];},get bounds(){return def?unionBounds([constructionBounds(effective()),geometryBounds()].filter(Boolean)):null;},get geometryBounds(){return geometryBounds();},sample,sampleVoxel,collider,
  get active(){return enabled;},get disposed(){return disposed;},
  setComposed(value,warning=''){enabled=value&&!disposed;runtime.warning=warning||runtime.loadWarning||'';refresh();},
  setSelected(value){selected=value;refresh();},
  get primitives(){return def?scenePrimitives(source,effective()):[];},
  serialize(){const overrides={...source.overrides};if(def&&effective().position.some((n,i)=>n!==def.position[i]))overrides.position=effective().position;return {...source,type:'construction',position:root.position.toArray(),visible:root.visible,hidden:!root.visible,active:source.active!==false,preserveLocalTransform:true,collider:false,isSolid:false,collidable:false,...(def?{name:def.name,overrides}:{} )};},
  dispose(){if(disposed)return;disposed=true;enabled=false;abort.abort();asset?.release();view?.dispose();outline.geometry.dispose();outline.material.dispose();root.removeFromParent();const i=colliders.indexOf(collider);if(i>=0)colliders.splice(i,1);},
 };
 root.userData.constructionRuntime=runtime;
 root.raycast=(ray,hits)=>{if(disposed||!root.visible)return;root.updateMatrixWorld(true);const targets=outline.visible?[outline]:enabled&&view?[view.root]:[];for(const hit of ray.intersectObjects(targets,true)){let visible=true;for(let p=hit.object;p&&p!==root;p=p.parent)if(!p.visible)visible=false;if(visible)hits.push({...hit,object:root});}};
 runtime.ready=(async()=>{
  try{if(typeof source.id!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(source.id))throw Error('Construction instance requires a stable id');for(const k of ['active','visible'])if(source[k]!==undefined&&typeof source[k]!=='boolean')throw Error('Construction '+k+' must be boolean');const path=resolveReference(worldPath,reference(source.constructionFile,'.construction.json')),response=await fetch('/Notebook/'+path.split('/').map(encodeURIComponent).join('/'),{signal:abort.signal,cache:'no-store'});if(!response.ok)throw Error('Construction unavailable: '+path+' ('+response.status+')');
   const authored=validateConstruction(await response.json());abort.signal.throwIfAborted();if(Object.keys(source.overrides||{}).some(k=>!['name','position','terrainVolumes','geometry','gridOrigin','metadata'].includes(k)))throw Error('Unsupported construction instance override');def=validateConstruction({...authored,...source.overrides});runtime.definition=def;if(def.metadata?.capture){const m=def.metadata.capture;if(m.version!==1||!Array.isArray(m.materials)||m.materials.length>128||m.materials.some(v=>typeof v.materialId!=='string'||v.solid!==true))throw Error('Invalid captured construction material metadata');}
   root.position.fromArray(def.position.map((n,i)=>def.gridOrigin[i]+n*SIZE));refresh();
   if(def.geometry){try{asset=acquireGoxAsset(resolveReference(path,def.geometry.source));model=await asset.model;abort.signal.throwIfAborted();if(def.metadata?.capture&&model.layers.length!==Math.max(1,def.metadata.capture.materials.length))throw Error('Captured material layers do not match GOX');
    for(const layer of model.layers.filter(l=>l.visible)){const matrix=new THREE.Matrix4();if(layer.matrix)matrix.fromArray(layer.matrix);const e=matrix.elements;
     for(let row=0;row<3;row++)if(!Number.isInteger(e[12+row])||[0,1,2].reduce((n,col)=>n+Math.abs(e[col*4+row]),0)!==1||[0,1,2].some(col=>![-1,0,1].includes(e[col*4+row])))throw Error('Construction GOX layers require grid-preserving transforms');
     if(e[3]!==0||e[7]!==0||e[11]!==0||e[15]!==1||Math.abs(matrix.determinant())!==1)throw Error('Construction GOX transform is singular');layers.push({layer,inverse:matrix.clone().invert()});
    }
    display={...model,layers:model.layers.map(layer=>({...layer,chunks:new Map(layer.chunks)}))};view=new VoxelScene();await view.load(display,{signal:abort.signal});view.root.rotation.x=-Math.PI/2;view.root.scale.setScalar(SIZE);view.root.position.fromArray(def.geometry.position.map(n=>n*SIZE));root.add(view.root);
   }catch(error){if(abort.signal.aborted)throw error;view?.dispose();view=null;layers=[];runtime.loadWarning='GOX unavailable; terrain volumes remain active: '+error.message;}}
   abort.signal.throwIfAborted();return true;
  }catch(error){if(!disposed){runtime.loadWarning=error.message;runtime.warning=error.message;outline.visible=true;}return false;}
 })().finally(()=>{runtime.loaded=true;});
 return root;
}
