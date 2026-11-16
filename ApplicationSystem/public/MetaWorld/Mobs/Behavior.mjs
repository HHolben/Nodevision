// Deterministic decision ticks, independent of render cadence. Species parameters drive the reusable controller.
export function createBehavior(config,seed=1){
 let elapsed=0,timer=0,threatTime=0,serial=seed>>>0;const state={name:'Idle',direction:[0,1],destination:null};
 const random=()=>{serial=(Math.imul(serial,1664525)+1013904223)>>>0;return serial/4294967296;};
 function enter(name,duration=0){state.name=name;timer=duration;}
 return {state,random,step(dt,{position,home,player,blocked=false}){elapsed+=dt;timer-=dt;const dx=position[0]-player[0],dz=position[2]-player[2],planar=Math.hypot(dx,dz),distance=Math.hypot(dx,position[1]-player[1],dz),b=config();
  if(!b.flee&&(state.name==='Alert'||state.name==='Fleeing'))enter('Recovering',2);
  if(b.flee&&distance<b.fleeRadius){threatTime=elapsed;enter('Fleeing',1.5);state.direction=[dx/(planar||1),dz/(planar||1)];if(distance<.001)state.direction=[1,0];return state;}
  if(state.name==='Fleeing'){if(elapsed-threatTime<1.5||distance<b.detectionRadius+2)return state;enter('Recovering',2);return state;}
  if(b.flee&&distance<b.detectionRadius&&state.name!=='Alert'){enter('Alert',.6);return state;}
  if(state.name==='Alert'){if(distance<b.detectionRadius+1)return state;enter('Recovering',2);return state;}
  if(state.name==='Recovering'&&timer>0)return state;
  if(state.name==='Wandering'){if(!b.wander||blocked||timer<=0||Math.hypot(position[0]-state.destination[0],position[2]-state.destination[2])<.4)enter('Idle',b.idleMin+random()*(b.idleMax-b.idleMin));else{const x=state.destination[0]-position[0],z=state.destination[2]-position[2],len=Math.hypot(x,z);state.direction=[x/len,z/len];}return state;}
  if(timer>0)return state;
  if(state.name==='Idle'){enter('Grazing',b.idleMin+random()*(b.idleMax-b.idleMin));return state;}
  if(b.wander){const angle=random()*Math.PI*2,r=Math.sqrt(random())*b.roamingRadius;state.destination=[home[0]+Math.sin(angle)*r,home[1],home[2]+Math.cos(angle)*r];enter('Wandering',4+random()*4);}else enter('Idle',b.idleMin);
  return state;
 },blocked(){if(state.name==='Wandering')enter('Idle',1);else{const [x,z]=state.direction;state.direction=[-z,x];}}};
}
