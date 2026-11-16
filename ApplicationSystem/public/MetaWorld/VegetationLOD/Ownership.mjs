// Nodevision/ApplicationSystem/public/MetaWorld/VegetationLOD/Ownership.mjs
// Bounded logical-feature readiness shared by every region and detailed chunk section. Slot references come only from resident geometry/proxies; one stable texture drives complementary coverage and limits simultaneous late upgrades.
export function vegetationOwnership(THREE,manager,{duration=350,maxTransitions=8,now=()=>performance.now()}={}){
 let bytes=new Uint8Array(4096*4).fill(255);const texture=new THREE.DataTexture(bytes,4096,1);texture.needsUpdate=true;
 const records=new Map(),free=Array.from({length:4095},(_,i)=>4095-i);let enabled=false,position=[0,0],active=0,chunkKeys=0,revision=0;
 const stats={completed:0,lateUpgrades:0,incompleteFeatures:0,failures:0,maxTransitioning:0,lastDurationMs:0,readinessLatencyMs:0,timeNearBeforeReadyMs:0};
 function value(r,v){if(r.value===v)return;const stage=n=>n<=0?0:n>=1?2:1;if(stage(r.value)!==stage(v))revision++;r.value=v;bytes[r.slot*4]=Math.round(v*255);texture.needsUpdate=true;}
 function featureChunks(feature){const min=feature.min.map(n=>Math.floor(n/32)),max=feature.max.map(n=>Math.floor((n-1)/32)),chunks=[];for(let z=min[2];z<=max[2]&&chunks.length<=128;z++)for(let y=min[1];y<=max[1]&&chunks.length<=128;y++)for(let x=min[0];x<=max[0]&&chunks.length<=128;x++)chunks.push(`${x},${y},${z}`);return chunks;}
 function retain(feature,kind){
  let r=records.get(feature.id);
  if(!r){const slot=free.pop();if(!slot){stats.failures++;return 0;}
   const chunks=featureChunks(feature);
   r={id:feature.id,feature,slot,detail:0,proxy:0,value:1,started:null,first:now(),chunks,ready:false,nearSince:null};chunkKeys+=chunks.length;records.set(feature.id,r);revision++;value(r,1);
  }
  if(['min','max','origin'].some(key=>feature[key].some((v,a)=>v!==r.feature[key][a]))){if(r.started!==null){r.started=null;active--;}chunkKeys-=r.chunks.length;r.chunks=featureChunks(feature);chunkKeys+=r.chunks.length;r.feature=feature;r.ready=false;r.version=null;if(r.proxy&&enabled)value(r,0);}
  r[kind]++;if(kind==='proxy'&&r.proxy===1)r.proxyFirst=now();if(kind==='proxy'&&r.proxy===1&&r.detail===0&&enabled)value(r,0);return r.slot;
 }
 function release(id,kind){const r=records.get(id);if(!r)return;r[kind]=Math.max(0,r[kind]-1);if(!r.detail&&!r.proxy){if(r.started!==null)active--;bytes[r.slot*4]=255;texture.needsUpdate=true;free.push(r.slot);chunkKeys-=r.chunks.length;records.delete(id);}}
 function ready(r){const version=manager.loaded.revision,invalid=manager.invalidated?.revision,columns=manager.columnLevels?.revision;if(Number.isFinite(version)&&r.version===version&&r.invalid===invalid&&r.columns===columns)return r.ready;r.version=version;r.invalid=invalid;r.columns=columns;return r.chunks.length<=128&&r.chunks.every(key=>{const e=manager.loaded.get(key);if(e)return !manager.invalidated?.has(key)&&(!e.mesh||e.mesh.visible);const [x,y,z]=key.split(',').map(Number),levels=manager.columnLevels?.get(`${x},${z}`);return !!levels&&!levels.includes(y);});}
 function tick(x=position[0],z=position[1],on=true){
  enabled=on;position=[x,z];const time=now();stats.incompleteFeatures=0;
  const waiting=[];
  for(const r of records.values()){
   if(!enabled||!r.proxy){if(r.started!==null){r.started=null;active--;}value(r,1);continue;}
   const f=r.feature,distance=Math.hypot(Math.max(f.min[0]*.25-x,0,x-f.max[0]*.25),Math.max(f.min[2]*.25-z,0,z-f.max[2]*.25));
   r.nearSince=distance<8?(r.nearSince??time):null;
   r.ready=ready(r);
   if(!r.ready){stats.incompleteFeatures++;if(r.started!==null){r.started=null;active--;}value(r,0);continue;}
   if(r.started!==null){value(r,Math.min(1,(time-r.started)/duration));if(r.value===1){stats.completed++;stats.lastDurationMs=time-r.started;r.started=null;active--;}}
   else if(r.value<1)waiting.push({r,distance});
  }
  waiting.sort((a,b)=>a.distance-b.distance||a.r.first-b.r.first);
  for(const {r,distance} of waiting){if(active>=maxTransitions)break;r.started=time;active++;if(distance<8)stats.lateUpgrades++;stats.readinessLatencyMs=time-(r.proxyFirst??r.first);stats.timeNearBeforeReadyMs=r.nearSince===null?0:time-r.nearSince;}
  stats.maxTransitioning=Math.max(stats.maxTransitioning,active);
 }
 return {texture,retain,release,tick,get revision(){return revision;},slot:id=>records.get(id)?.slot||0,value:id=>records.get(id)?.value??null,
  records:()=>records.values(),snapshot:()=>({...stats,coverageRevision:revision,trackedFeatures:records.size,transitioning:active,durationMs:duration,stateBytes:bytes.byteLength+records.size*256+chunkKeys*40}),
  dispose(){records.clear();free.length=0;active=0;chunkKeys=0;texture.dispose();texture.image.data=null;bytes=new Uint8Array(0);}};
}
