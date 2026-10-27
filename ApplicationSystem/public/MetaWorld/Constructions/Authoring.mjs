// Nodevision/ApplicationSystem/public/MetaWorld/Constructions/Authoring.mjs
// Integrates linked construction authoring with native world snapshots, file writes, layer selection and regional terrain invalidation.
import {getActiveMetaWorldLayerBridge} from '../MetaWorldLayerState.mjs';
import {invalidateGoxAsset} from '../../Voxels/GoxAssetCache.mjs';
import {createConstruction} from './ConstructionRuntime.mjs';
import {validateConstruction,constructionBounds,intersects,resolveReference,terrainBounds,volumesOverlap,SIZE} from './Definition.mjs';
import {worldAuthoringAllowed} from '../WorldAuthoringPermissions.mjs';
import {saveViaApi,notifyFileSaved} from '../../ToolbarCallbacks/file/saveFile/utils.mjs';
export function installConstructionAuthoring(bridge,{THREE,scene,objects,colliders,layerEntries,worldData,filePath,changed,select}){
 let previous=new Map(),generation=0;
 const all=()=>layerEntries.map(e=>e.object3d?.userData?.constructionRuntime).filter(Boolean);
 const allowed=()=>{const s=window.VRWorldContext?.movementState;if(!worldAuthoringAllowed(s)||!alive())throw Error('Construction authoring requires editable Build mode');};
 const alive=()=>window.VRWorldContext?.objects===objects&&getActiveMetaWorldLayerBridge()===bridge;
 function checkAlignment(d){const b=constructionBounds(d);for(const o of objects){const r=o.userData?.proceduralVoxelRuntime;if(!r)continue;const origin=o.position.toArray().map((n,i)=>n+(i===1?(r.definition.heightLimits?.min||0):0)),tb={min:origin,max:origin.map((n,i)=>n+r.definition.size[i])};
  if(intersects(b,tb)&&d.gridOrigin.some((n,i)=>Math.abs((n-origin[i])/SIZE-Math.round((n-origin[i])/SIZE))>1e-6))throw Error('Construction grid origin must align with the intersected terrain grid');}}
 function sync(){
  const runtimes=all(),conflicts=new Set(),entries=[],next=new Map(),bounds=[];
  const active=runtimes.filter(r=>r.getDefinition()&&r.source.active!==false);
  for(let i=0;i<active.length;i++)for(let j=i+1;j<active.length;j++)if(active[i].source.id===active[j].source.id||volumesOverlap(active[i].getDefinition(),active[j].getDefinition())){conflicts.add(active[i]);conflicts.add(active[j]);}
  for(const r of runtimes){let warning=conflicts.has(r)?'Overlapping active terrain volumes: both disabled until resolved':'';try{if(r.getDefinition())checkAlignment(r.getDefinition());}catch(e){warning=e.message;}
   r.setComposed(!!r.getDefinition()&&r.source.active!==false&&!warning,warning);const layer=layerEntries.find(e=>e.object3d===r.root);if(layer&&r.getDefinition())layer.def.name=r.getDefinition().name;
   if(r.active){const b=r.bounds,g=r.geometryBounds,extent=g?{min:b.min.map((n,i)=>Math.min(n,g.min[i])),max:b.max.map((n,i)=>Math.max(n,g.max[i]))}:b;
    entries.push({id:r.source.id,bounds:b,cuts:r.cuts,extent,sample:r.sample,...(r.getDefinition().metadata?.capture?{sampleVoxel:r.sampleVoxel}:{})});next.set(r.source.id,{stamp:JSON.stringify(r.getDefinition())+r.root.uuid,extent,geometryStamp:r.root.uuid,regions:r.cuts.concat(g?[g]:[])});}
  }
  entries.sort((a,b)=>a.id.localeCompare(b.id));
  for(const [id,v] of next)if(previous.get(id)?.stamp!==v.stamp){const old=previous.get(id);if(!old||old.stamp!==v.stamp){const before=old?.regions||[],after=v.regions;bounds.push(...before.filter(b=>!after.some(a=>JSON.stringify(a)===JSON.stringify(b))),...after.filter(b=>!before.some(a=>JSON.stringify(a)===JSON.stringify(b))));if(old&&old.geometryStamp!==v.geometryStamp&&JSON.stringify(before)===JSON.stringify(after))bounds.push(...after);}}
  for(const [id,v] of previous)if(!next.has(id))bounds.push(...v.regions);previous=next;
  const terrainStamp=objects.filter(o=>o.userData?.proceduralVoxelRuntime).map(o=>o.uuid+o.position.toArray()).join();
  if(terrainStamp!==bridge.constructionTerrainStamp){bridge.constructionTerrainStamp=terrainStamp;bounds.push(...entries.map(e=>e.extent));}
  if(bounds.length){for(const o of objects)o.userData?.proceduralVoxelRuntime?.setConstructions(entries,bounds);bridge.refreshPathTerrainSupport?.();}
  return entries;
 }
 bridge.syncConstructions=()=>{const token=++generation;bridge.constructionsReady=Promise.all(all().map(r=>r.ready)).then(()=>{if(token===generation&&alive())sync();});return bridge.constructionsReady;};
 bridge.getConstructionDefinition=id=>layerEntries.find(e=>e.id===id)?.object3d?.userData?.constructionRuntime?.getDefinition();
 bridge.getScenePrimitives=()=>[{id:'World',path:'/World',parent:null,type:'Xform'},{id:'Constructions',path:'/World/Constructions',parent:'/World',type:'Xform'},...objects.filter(o=>o.userData?.proceduralVoxelRuntime).map(o=>({id:o.userData.metaWorldLayerId,path:'/World/t_'+encodeURIComponent(o.userData.metaWorldLayerId),parent:'/World',type:'ProceduralTerrain',transform:{translation:o.position.toArray()},attributes:o.userData.proceduralVoxelRuntime.serialize()})),...all().flatMap(r=>r.primitives)];
 async function replace(id,input){allowed();if(window.VRWorldContext?.constructionEdit)throw Error('Exit construction editing before changing construction instance properties');await bridge.constructionsReady;const old=layerEntries.find(e=>e.id===id),runtime=old?.object3d?.userData.constructionRuntime;if(id&&!runtime)throw Error('Construction no longer exists');
  let source;
  if(runtime){const current=runtime.serialize(),relink=input.constructionFile&&input.constructionFile!==current.constructionFile;
   source={...current,...Object.fromEntries(['constructionFile','active','visible'].filter(k=>k in input).map(k=>[k,input[k]])),overrides:relink?undefined:{...current.overrides,...Object.fromEntries(['name','position','terrainVolumes','geometry','gridOrigin','metadata'].filter(k=>k in input).map(k=>[k,input[k]]))}};
  }else {if(all().length>=256)throw Error('At most 256 construction instances are supported');source={id:'construction-'+crypto.randomUUID(),type:'construction',constructionFile:input.constructionFile,active:input.active!==false,visible:input.visible!==false};}
  const object=createConstruction(THREE,source,filePath,colliders),candidate=object.userData.constructionRuntime;
  try{await candidate.ready;if(!candidate.getDefinition())throw Error(candidate.warning);allowed();if(!alive()||(old&&(!layerEntries.includes(old)||old.object3d!==runtime.root)))throw Error('The originating world or construction changed');checkAlignment(candidate.getDefinition());
   if(source.active!==false)for(const r of all())if(r!==runtime&&r.source.active!==false&&r.bounds&&volumesOverlap(candidate.getDefinition(),r.getDefinition()))throw Error('Active terrain volumes cannot overlap');
   source.name=candidate.getDefinition().name;bridge.recordHistory();if(old){const index=worldData.objects.indexOf(old.def);worldData.objects[index]=source;runtime.dispose();objects.splice(objects.indexOf(old.object3d),1);old.def=source;old.object3d=object;}
   else{worldData.objects.push(source);layerEntries.push({id:source.id,def:source,object3d:object});}
   scene.add(object);objects.push(object);object.userData.onBreakTarget=()=>bridge.removeObjectLayer(source.id);sync();changed(source.id);select(source.id);return source;
  }catch(error){candidate.dispose();throw error;}
 }
 bridge.updateConstruction=(id,patch)=>replace(id,patch);
 bridge.createConstruction=async input=>{allowed();const id='asset-'+crypto.randomUUID(),definition=validateConstruction({schema:'nodevision-construction',version:2,id,voxelSize:SIZE,name:input.name||'Construction',gridOrigin:input.gridOrigin||[0,0,0],position:input.position||[0,0,0],terrainVolumes:[{id:'cut-'+crypto.randomUUID(),type:'TerrainCut',shape:'box',position:[0,0,0],size:input.size||[16,16,16],operation:'subtract',active:true}],geometry:input.geometry||null});checkAlignment(definition);
  for(const r of all())if(r.source.active!==false&&r.bounds&&volumesOverlap(definition,r.getDefinition()))throw Error('Active terrain volumes cannot overlap');
  const ref='Constructions/'+id+'.construction.json',path=resolveReference(filePath,ref);await saveViaApi({path,content:JSON.stringify(definition,null,2)});notifyFileSaved(path);allowed();if(!alive())throw Error('The originating world changed; construction file retained');return replace(null,{constructionFile:ref});};
 bridge.saveConstruction=async id=>{allowed();if(window.VRWorldContext?.constructionEdit)throw Error('Use Save Construction in the focused editing controls');const r=all().find(r=>r.source.id===id);if(!r?.getDefinition())throw Error('Construction definition is unresolved');const path=resolveReference(filePath,r.source.constructionFile);await saveViaApi({path,content:JSON.stringify(r.getDefinition(),null,2)});notifyFileSaved(path);return path;};
 bridge.installCapturedConstruction=(object,source,promotion)=>{allowed();const r=object.userData.constructionRuntime;if(!r?.getDefinition()||r.warning)throw Error('Captured construction did not validate');checkAlignment(r.getDefinition());for(const other of all())if(other.source.active!==false&&other.bounds&&volumesOverlap(r.getDefinition(),other.getDefinition()))throw Error('Active terrain volumes cannot overlap');
  if(all().length>=256)throw Error('At most 256 constructions are supported');return bridge.commitCapture(()=>{worldData.objects.push(source);layerEntries.push({id:source.id,def:source,object3d:object});objects.push(object);scene.add(object);r.attachColliders(colliders);object.userData.onBreakTarget=()=>bridge.removeObjectLayer(source.id);sync();changed(source.id);select(source.id);},promotion,source);
 };
 bridge.refreshConstructionAssets=async({definitionPath,goxPath,uniqueSource})=>{
  const targets=all().filter(r=>uniqueSource?r.source.id===uniqueSource.id:resolveReference(filePath,r.source.constructionFile)===definitionPath||(r.getDefinition()?.geometry&&resolveReference(resolveReference(filePath,r.source.constructionFile),r.getDefinition().geometry.source)===goxPath));
  invalidateGoxAsset(goxPath);const candidates=[];
  try{for(const old of targets){const source=uniqueSource||old.serialize(),object=createConstruction(THREE,source,filePath,[]),r=object.userData.constructionRuntime;candidates.push({old,source,object,r});await r.ready;if(!r.getDefinition()||r.loadWarning)throw Error(r.loadWarning||'Source refresh failed');checkAlignment(r.getDefinition());}
   const next=[...all().filter(r=>!targets.includes(r)),...candidates.map(c=>c.r)];for(const {r} of candidates)if(r.source.active!==false)for(const other of next)if(other!==r&&other.source.active!==false&&other.bounds&&volumesOverlap(r.getDefinition(),other.getDefinition()))throw Error('Refreshed construction terrain volumes overlap; resolve the conflict before publishing the instance');
   if(!alive()||targets.some(r=>!objects.includes(r.root)))throw Error('World changed during source refresh');
   if(uniqueSource)bridge.recordHistory();
   for(const {old,source,object,r} of candidates){const entry=layerEntries.find(e=>e.object3d===old.root),index=worldData.objects.indexOf(entry.def);worldData.objects[index]=source;entry.def=source;entry.object3d=object;objects.splice(objects.indexOf(old.root),1,object);old.dispose();scene.add(object);r.attachColliders(colliders);object.userData.onBreakTarget=()=>bridge.removeObjectLayer(source.id);}
   sync();bridge.sessionVoxels?.sync();if(uniqueSource){changed(uniqueSource.id);select(uniqueSource.id);}else if(candidates.length)select(candidates[0].source.id);return candidates.map(c=>c.r);
  }catch(error){for(const c of candidates)if(!objects.includes(c.object))c.r.dispose();throw error;}
 };
 bridge.linkConstruction=ref=>replace(null,{constructionFile:ref});
 for(const name of ['removeObjectLayer','setObjectVisibility','regenerateVoxelWorld','addVoxelWorld','undo','redo']){const original=bridge[name];if(original)bridge[name]=function(...args){const result=original.apply(this,args);bridge.syncConstructions();return result;};}
 bridge.syncConstructions();
 let stamp='';bridge.updateConstructionTransforms=()=>{const next=all().map(r=>r.root.position.toArray()+r.root.visible+JSON.stringify(r.root.rotation.toArray())).join()+objects.filter(o=>o.userData?.proceduralVoxelRuntime).map(o=>o.position.toArray()).join();if(next!==stamp){stamp=next;bridge.syncConstructions();}};
}
