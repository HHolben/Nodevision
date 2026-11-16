import {SWORD,swordPose,swordPhase} from './Pose.mjs';
let serial=0;
export function createSwordCombat({THREE,sweep,emit=()=>{},actorId='session-player'}){
 const owner=++serial;let attack=null,sequence=0,previous=null;const struck=new Set(),stats={attacks:0,queries:0,queryMs:0,duplicateRejections:0,discardedSeconds:0,lastHit:null};
 function query(a,b){stats.queries++;const start=performance.now();try{return sweep(a.toArray(),b.toArray());}finally{stats.queryMs+=performance.now()-start;}}
 function begin(){if(attack)return false;attack={id:`sword-${owner}-${++sequence}`,elapsed:0,blocked:false};previous=null;struck.clear();stats.attacks++;emit('sword-swing',{attackId:attack.id});return true;}
 function contact(hit,camera){if(!hit||hit.uncertain)return;if(struck.has(hit.root)){stats.duplicateRejections++;return;}const point=new THREE.Vector3(...hit.point),origin=camera.getWorldPosition(new THREE.Vector3()),direction=point.clone().sub(origin);if(direction.length()>SWORD.reach||direction.dot(camera.getWorldDirection(new THREE.Vector3()))<=0)return;
  if(struck.size>=16)return;struck.add(hit.root);const root=hit.root,mob=root?.userData.mobRuntime;let damage=null;const distance=direction.length();direction.normalize();
  if(mob){damage=mob.applyDamage({targetId:root.userData.id,bodyPartId:hit.part,amount:SWORD.damage,damageType:'slashing',sourceId:attack.id,impactPoint:hit.point,impactDirection:direction.toArray()});}
  else if(root?.userData.archeryTargetRuntime){root.userData.archeryTargetRuntime.hit({arrowId:attack.id,part:hit.part,point:hit.point,normal:hit.normal,incomingVelocity:direction.toArray(),launchForce:0,launchSpeed:0,flightDuration:0,traveledDistance:distance,weaponId:'sword'});}
  else root?.userData.onMeleeHit?.({attackId:attack.id,point:hit.point,normal:hit.normal,damageType:'slashing',amount:SWORD.damage});
  stats.lastHit={entityId:root?.userData.id||root?.uuid,bodyPartId:hit.part,damage,anatomyUncertain:hit.anatomyUncertain===true};emit('sword-hit',{attackId:attack.id,actorId,point:hit.point,normal:hit.normal,...stats.lastHit});if(!mob)attack.blocked=true;
 }
 function update(dt,camera,hand){if(!attack)return null;dt=Math.max(0,dt);if(dt>.1){stats.discardedSeconds+=dt-.1;dt=.1;}const steps=Math.min(SWORD.maxSteps,Math.max(1,Math.ceil(dt/SWORD.step))),step=dt/steps;
  for(let i=0;i<steps&&attack;i++){attack.elapsed+=step;const pose=swordPose(THREE,camera,attack.elapsed,hand);
   if(pose.phase==='strike'&&!attack.blocked){const origin=camera.getWorldPosition(new THREE.Vector3());if(query(origin,pose.base)){attack.blocked=true;emit('sword-blocked',{attackId:attack.id});}else{
    const hits=[];const take=h=>{if(h)hits.push(h);};take(query(pose.base,pose.tip));if(previous){for(const t of [0,.33,.66,1])take(query(previous.base.clone().lerp(previous.tip,t),pose.base.clone().lerp(pose.tip,t)));}
    // Every candidate must also have a clear arm-to-impact line, so temporal sweeps cannot cut corners through walls.
    for(const hit of hits){if(hit.uncertain){attack.blocked=true;emit('sword-blocked',{attackId:attack.id});break;}const blocker=query(origin,new THREE.Vector3(...hit.point));if(blocker?.uncertain){attack.blocked=true;break;}if(blocker&&blocker.root!==hit.root){attack.blocked=true;break;}contact(hit,camera);if(attack.blocked)break;}
   }}previous=pose;if(attack.elapsed>=SWORD.duration){attack=null;previous=null;struck.clear();}
  }return swordPose(THREE,camera,attack?.elapsed??null,hand);
 }
 return {begin,update,cancel(){attack=null;previous=null;struck.clear();},snapshot(){return {...stats,lastHit:stats.lastHit&&structuredClone(stats.lastHit),attackId:attack?.id||null,phase:attack?swordPhase(attack.elapsed):'ready',elapsed:attack?.elapsed||0,duration:SWORD.duration,trackedTargets:struck.size};}};
}
