// Nodevision/ApplicationSystem/public/MetaWorld/VegetationLOD/Runtime.mjs
// This bounded per-terrain queue prepares feature proxies independently of detailed occupancy. It shares authoritative placement and palette resources, prioritizes a predicted movement corridor, and retains installed representations until replacements are ready.
import {infiniteWorld} from '../ProceduralVoxelWorld/WorldExtent.mjs';
import {horizontalRange} from '../ProceduralVoxelWorld/VoxelCoordinates.mjs';
import {vegetationRegion,vegetationCells} from './Sampling.mjs';
import {vegetationInstances} from './Instances.mjs';
import {vegetationOwnership} from './Ownership.mjs';
import {vegetationDetail} from './Detail.mjs';
import {prioritizeVegetation} from './Priority.mjs';
import {polygonalVegetationSteps,polygonalVegetation} from './Polygonal.mjs';
export function createVegetationLOD(THREE,root,definition,generator,manager,materials,map){
 const group=new THREE.Group();group.name='Vegetation distance detail';
 const geometry=new THREE.BoxGeometry(1,1,1),tiles=new Map(),dirty=new Set(),outgoing=new Map();
 const ownership=vegetationOwnership(THREE,manager),detail=vegetationDetail(THREE,generator,ownership);let enabled=false,point=[0,0],lastPriorityPoint=null;
 let queue=[],pending=null,lastKey='',disposed=false,previous=null,clock=performance.now(),revision=0,lastMask='',lastResidency=null,lastCoverageRevision=-1;
 const stats={requests:0,evictions:0,cancelled:0,cacheHits:0,transitions:0,generationMs:0,installationMs:0,bytes:0,firstInstalledMs:null,started:clock,aheadRequests:0};
 function release(key){const old=outgoing.get(key);if(old){old.tile.dispose();outgoing.delete(key);}dirty.delete(key);const tile=tiles.get(key);if(!tile)return;stats.bytes-=tile.bytes;tile.dispose();tiles.delete(key);}
 function invalidate(bounds){
  revision++;pending=null;lastKey='';
  // Feature canopies cross region boundaries; invalidate the placement reach as well as the edit.
  const margin=generator.pathFeatureReach*.25+2;
  for(const [key,t] of tiles){const {rx,rz}=t.data.region;if(!bounds||rx*32<bounds.maxX+margin&&(rx+1)*32>bounds.minX-margin&&rz*32<bounds.maxZ+margin&&(rz+1)*32>bounds.minZ-margin)dirty.add(key);}
 }
 function plan(x,z,settings){
  const now=performance.now(),elapsed=Math.max(.016,(now-clock)/1000),dx=previous?(x-previous[0])/elapsed:0,dz=previous?(z-previous[1])/elapsed:0;
  if(!previous||x!==previous[0]||z!==previous[1]){previous=[x,z];clock=now;}
  const lead=settings.predictive?[Math.max(-32,Math.min(32,dx)),Math.max(-32,Math.min(32,dz))]:[0,0];
  const key=`${Math.floor(x/8)},${Math.floor(z/8)},${settings.vegetationDistance},${settings.predictive},${definition.representation}`;if(key===lastKey)return;lastKey=key;
  const radius=Math.ceil(settings.vegetationDistance/32),cx=Math.floor(x/32),cz=Math.floor(z/32),requests=[];
  const [minX,maxX]=horizontalRange(cx,radius,Math.ceil(definition.size[0]/32),infiniteWorld(definition)),[minZ,maxZ]=horizontalRange(cz,radius,Math.ceil(definition.size[2]/32),infiniteWorld(definition));
  for(let rz=minZ;rz<=maxZ;rz++)for(let rx=minX;rx<=maxX;rx++){
   const distance=Math.hypot(Math.max(rx*32-x,0,x-(rx+1)*32),Math.max(rz*32-z,0,z-(rz+1)*32));if(distance>settings.vegetationDistance)continue;
   const k=`${rx},${rz}`,old=tiles.get(k),level=distance<(old?.data.level===1?56:40)?1:2;
   const ahead=Math.hypot(rx*32+16-x-lead[0],rz*32+16-z-lead[1]);requests.push({key:k,rx,rz,level,distance,score:distance<24?distance-100:Math.min(distance,ahead),requested:now,mode:definition.representation||'voxel',ahead:ahead<distance});
  }
  requests.sort((a,b)=>a.score-b.score);const selected=requests.slice(0,64),wanted=new Set(selected.map(r=>r.key));
  for(const k of tiles.keys())if(!wanted.has(k)){release(k);dirty.delete(k);stats.evictions++;}
  if(pending&&!wanted.has(pending.request.key)){pending=null;stats.cancelled++;}
  queue=selected.filter(r=>{const t=tiles.get(r.key);if(t&&!dirty.has(r.key)&&t.data.level===r.level&&Boolean(t.data.polygonal)===(definition.representation==='polygonal')){stats.cacheHits++;return false;}return pending?.request.key!==r.key;}).sort((a,b)=>Number(tiles.has(a.key))-Number(tiles.has(b.key))||a.score-b.score);
 }
 function* build(request){
  const old=tiles.get(request.key),region=old&&!dirty.has(request.key)?old.data.region:yield*vegetationRegion(generator,request.rx,request.rz);
  const data=yield*vegetationCells(generator,region,old?request.level:2,definition.terrainMap?.outside==='procedural');return request.mode==='polygonal'?yield*polygonalVegetationSteps(data):data;
 }
 function update(position,settings){
  if(disposed)return;
  group.visible=settings.vegetationEnabled&&definition.generation?.vegetation!==false;
  if(enabled!==group.visible){enabled=group.visible;for(const entry of manager.loaded.values()){if(enabled){const before=entry.residentBytes;detail.attach(entry,entry.cell);if(manager.stats)manager.stats.residentBytes+=entry.residentBytes-before;}else{const bytes=detail.detach(entry);if(manager.stats)manager.stats.residentBytes-=bytes;}}}
  point=[position.x-root.position.x,position.z-root.position.z];
  if(!group.visible){ownership.tick(...point,false);group.removeFromParent();pending=null;queue=[];lastKey='';for(const k of tiles.keys())release(k);return;}
  if(!group.parent)root.add(group);
  plan(position.x-root.position.x,position.z-root.position.z,settings);
  const start=performance.now(),deadline=start+1;
  while(performance.now()<deadline){
   if(!pending){const request=queue.shift();if(!request)break;if(outgoing.has(request.key)){queue.push(request);break;}stats.requests++;if(request.ahead)stats.aheadRequests++;pending={request,revision,ready:!map};
    if(map){const task=pending,margin=generator.pathFeatureReach*.25+2;map.prepare({minX:request.rx*32-margin,maxX:(request.rx+1)*32+margin,minZ:request.rz*32-margin,maxZ:(request.rz+1)*32+margin}).then(()=>{if(task===pending){generator.invalidateTerrainSource();task.ready=true;}}).catch(e=>{if(task===pending){stats.error=e.message;pending=null;}});break;}
   }
   if(!pending.ready)break;
   const task=pending;task.iterator ||= build(task.request);const result=task.iterator.next();if(!result.done)continue;pending=null;
   if(task.revision!==revision||task.request.mode!==(definition.representation||'voxel')){lastKey='';stats.cancelled++;continue;}
   // Bound prepared buffers before installation; incoming and outgoing data coexist for only this commit.
   const old=tiles.get(task.request.key);if(stats.bytes-(old?.bytes||0)+result.value.cells.length*76>8*1048576){stats.error='Vegetation buffer budget reached';continue;}
   if(old&&(outgoing.size>=4||old.bytes+[...outgoing.values()].reduce((n,o)=>n+o.tile.bytes,0)>2*1048576)){queue.push(task.request);break;}
   const install=performance.now(),fade={value:old?0:1},direction={value:0},tile=result.value.polygonal?polygonalVegetation(THREE,result.value,materials(),definition.heightLimits?.min||0,{ownership,fade,direction}):vegetationInstances(THREE,result.value,geometry,materials(),definition.heightLimits?.min||0,{ownership,fade,direction});tile.fade=fade;tile.direction=direction;if(stats.bytes-(old?.bytes||0)+tile.bytes>8*1048576){tile.dispose();stats.error='Vegetation buffer budget reached';continue;}
   if(old){stats.transitions++;const prior=outgoing.get(task.request.key);if(prior){prior.tile.dispose();outgoing.delete(task.request.key);}old.direction.value=1;old.fade.value=0;outgoing.set(task.request.key,{tile:old,started:performance.now()});stats.bytes-=old.bytes;}tiles.set(task.request.key,tile);group.add(tile.group);stats.bytes+=tile.bytes;lastMask='';lastResidency=null;dirty.delete(task.request.key);
   stats.installationMs+=performance.now()-install;stats.lastRequestLatencyMs=performance.now()-task.request.requested;
   if(result.value.cells.length)stats.firstInstalledMs??=performance.now()-stats.started;
   if(result.value.level!==task.request.level)queue.push(task.request);break;
  }
  stats.generationMs+=performance.now()-start;
  // Detailed chunks retain collision ownership; complete feature readiness controls visual proxy coverage.
  sync();
 }
 function sync(){
  ownership.tick(...point,enabled);
  const time=performance.now();for(const [key,old] of outgoing){const t=Math.min(1,(time-old.started)/350);old.tile.fade.value=t;const incoming=tiles.get(key);if(incoming)incoming.fade.value=t;if(t===1){old.tile.dispose();outgoing.delete(key);}}
  const version=manager.loaded.revision,residencyChanged=version!==lastResidency;if(residencyChanged){prioritizeVegetation(manager,ownership,point,lastPriorityPoint);lastPriorityPoint=point.slice();lastResidency=version;}
  const coverage=ownership.revision;if(residencyChanged||coverage!==lastCoverageRevision){detail.sync();lastCoverageRevision=coverage;}const signature=`${version}:${coverage}:${enabled}`;
  if(Number.isFinite(version)&&signature===lastMask)return;lastMask=signature;
  for(const t of [...tiles.values(),...[...outgoing.values()].map(o=>o.tile)])t.visible=t.mask((key,id)=>ownership.value(id)>=1);
 }
 return {update,invalidate,sync,attach(entry,cell){if(enabled)detail.attach(entry,cell);},ownership,prepareView(camera){camera?.updateWorldMatrix(true,false);for(const tile of [...tiles.values(),...[...outgoing.values()].map(o=>o.tile)])tile.prepareView(camera);},
  states(){const states=new Map();for(const t of tiles.values())for(const f of t.data.identities){const old=states.get(f.id),coarse=t.visible?.ids.has(f.id);states.set(f.id,{...f,level:coarse?Math.min(old?.level>0?old.level:2,t.data.level):old?.level??0});}return [...states.values()];},
  snapshot(){const instanceCulling={scans:0,bufferRewrites:0,culled:0};for(const t of tiles.values()){const s=t.cullingSnapshot();for(const key of Object.keys(instanceCulling))instanceCulling[key]+=s[key];}let cells=0,boxes=0,drawCalls=0;const ids=new Set(),levels={0:0,1:0,2:0};for(const t of tiles.values()){cells+=t.visible?.cells||0;boxes+=t.visible?.boxes||0;drawCalls+=t.drawCalls();for(const id of t.visible?.ids||[])ids.add(id);}for(const f of this.states())levels[f.level]++;return {...stats,shaderMeshes:[...tiles.values()].reduce((n,t)=>{const s=t.shaderMeshes?.();if(s){n.dither+=s.dither;n.opaque+=s.opaque;}return n;},{dither:0,opaque:0}),detailAttribution:detail.snapshot(),visibleInstances:[...tiles.values()].reduce((n,t)=>n+(t.instanceCount?.()||0),0),estimatedGpuBytes:[...tiles.values(),...[...outgoing.values()].map(o=>o.tile)].reduce((n,t)=>n+(t.gpuBytes?.()||0),0),extraTransitionDrawCalls:[...outgoing.values()].reduce((n,o)=>n+o.tile.drawCalls(),0),continuity:ownership.snapshot(),transitionRegions:outgoing.size,transitionBytes:[...outgoing.values()].reduce((n,o)=>n+o.tile.bytes,0),instanceCulling,regions:tiles.size,queue:queue.length+(pending?1:0),representedTrees:ids.size,levels,proxyCells:cells,proxyBoxes:boxes,triangles:[...tiles.values()].reduce((n,t)=>n+(t.triangles?.()??(t.visible?.boxes||0)*12),0),drawCalls,queueAgeMs:pending?performance.now()-pending.request.requested:0,visibleCoverage:null,gpuUploadMs:null};},
  dispose(){disposed=true;pending=null;queue=[];for(const k of tiles.keys())release(k);detail.dispose();ownership.dispose();geometry.dispose();group.removeFromParent();}};
}
