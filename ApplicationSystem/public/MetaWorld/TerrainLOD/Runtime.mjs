// Nodevision/ApplicationSystem/public/MetaWorld/TerrainLOD/Runtime.mjs
// This per-terrain visual layer schedules bounded world-space heightfield tiles alongside the existing detailed chunk manager. It keeps outgoing tiles until replacements finish and masks coarse sections only when all detailed levels are resident.
import {GEO_BUDGETS} from '../Geographic/Budgets.mjs';
import {terrainStreaming} from './Settings.mjs';
import {heightfieldSteps} from './Heightfield.mjs';
import {createTileMesh} from './TileMesh.mjs';
export function createTerrainLOD(THREE,root,definition,generator,manager,materials,map) {
  let settings=terrainStreaming(definition.streaming),pending=null,disposed=false,lastKey='',revision=0;
  const requestTimes=new Map(),tiles=new Map(),dirty=new Set(),edits=new Map(),group=new THREE.Group();group.name='Terrain distance detail';
  const stats={requests:0,generated:0,evictions:0,cancelled:0,coarseCpuMs:0,installationMs:0,bytes:0,firstGeometryMs:null,started:performance.now(),queue:0};
  let queue=[];
  const modified=(x,z)=>[...edits.values()].some(b=>x*8<b.maxX&&(x+1)*8>b.minX&&z*8<b.maxZ&&(z+1)*8>b.minZ);
  function release(key){const t=tiles.get(key);if(!t)return;t.dispose();stats.bytes-=t.bytes;tiles.delete(key);}
  function configure(value){settings=terrainStreaming(value);if(settings.enabled)manager.options={budgetMs:GEO_BUDGETS.frameMs,maxChunks:GEO_BUDGETS.residentChunks,maxBytes:GEO_BUDGETS.residentBytes};manager.streaming=settings.enabled;manager.predictive=settings.enabled&&settings.predictive;manager.center='';lastKey='';for(const key of [...tiles.keys()].reverse()){if(stats.bytes<=settings.coarseBudgetMiB*1048576)break;release(key);}group.visible=settings.enabled;if(settings.enabled){if(!group.parent)root.add(group);}else group.removeFromParent();if(!settings.enabled){pending=null;queue=[];for(const k of tiles.keys())release(k);}}
  configure(settings);
  function invalidate(bounds,kind='source'){
    revision++;pending=null;lastKey='';
    if(kind!=='source'&&bounds){const old=edits.get(kind);edits.set(kind,old?{minX:Math.min(old.minX,bounds.minX),maxX:Math.max(old.maxX,bounds.maxX),minZ:Math.min(old.minZ,bounds.minZ),maxZ:Math.max(old.maxZ,bounds.maxZ)}:{...bounds});}
    if(edits.size>256){const boxes=[...edits.values()];edits.clear();edits.set('retained-edits',{minX:Math.min(...boxes.map(b=>b.minX)),maxX:Math.max(...boxes.map(b=>b.maxX)),minZ:Math.min(...boxes.map(b=>b.minZ)),maxZ:Math.max(...boxes.map(b=>b.maxZ))});}
    for(const [key,t] of tiles)if(!bounds||t.tx*64<bounds.maxX&&(t.tx+1)*64>bounds.minX&&t.tz*64<bounds.maxZ&&(t.tz+1)*64>bounds.minZ)dirty.add(key);
  }
  function plan(x,z){
    const cx=Math.floor(x/64),cz=Math.floor(z/64),radius=Math.ceil(settings.visibilityDistance/64),key=`${cx},${cz},${Math.floor(x/8)},${Math.floor(z/8)}`;
    if(key===lastKey)return;lastKey=key;
    const candidates=[];
    for(let tz=Math.max(0,cz-radius);tz<=Math.min(Math.ceil(definition.size[2]/64)-1,cz+radius);tz++)for(let tx=Math.max(0,cx-radius);tx<=Math.min(Math.ceil(definition.size[0]/64)-1,cx+radius);tx++){
      const distance=Math.hypot(Math.max(tx*64-x,0,x-(tx+1)*64),Math.max(tz*64-z,0,z-(tz+1)*64));
      if(distance>settings.visibilityDistance)continue;
      const key=`${tx},${tz}`,old=tiles.get(key),level=distance<(old?.level===1?80:64)?1:2;
      candidates.push({key,tx,tz,level,distance,requested:requestTimes.get(key)??performance.now()});
    }
    // Bounded selection uses coarse tiles before refining their resolution.
    candidates.sort((a,b)=>a.distance-b.distance);const selected=candidates.slice(0,128),wanted=new Set(selected.map(t=>t.key));
    for(const t of selected)if(!requestTimes.has(t.key))requestTimes.set(t.key,t.requested);
    for(const key of requestTimes.keys())if(!wanted.has(key))requestTimes.delete(key);
    for(const [k,t] of tiles)if(!wanted.has(k)){release(k);dirty.delete(k);stats.evictions++;}
    if(pending&&!wanted.has(pending.request.key)){pending=null;stats.cancelled++;}
    queue=selected.filter(t=>t.key!==pending?.request.key&&(!tiles.has(t.key)||dirty.has(t.key)||tiles.get(t.key).level!==t.level||!tiles.get(t.key).coverageRefined)).sort((a,b)=>Number(tiles.has(a.key))-Number(tiles.has(b.key))||a.distance-b.distance);
    stats.requestedRegions=selected.length;stats.distanceCandidateRegions=candidates.length;
    // Edited columns receive full composed detail even outside the normal near radius.
    const refinement=[];for(const t of selected)for(let zz=t.tz*8;zz<(t.tz+1)*8;zz++)for(let xx=t.tx*8;xx<(t.tx+1)*8;xx++)if(modified(xx,zz)||tiles.get(t.key)?.refinement?.some(([x,z])=>x===xx&&z===zz))refinement.push([xx,zz]);
    refinement.sort((a,b)=>(a[0]*8-x)**2+(a[1]*8-z)**2-((b[0]*8-x)**2+(b[1]*8-z)**2));
    const next=refinement.slice(0,64);if(JSON.stringify(next)!==JSON.stringify(manager.refinementColumns||[]))manager.center='';manager.refinementColumns=next;
  }
  function update(position){
    if(disposed||!settings.enabled)return;
    const x=position.x-root.position.x,z=position.z-root.position.z;plan(x,z);
    const start=performance.now(),deadline=start+2;
    while(performance.now()<deadline){
      if(!pending){const request=queue.shift();if(!request)break;stats.requests++;
        // Mapped sources may be streamed externally. Never turn pending tiles into invented terrain.
        const bounds={minX:request.tx*64,minZ:request.tz*64,maxX:Math.min(definition.size[0],(request.tx+1)*64),maxZ:Math.min(definition.size[2],(request.tz+1)*64)};
        pending={request,revision,ready:!map,iterator:null};
        if(map){const task=pending;map.prepare(bounds).then(()=>{if(task===pending){generator.invalidateTerrainSource();task.ready=true;}}).catch(error=>{if(task===pending){stats.error=error.message;pending=null;}});break;}
      }
      if(!pending.ready)break;
      const task=pending,r=task.request;
      task.iterator ||= heightfieldSteps(generator,definition,r.tx,r.tz,tiles.has(r.key)?r.level:2,modified,tiles.has(r.key));
      const result=task.iterator.next();if(!result.done)continue;
      pending=null;if(task.revision!==revision)continue;
      const install=performance.now(),tile=createTileMesh(THREE,result.value,materials());
      if(stats.bytes-(tiles.get(r.key)?.bytes||0)+tile.bytes>settings.coarseBudgetMiB*1048576){tile.dispose();stats.error='Coarse terrain cache budget reached.';continue;}
      release(r.key);Object.assign(tile,{coverageRefined:result.value.coverageRefined,refinement:result.value.sections.filter(s=>s.requiresVolume).map(s=>[s.x,s.z]),tx:r.tx,tz:r.tz,level:result.value.level,requestLatencyMs:performance.now()-r.requested});tiles.set(r.key,tile);group.add(tile.mesh);stats.bytes+=tile.bytes;stats.generated++;dirty.delete(r.key);if(tile.refinement.length)lastKey='';
      stats.installationMs+=performance.now()-install;stats.firstGeometryMs??=performance.now()-stats.started;
      if(tile.level!==r.level||!tile.coverageRefined)queue.push({...r,requested:performance.now()});
      break;
    }
    stats.coarseCpuMs+=performance.now()-start;
    for(const t of tiles.values())t.mask((x,z)=>manager.columnReady(x,z));
    stats.queue=queue.length+(pending?1:0);stats.missingRequestedTiles=Math.max(0,(stats.requestedRegions||0)-tiles.size);
  }
  return {update,invalidate,configure,modified,get settings(){return {...settings};},
    snapshot(){let triangles=0,drawCalls=0;for(const t of tiles.values()){triangles+=t.mesh.geometry.index.count/3;if(t.mesh.visible)drawCalls+=t.mesh.geometry.groups.length;}const levels={0:manager.loaded.size,1:0,2:0},bytes={0:manager.stats.residentBytes,1:0,2:0};for(const t of tiles.values()){levels[t.level]++;bytes[t.level]+=t.bytes;}return {...stats,triangles,drawCalls,levels,bytes,visibilityDistance:settings.visibilityDistance,predictive:settings.predictive,refinementColumns:manager.refinementColumns?.length||0,tiles:tiles.size,queueAgeMs:pending?performance.now()-pending.request.requested:0,gpuUploadMs:null};},
    dispose(){disposed=true;pending=null;queue=[];for(const k of tiles.keys())release(k);group.removeFromParent();}};
}
