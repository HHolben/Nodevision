// Incremental prediction shares advance() and sweep semantics with live arrows. At most 120 steps/queries per frame, 480 total and 96 dots.
import {advanceSwept,initial} from './Physics.mjs';
export function createPrediction(sweep,visual){
 let key=null,pending=null,lastStart=-Infinity;const stats={predictionMs:0,steps:0,dots:0,recomputations:0};
 function hide(){key=null;pending=null;visual.trace.visible=false;stats.dots=0;stats.predictionMs=0;stats.steps=0;}
 function update(launch,env,collisionKey,now){
  const nextKey=JSON.stringify([launch.p.map(n=>Math.round(n*1000)),launch.v.map(n=>Math.round(n*100)),env.key,collisionKey]);
  if(nextKey!==key&&(now-lastStart>=100||!pending)){key=nextKey;lastStart=now;pending={state:initial(launch.p,launch.v),states:[],steps:0,hit:null,env};pending.states.push(pending.state);stats.recomputations++;}
  const start=performance.now();stats.steps=0;
  if(pending){for(let i=0;i<120;i++){
   const {state:next,hit}=advanceSwept(pending.state,pending.env,sweep);stats.steps++;pending.steps++;pending.states.push(next);pending.state=next;pending.hit=hit;
   if(hit||pending.steps>=480||next.distance>=200){stats.dots=visual.updateTrace(pending.states,hit);pending=null;break;}
  }if(pending)stats.dots=visual.updateTrace(pending.states,null);}
  stats.predictionMs=performance.now()-start;
 }
 return {update,hide,stats,get pending(){return !!pending;}};
}
