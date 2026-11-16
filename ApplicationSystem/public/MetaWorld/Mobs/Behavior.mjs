// Deterministic decision ticks, independent of render cadence. Species parameters drive the reusable controller.
export function createBehavior(config,seed=1){
 let elapsed=0,timer=0,threatTime=0,uncertainCommit=0,serial=seed>>>0;const state={name:'Idle',direction:[0,1],destination:null};
 const random=()=>{serial=(Math.imul(serial,1664525)+1013904223)>>>0;return serial/4294967296;};
 function enter(name,duration=0){state.name=name;timer=duration;}
 return {state,random,step(dt,{position,home,observations=[],blocked=false}){elapsed+=dt;timer-=dt;const b=config(),visual=observations.find(o=>o.type==='vision'&&o.recognized==='player'&&o.confidence>=.2),sound=observations.find(o=>o.type==='sound'&&o.confidence>=(b.soundFlee??.3)&&['running','impact'].includes(o.category)),threat=(visual&&visual.distance<b.fleeRadius?visual:null)||sound,alert=observations.some(o=>(o.type==='vision'||o.type==='sound')&&o.confidence>=(b.soundAlert??.15));
  if(!b.flee&&(state.name==='Alert'||state.name==='Fleeing'))enter('Recovering',2);
  if(b.flee&&threat){threatTime=elapsed;enter('Fleeing',1.5);if(threat.direction&&(threat.visuallyConfirmed||elapsed>=uncertainCommit)){state.direction=threat.direction.map(v=>-v);uncertainCommit=elapsed+.9;}return state;}
  if(state.name==='Fleeing'){if(elapsed-threatTime<(b.memory??1.5))return state;enter('Recovering',2);return state;}
  if(b.flee&&alert&&state.name!=='Alert'){enter('Alert',.6);return state;}
  if(state.name==='Alert'){if(alert)return state;enter('Recovering',2);return state;}
  if(state.name==='Recovering'&&timer>0)return state;
  if(state.name==='Wandering'){if(!b.wander||blocked||timer<=0||Math.hypot(position[0]-state.destination[0],position[2]-state.destination[2])<.4)enter('Idle',b.idleMin+random()*(b.idleMax-b.idleMin));else{const x=state.destination[0]-position[0],z=state.destination[2]-position[2],len=Math.hypot(x,z);state.direction=[x/len,z/len];}return state;}
  if(timer>0)return state;
  if(state.name==='Idle'){enter('Grazing',b.idleMin+random()*(b.idleMax-b.idleMin));return state;}
  if(b.wander){const angle=random()*Math.PI*2,r=Math.sqrt(random())*b.roamingRadius;state.destination=[home[0]+Math.sin(angle)*r,home[1],home[2]+Math.cos(angle)*r];enter('Wandering',4+random()*4);}else enter('Idle',b.idleMin);
  return state;
 },injured(direction){const length=Math.hypot(direction[0],direction[2]);if(length>.001)state.direction=[direction[0]/length,direction[2]/length];threatTime=elapsed;uncertainCommit=elapsed+.9;enter('Fleeing',1.5);},blocked(){if(state.name==='Wandering')enter('Idle',1);}};
}
