// Session-only, bounded projectile ownership. No world objects, history entries, or collider registrations are created.
import {advanceSwept,initial,STEP} from './Physics.mjs';
export function createFlights({THREE,sweep,emit,visual,listener=()=>null}){
 const records=[];let serial=0,accumulator=0;const stats={physicsMs:0,steps:0,discardedSeconds:0};
 function remove(r,reason){const i=records.indexOf(r);if(i>=0){records.splice(i,1);emit('arrow-removed',{...info(r),reason});}}
 function info(r){return {arrowId:r.id,shooterId:r.shooterId,launchForce:r.force,launchSpeed:r.speed,flightDuration:r.state.time,traveledDistance:r.state.distance};}
 function launch(p,v,{force,speed,shooterId}){
  const flying=records.filter(r=>!r.hit);if(flying.length>=16)remove(flying[0],'flying-budget');
  const r={id:`arrow-${++serial}`,state:initial(p,v),force,speed,shooterId};records.push(r);emit('arrow-fired',{...info(r),position:[...p],velocity:[...v]});return r;
 }
 function impact(r,hit){
  if(r.hit)return;
  if(hit.uncertain){emit('arrow-missed',{...info(r),reason:'collision-unavailable'});remove(r,'collision-unavailable');return;}
  r.hit=hit;r.state.p=[...hit.point];r.state.v=[...r.state.v];
  const object=hit.object||hit.root;if(object){object.updateWorldMatrix(true,false);r.attachment={object,point:object.worldToLocal(new THREE.Vector3(...hit.point)),direction:new THREE.Vector3(...r.state.v).transformDirection(object.matrixWorld.clone().invert())};}
  const incomingVelocity=[...r.state.v],targetHit=hit.root?.userData?.archeryTargetRuntime?.hit({...info(r),point:[...hit.point],normal:[...hit.normal],part:hit.part,incomingVelocity,simulationTime:r.state.time});
  const mobHit=hit.root?.userData?.mobRuntime?.hit({...info(r),point:[...hit.point],normal:[...hit.normal],incomingVelocity,simulationTime:r.state.time});
  emit(hit.terrain?'arrow-hit-terrain':'arrow-hit-object',{...info(r),objectId:hit.root?.userData?.id||hit.root?.userData?.worldObjectId||hit.root?.uuid,object:hit.root,hitObject:object,point:[...hit.point],normal:[...hit.normal],incomingVelocity,targetHit,mobHit,simulationTime:r.state.time});
  const embedded=records.filter(a=>a.hit);if(embedded.length>64){const near=listener(),far=near&&embedded.find(a=>Math.hypot(...a.state.p.map((n,i)=>n-near[i]))>80);remove(far||embedded[0],'embedded-budget');}
 }
 function tick(dt,env){
  const start=performance.now();stats.steps=0;accumulator+=Math.max(0,dt);if(accumulator>.4){stats.discardedSeconds+=accumulator-.4;accumulator=.4;}
  while(accumulator+1e-10>=STEP){accumulator=Math.max(0,accumulator-STEP);for(const r of [...records]){
   if(r.hit)continue;const {state:next,hit}=advanceSwept(r.state,env,sweep);r.state=next;
   if(hit)impact(r,hit);else if(next.time>=12||next.distance>=350){emit('arrow-missed',{...info(r),reason:'range-or-time'});remove(r,'expired');}
  }stats.steps++;}
  followAttachments();stats.physicsMs=performance.now()-start;
 }
 function followAttachments(){
  for(const r of [...records])if(r.attachment){const a=r.attachment;if(!a.object.parent){remove(r,'target-removed');continue;}a.object.updateWorldMatrix(true,false);r.state.p=a.object.localToWorld(a.point.clone()).toArray();r.state.v=a.direction.clone().transformDirection(a.object.matrixWorld).toArray();}
  visual.updateArrows(records);
 }
 function clear(){for(const r of [...records])remove(r,'world-closed');accumulator=0;visual.updateArrows(records);}
 return {records,launch,impact,tick,clear,stats,followAttachments,removeTarget(target){for(const r of [...records])if(r.hit?.root===target)remove(r,'target-removed');visual.updateArrows(records);},resetClock(){accumulator=0;},snapshot(){return {...stats,flying:records.filter(r=>!r.hit).length,embedded:records.filter(r=>r.hit).length};}};
}
