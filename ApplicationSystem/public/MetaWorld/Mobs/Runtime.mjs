import {boxCutsPlayer} from '../../PanelInstances/ViewPanels/GameViewDependencies/compoundPlayerCollision.mjs';
import {mobDefinition} from './Definition.mjs';import {speciesById} from './Registry.mjs';import {createMobVisual} from './Rendering.mjs';import {createBehavior} from './Behavior.mjs';import {createGround} from './Ground.mjs';
// Root = authored home, body = simulated world pose, visual = replaceable model/procedural motion.
export function createMob(THREE,source,colliders=[],options={}){
 let def=mobDefinition(source),disposed=false,previous=0,accumulator=0,decision=0,phase=0,time=0,speed=0,ground=null,blocked=false;
 const species=speciesById(def.speciesId),geometry=new THREE.BoxGeometry(species.collision.radius*2,species.collision.height,species.length).translate(0,species.collision.height/2,0),material=new THREE.MeshBasicMaterial({visible:false}),root=new THREE.Mesh(geometry,material),body=new THREE.Group(),proxy=new THREE.Mesh(geometry,material);proxy.raycast=()=>{};body.add(proxy);root.add(body);
 const visual=createMobVisual(THREE,body,species,options.load),position=new THREE.Vector3(),home=new THREE.Vector3(),player=new THREE.Vector3(),matrix=new THREE.Matrix4(),box=new THREE.Box3();let lastMatrix='';
 const stats={steps:0,behaviorMs:0,animationMs:0,groundQueries:0,collisionQueries:0,navigationFailures:0,discardedSeconds:0};
 const seed=[...def.id].reduce((n,c)=>Math.imul(n,31)+c.charCodeAt(0)|0,0),brain=createBehavior(()=>def.behavior,seed);
 const holds=new Set();
 function syncBody(lift=0){root.updateWorldMatrix(true,false);body.position.copy(root.worldToLocal(position.clone().add(new THREE.Vector3(0,lift,0))));body.updateWorldMatrix(true,true);box.setFromObject(proxy);}
 const collider={type:'expression-heightfield',target:root,box,sampleGroundY:()=>NaN,intersectsPlayer(point,radius,minY,maxY){return root.visible&&boxCutsPlayer(box,point,radius,minY,maxY);},arrowSweep(a,b){if(disposed||!root.visible)return null;const start=new THREE.Vector3(...a),delta=new THREE.Vector3(...b).sub(start),length=delta.length(),ray=new THREE.Ray(start,delta.divideScalar(length||1)),point=ray.intersectBox(box,new THREE.Vector3());if(!point||point.distanceTo(start)>length)return null;const center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3()),offset=point.clone().sub(center),ratios=offset.toArray().map((v,i)=>Math.abs(v)/(size.getComponent(i)/2)),axis=ratios.indexOf(Math.max(...ratios)),normal=[0,0,0];normal[axis]=Math.sign(offset.getComponent(axis));return {root,object:body,point:point.toArray(),normal,distance:point.distanceTo(start),part:'mob'};}};
 root.raycast=(ray,hits)=>{const hit=collider.arrowSweep(ray.ray.origin.toArray(),ray.ray.at(ray.far===Infinity?1e6:ray.far,new THREE.Vector3()).toArray());if(hit&&hit.distance>=ray.near)hits.push({...hit,object:root,point:new THREE.Vector3(...hit.point),face:{normal:new THREE.Vector3(...hit.normal)}});};
 root.userData={nvType:'mob',id:def.id,metaWorldLayerId:def.id,isSolid:true,placedByPlayer:true,breakable:true,preserveLocalTransform:true,colliderRef:collider};proxy.userData.mobRoot=root;colliders.push(collider);
 function update(data){def=mobDefinition(data);root.name=def.name;root.position.fromArray(def.position);root.rotation.set(...def.rotation);root.scale.fromArray(def.scale);root.visible=def.visible!==false&&def.hidden!==true;lastMatrix='';reset();}
 function reset(){root.updateWorldMatrix(true,false);home.copy(root.getWorldPosition(new THREE.Vector3()));position.copy(home);body.rotation.set(0,0,0);speed=0;phase=0;syncBody();}
 const runtime={visual,body,stats,get state(){return brain.state.name;},get position(){return position.toArray();},get disposed(){return disposed;},get ready(){return visual.ready;},update,
  refresh(){root.scale.clampScalar(.05,10);reset();lastMatrix='';},
  serialize(){return mobDefinition({...def,position:root.position.toArray(),rotation:root.rotation.toArray().slice(0,3),scale:root.scale.toArray(),visible:root.visible,hidden:!root.visible});},
  suspend(value,reason='inspector'){if(value)holds.add(reason);else holds.delete(reason);runtime.editing=holds.size>0;if(value){reset();visual.animate('Idle',time,0,0,false);}},editing:false,
  tick(now,ctx){if(disposed)return;let dt=previous?Math.max(0,(now-previous)/1000):0;previous=now;stats.steps=0;stats.behaviorMs=0;stats.animationMs=0;
   root.updateWorldMatrix(true,false);const key=root.matrixWorld.elements.join(',');if(key!==lastMatrix){reset();lastMatrix=key;}
   if(ctx.movementState.paused||runtime.editing||!def.behavior.enabled||!root.visible){accumulator=0;return;}
   ctx.controls.getObject().getWorldPosition(player);if(player.distanceToSquared(position)>64*64){accumulator=0;return;}ground??=createGround(ctx,root,stats);
   if(dt>.1334){stats.discardedSeconds+=dt-.1334;dt=.1334;}accumulator+=dt;const begin=performance.now(),scale=Math.max(root.scale.x,root.scale.y,root.scale.z),radius=species.collision.radius*scale,height=species.collision.height*scale;
   while(accumulator>=1/30&&stats.steps<4){accumulator-=1/30;stats.steps++;time+=1/30;decision+=1/30;
    if(decision>=.2){brain.step(.2,{position:position.toArray(),home:home.toArray(),player:player.toArray(),blocked});decision-=.2;blocked=false;}
    const name=brain.state.name,moving=name==='Wandering'||name==='Fleeing',targetSpeed=moving?(name==='Fleeing'?def.behavior.runSpeed:def.behavior.speed):0;speed+=(targetSpeed-speed)*Math.min(1,5/30);
    const duration=name==='Fleeing'?.4:.65;phase=moving?(phase+1/30/duration)%1:0;
    if(moving&&speed>.01){const [dx,dz]=brain.state.direction,desired=Math.atan2(dx,dz)-root.rotation.y,angle=Math.atan2(Math.sin(desired-body.rotation.y),Math.cos(desired-body.rotation.y));body.rotation.y+=Math.max(-.15,Math.min(.15,angle));const yaw=body.rotation.y+root.rotation.y,gate=phase>.15&&phase<.88?1:0,travel=speed/30*gate,candidate=position.clone().add(new THREE.Vector3(Math.sin(yaw)*travel,0,Math.cos(yaw)*travel));
     if(name!=='Fleeing'&&Math.hypot(candidate.x-home.x,candidate.z-home.z)>Math.max(def.behavior.roamingRadius,Math.hypot(position.x-home.x,position.z-home.z))){brain.blocked();blocked=true;}else{const y=ground.sample(candidate.toArray(),radius,height,.26*scale);if(y===null){stats.navigationFailures++;brain.blocked();blocked=true;speed=0;phase=0;}else{candidate.y=y;position.copy(candidate);}}
    }
   }
   stats.behaviorMs=performance.now()-begin;const start=performance.now(),gravityModel=ctx.movementState.gravityModel,gravity=gravityModel?.mode==='none'?0:Math.abs((gravityModel?.flatG??.002725)*3600),amplitude=gravity>0?(brain.state.name==='Fleeing'?.18:.09)*Math.min(2,43.2/gravity):0;const hop=Math.max(0,Math.min(1,(phase-.15)/.73));syncBody(def.behavior.animation&&!blocked?Math.sin(Math.PI*hop)*amplitude*scale:0);visual.animate(brain.state.name,time,hop,0,def.behavior.animation);stats.animationMs=performance.now()-start;
  },hit(impact){const detail={...impact,mobId:def.id,speciesId:def.speciesId};(options.panel||globalThis.window?.VRWorldContext?.panel)?.dispatchEvent(new CustomEvent('mob-hit',{detail}));return detail;},
  snapshot(){return {...stats,id:def.id,speciesId:def.speciesId,state:brain.state.name,position:position.toArray(),editing:runtime.editing,triangles:visual.triangles,modelError:visual.error};},
  dispose(){if(disposed)return;disposed=true;globalThis.window?.VRWorldContext?.archeryBow?.flight.removeTarget(root);visual.dispose();proxy.geometry.dispose();proxy.material.dispose();const i=colliders.indexOf(collider);if(i>=0)colliders.splice(i,1);root.removeFromParent();}
 };
 root.userData.mobRuntime=runtime;update(def);return root;
}
