import {createProgramController} from '../Creatures/Behaviors/Adapter.mjs';
import {nearbyBehaviorEntities} from '../Creatures/Behaviors/Entities.mjs';
import {resourcePath} from '../Creatures/Document.mjs';
import {missingCreature} from '../Creatures/Missing.mjs';
import {actorPerceptible,playerActorId} from '../../PanelInstances/ViewPanels/GameViewDependencies/PlayerModifiers.mjs';
import {createPerception} from './Perception.mjs';
import {worldSensorySignals} from './SensorySignals.mjs';
import {createSensoryOcclusion} from './SensoryOcclusion.mjs';
import {createAnatomy} from './Anatomy.mjs';
import {createAnatomyCollision} from './AnatomyCollision.mjs';
import {worldAuthoringAllowed} from '../WorldAuthoringPermissions.mjs';
import {createNavigation} from './Navigation.mjs';
import {boxCutsPlayer} from '../../PanelInstances/ViewPanels/GameViewDependencies/compoundPlayerCollision.mjs';
import {mobDefinition} from './Definition.mjs';import {speciesById} from './Registry.mjs';import {createMobVisual} from './Rendering.mjs';import {createBehavior} from './Behavior.mjs';import {createGround} from './Ground.mjs';
// Root = authored home, body = simulated world pose, visual = replaceable model/procedural motion.
export function createMob(THREE,source,colliders=[],options={}){
 if(source.creatureError)return missingCreature(THREE,source);
 let behaviorOverrides=structuredClone(options.behaviorOverrides??source.behavior??{});
 let def=mobDefinition(source,options.worldPath),disposed=false,previous=0,accumulator=0,decision=0,phase=0,time=0,speed=0,ground=null,blocked=false;
 let species=speciesById(def.speciesId,def.creatureDocument?resourcePath(def.creatureDocument,options.worldPath):undefined),geometry=new THREE.BoxGeometry(species.collision.radius*2,species.collision.height,species.length).translate(0,species.collision.height/2,0),material=new THREE.MeshBasicMaterial({visible:false}),root=new THREE.Mesh(geometry,material),body=new THREE.Group(),proxy=new THREE.Mesh(geometry,material);proxy.raycast=()=>{};body.add(proxy);root.add(body);
 const visual=createMobVisual(THREE,body,species,options.load),position=new THREE.Vector3(),home=new THREE.Vector3(),player=new THREE.Vector3(),matrix=new THREE.Matrix4(),box=new THREE.Box3(),arrowBox=new THREE.Box3();let anatomy=createAnatomy(species.anatomy,def.id),perception=createPerception(species.anatomy.senses),anatomyCollision=createAnatomyCollision(THREE,species.anatomy,visual.pivot);let lastMatrix='',verticalSpeed=0,grounded=false,supportTimer=0;
 const stats={steps:0,behaviorMs:0,animationMs:0,groundQueries:0,collisionQueries:0,navigationFailures:0,navigationMs:0,discardedSeconds:0};
 const seed=[...def.id].reduce((n,c)=>Math.imul(n,31)+c.charCodeAt(0)|0,0),brain=createBehavior(()=>({...def.behavior,soundFlee:species.anatomy.senses.behavior.soundFlee,soundAlert:species.anatomy.senses.behavior.soundAlert,memory:species.anatomy.senses.behavior.memory}),seed),navigation=createNavigation(seed);
 let programController;const makeProgram=()=>createProgramController({program:species.runtimeBehaviorProgram||species.behaviorProgram,brain,species,getDefinition:()=>def,getPosition:()=>position.toArray(),getCapabilities:()=>anatomy.effective});programController=makeProgram();
 const holds=new Set();let lineOfSight=null;
 function perceive(ctx){lineOfSight??=createSensoryOcclusion(ctx,root);const signals=ctx.sensorySignals||worldSensorySignals(ctx).signals;return perception.sample({position:position.toArray(),yaw:body.rotation.y+root.rotation.y,capabilities:anatomy.effective.capabilities,player:player.toArray(),signals,time:signals.time,range:def.behavior.detectionRadius,mobId:def.id,playerId:playerActorId(ctx),entities:nearbyBehaviorEntities(ctx,position.toArray(),def.id,def.behavior.detectionRadius),canSense:(source,actor)=>actorPerceptible(ctx,source,actor),lineOfSight});}
 function syncBody(lift=0){root.updateWorldMatrix(true,false);body.position.copy(root.worldToLocal(position.clone().add(new THREE.Vector3(0,lift,0))));body.updateWorldMatrix(true,true);box.setFromObject(proxy);anatomyCollision.bounds(arrowBox);arrowBox.union(box);}
 const collider={type:'expression-heightfield',target:root,box,sampleGroundY:()=>NaN,intersectsPlayer(point,radius,minY,maxY){return root.visible&&boxCutsPlayer(box,point,radius,minY,maxY);},arrowSweep(a,b,options){if(disposed||!root.visible)return null;const start=new THREE.Vector3(...a),delta=new THREE.Vector3(...b).sub(start),length=delta.length(),ray=new THREE.Ray(start,delta.divideScalar(length||1)),point=arrowBox.containsPoint(start)?start:ray.intersectBox(arrowBox,new THREE.Vector3());if(!point||point.distanceTo(start)>length)return null;const hit=anatomyCollision.sweep(a,b,options);return hit?{...hit,root,object:visual.pivot}:null;}};
 root.raycast=(ray,hits)=>{const hit=collider.arrowSweep(ray.ray.origin.toArray(),ray.ray.at(ray.far===Infinity?1e6:ray.far,new THREE.Vector3()).toArray());if(hit&&hit.distance>=ray.near)hits.push({...hit,object:root,point:new THREE.Vector3(...hit.point),face:{normal:new THREE.Vector3(...hit.normal)}});};
 root.userData={creatureDocument:def.creatureDocument?resourcePath(def.creatureDocument,options.worldPath):undefined,nvType:'mob',id:def.id,metaWorldLayerId:def.id,isSolid:true,placedByPlayer:true,breakable:true,preserveLocalTransform:true,colliderRef:collider};proxy.userData.mobRoot=root;colliders.push(collider);
 function update(data,overrides=data.behavior){behaviorOverrides=structuredClone(overrides||{});def=mobDefinition(data,options.worldPath,species);root.name=def.name;root.position.fromArray(def.position);root.rotation.set(...def.rotation);root.scale.fromArray(def.scale);root.visible=def.visible!==false&&def.hidden!==true;lastMatrix='';reset();}
 function reset(){decision=((seed>>>0)%6)/30;navigation.reset();perception.clearObservations();verticalSpeed=0;grounded=false;supportTimer=0;root.updateWorldMatrix(true,false);home.copy(root.getWorldPosition(new THREE.Vector3()));position.copy(home);body.rotation.set(0,0,0);speed=0;phase=0;syncBody();}
 const runtime={visual,body,stats,get species(){return species;},
  replaceAnatomy(next){programController.dispose();species=next;anatomy.dispose();perception.dispose();anatomy=createAnatomy(species.anatomy,def.id);perception=createPerception(species.anatomy.senses);anatomyCollision=createAnatomyCollision(THREE,species.anatomy,visual.pivot);programController=makeProgram();syncBody();},
  setCapabilityInputs(input,ctx=globalThis.window?.VRWorldContext){return programController.setProviderInputs(input,ctx);},get capabilities(){return programController.capabilities;},get skills(){return programController.skills;},get behaviorProgram(){return programController.vm;},
  interact(ctx){return programController.interact(ctx);},
  debugBehavior(command,ctx=globalThis.window?.VRWorldContext){return programController.debug(command,ctx);},
  resetAnatomyTest(ctx=globalThis.window?.VRWorldContext){if(!ctx||!worldAuthoringAllowed(ctx.movementState))return false;anatomy.reset();return true;},get behavior(){return {...def.behavior};},get state(){return ['Dead','Incapacitated'].includes(anatomy.effective.state)?anatomy.effective.state:anatomy.effective.movement.mobile?brain.state.name:'Immobile';},get position(){return position.toArray();},get disposed(){return disposed;},get ready(){return visual.ready;},update,
  refresh(){root.scale.clampScalar(.05,10);reset();lastMatrix='';},
  serialize(){const result=mobDefinition({...def,position:root.position.toArray(),rotation:root.rotation.toArray().slice(0,3),scale:root.scale.toArray(),visible:root.visible,hidden:!root.visible},options.worldPath,species);if(result.creatureRoot){delete result.creatureDocument;delete result.behavior;}else if(result.creatureDocument)result.behavior=structuredClone(behaviorOverrides);return result;},
  suspend(value,reason='inspector'){if(value)holds.add(reason);else holds.delete(reason);runtime.editing=holds.size>0;if(value){programController.suspendWorld('Editing creature');visual.animate('Idle',time,0,0,false);reset();}},editing:false,
  tick(now,ctx){if(disposed)return;let dt=previous?Math.max(0,(now-previous)/1000):0;previous=now;stats.steps=0;stats.behaviorMs=0;stats.animationMs=0;stats.navigationMs=0;
   root.updateWorldMatrix(true,false);const key=root.matrixWorld.elements.join(',');if(key!==lastMatrix){reset();lastMatrix=key;}
   if(def.creatureRoot&&!ctx.movementState.creaturePreviewSimulation&&!ctx.movementState.paused){if(!runtime.editing&&programController.vm){accumulator+=Math.min(dt,.1334);while(accumulator>=1/30){programController.tick(1/30,ctx);accumulator-=1/30;}}visual.animate(runtime.state,now/1000,0,0,!runtime.editing&&def.behavior.animation,anatomy.effective);syncBody();if(!programController.vm)accumulator=0;return;}
   if(ctx.movementState.paused||runtime.editing||!root.visible){programController.suspendWorld(ctx.movementState.paused?'World paused':runtime.editing?'Editing creature':'Creature hidden');accumulator=0;navigation.suspend();return;}
   ctx.controls.getObject().getWorldPosition(player);if(player.distanceToSquared(position)>64*64){programController.suspendWorld('Outside simulation range');accumulator=0;navigation.suspend();return;}ground??=createGround(ctx,root,stats);
   if(dt>.1334){stats.discardedSeconds+=dt-.1334;dt=.1334;}accumulator+=dt;const begin=performance.now(),scale=Math.max(root.scale.x,root.scale.y,root.scale.z),radius=species.collision.radius*scale,height=species.collision.height*scale;
   while(accumulator>=1/30&&stats.steps<4){accumulator-=1/30;stats.steps++;time+=1/30;decision+=1/30;programController.tick(1/30,ctx);
    const gravityModel=ctx.movementState.gravityModel,gravity=gravityModel?.mode==='none'?0:Math.abs((gravityModel?.flatG??.012)*3600);
    supportTimer-=1/30;
    if(gravity>0&&(!grounded||supportTimer<=0)){
     const velocity=verticalSpeed-gravity/30,nextY=position.y+velocity/30,support=ground.fall(position.toArray(),nextY,radius);
     if(support.ready){if(support.floor!==null){position.y=support.floor;verticalSpeed=0;grounded=true;supportTimer=.2;}
      else{position.y=nextY;verticalSpeed=velocity;grounded=false;}}
     else{verticalSpeed=0;grounded=false;}
    }else if(gravity===0){verticalSpeed=0;if(supportTimer<=0){const support=ground.fall(position.toArray(),position.y,radius);grounded=support.ready&&support.floor!==null;supportTimer=.2;}}
    if(programController.vm&&decision>=.2&&(!grounded||!anatomy.effective.movement.mobile)){programController.observe(perceive(ctx));decision=0;}
    if(!def.behavior.enabled||!grounded||!anatomy.effective.movement.mobile||programController.vm?.paused){speed=0;phase=0;decision=0;blocked=true;navigation.suspend();continue;}
    const responseInterval=.2/(.25+.75*(anatomy.effective.capabilities.coordination??1));
    if(decision>=responseInterval){programController.decide(responseInterval,{position:position.toArray(),home:home.toArray(),observations:perceive(ctx)});decision-=responseInterval;blocked=false;}
    const name=brain.state.name,moving=name==='Wandering'||name==='Fleeing'||name==='Following',targetSpeed=moving?(name==='Fleeing'?def.behavior.runSpeed:def.behavior.speed)*anatomy.effective.movement.speed:0;speed+=(targetSpeed-speed)*Math.min(1,5/30*anatomy.effective.movement.acceleration);
    const navStart=performance.now(),desired=Math.atan2(...brain.state.direction),allowed=p=>name==='Fleeing'||name==='Following'||Math.hypot(p[0]-home.x,p[2]-home.z)<=Math.max(def.behavior.roamingRadius,Math.hypot(position.x-home.x,position.z-home.z))+.001;
    const command=navigation.update(1/30,{moving,position:position.toArray(),desiredHeading:desired,actualHeading:body.rotation.y+root.rotation.y,scale,allowed,sample:p=>ground.sample(p,radius,height,.26*scale)});
    const angle=Math.atan2(Math.sin((programController.lookDirection?Math.atan2(...programController.lookDirection):command.heading)-root.rotation.y-body.rotation.y),Math.cos((programController.lookDirection?Math.atan2(...programController.lookDirection):command.heading)-root.rotation.y-body.rotation.y));body.rotation.y+=Math.max(-.15*anatomy.effective.movement.turning,Math.min(.15*anatomy.effective.movement.turning,angle));
    const ready=moving&&command.go&&Math.abs(angle)<.35,duration=(name==='Fleeing'?.4:.65)*anatomy.effective.movement.recovery;phase=ready?(phase+1/30/duration)%1:0;blocked=!ready;
    // Preparation and landing never submit zero-distance movement checks or count as failed progress.
    if(ready&&speed>.01&&phase>.15&&phase<.88){const yaw=body.rotation.y+root.rotation.y,travel=speed/30,before=position.toArray(),candidate=[position.x+Math.sin(yaw)*travel,position.y,position.z+Math.cos(yaw)*travel];
     const y=allowed(candidate)?ground.sample(candidate,radius,height,.26*scale):null;
     if(y===null){stats.navigationFailures++;navigation.attempt(1/30,before,before,false,allowed(candidate)?ground.lastFailure:'Home boundary');speed=0;blocked=true;}
     else{candidate[1]=y;position.fromArray(candidate);grounded=true;supportTimer=.2;navigation.attempt(1/30,before,candidate,true);}
    }
    stats.navigationMs+=performance.now()-navStart;
   }
   stats.behaviorMs=performance.now()-begin;const start=performance.now(),gravityModel=ctx.movementState.gravityModel,gravity=gravityModel?.mode==='none'?0:Math.abs((gravityModel?.flatG??.012)*3600),amplitude=gravity>0?(brain.state.name==='Fleeing'?.18:.09)*Math.min(2,43.2/gravity):0;const hop=Math.max(0,Math.min(1,(phase-.15)/.73));visual.animate(runtime.state,time,hop,0,def.behavior.animation,anatomy.effective);syncBody(def.behavior.animation&&!blocked?Math.sin(Math.PI*hop)*amplitude*scale*anatomy.effective.movement.jump:0);stats.animationMs=performance.now()-start;
  },
  forgetActor(id){programController.forget(id);return perception.forgetActor(id);},
  applyDamage(input){if(disposed)return {applied:false,error:'Disposed mob'};const result=anatomy.applyDamage(input);if(result.applied)programController.damage({...input,bodyPartId:input.bodyPartId});if(result.applied)(options.panel||globalThis.window?.VRWorldContext?.panel)?.dispatchEvent(new CustomEvent('mob-damage',{detail:{...result,mobId:def.id,speciesId:def.speciesId}}));return result;},
  setPartCondition(partId,condition,ctx=globalThis.window?.VRWorldContext){if(disposed||!ctx||!worldAuthoringAllowed(ctx.movementState))return {applied:false,error:'Authoring permission required'};return anatomy.setCondition(partId,condition);},
  testSound(ctx=globalThis.window?.VRWorldContext){if(disposed||!ctx||!worldAuthoringAllowed(ctx.movementState))return false;ctx.controls.getObject().getWorldPosition(player);const signals=ctx.sensorySignals||worldSensorySignals(ctx).signals,yaw=body.rotation.y+root.rotation.y;signals.emit({type:'sound',sourceId:'editor-controlled-sound',category:'footstep',position:[position.x-Math.sin(yaw)*3,position.y+.3,position.z-Math.cos(yaw)*3],intensity:.8},signals.time);perceive(ctx);return true;},
  hit(impact={}){if(!impact||typeof impact!=='object')return {damage:{applied:false,error:'Invalid impact'}};const partId=impact.part,velocity=impact.incomingVelocity,amount=Array.isArray(velocity)&&velocity.length===3&&velocity.every(Number.isFinite)?species.anatomy.arrowDamage*Math.max(.25,Math.min(1.5,Math.hypot(...velocity)/30)):NaN,damage=runtime.applyDamage({targetId:def.id,bodyPartId:partId,amount,damageType:'piercing',sourceId:impact.arrowId,impactPoint:impact.point,impactDirection:impact.incomingVelocity});
   const detail={...impact,mobId:def.id,speciesId:def.speciesId,bodyPartId:partId,damage};if(damage.applied)(options.panel||globalThis.window?.VRWorldContext?.panel)?.dispatchEvent(new CustomEvent('mob-hit',{detail}));return detail;
  },
  snapshot(){return {...stats,id:def.id,speciesId:def.speciesId,state:runtime.state,anatomy:anatomy.snapshot(),perception:perception.snapshot(anatomy.effective.capabilities,def.behavior.detectionRadius),anatomyCollision:{...anatomyCollision.stats},capabilities:programController.capabilities.snapshot(),skills:programController.skills.snapshot(),behaviorProgram:programController.vm?.snapshot()||null,position:position.toArray(),editing:runtime.editing,grounded,verticalSpeed,simulationTime:time,triangles:visual.triangles,modelError:visual.error,navigation:{...navigation.snapshot(),actualHeading:body.rotation.y+root.rotation.y}};},
  dispose(){if(disposed)return;disposed=true;globalThis.window?.VRWorldContext?.archeryBow?.flight.removeTarget(root);programController.dispose();anatomy.dispose();perception.dispose();visual.dispose();proxy.geometry.dispose();proxy.material.dispose();const i=colliders.indexOf(collider);if(i>=0)colliders.splice(i,1);root.removeFromParent();}
 };
 root.userData.mobRuntime=runtime;update(def,behaviorOverrides);return root;
}
