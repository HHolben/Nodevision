// Bounded local steering for ground mobs. Behavior supplies intent; navigation owns detours and progress.
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[2]-b[2]);
const angles=[0,.7,-.7,1.35,-1.35,1.95,-1.95,Math.PI];
export function createNavigation(seed=0){
 const jitter=((Math.imul(seed,2654435761)>>>0)%1024)/1024*.18;let active=false;
 let clock=0,goal=null,heading=0,desired=0,actual=0,until=0,retry=0,side=0,sideUntil=0,window=null,attemptTime=0,rejected=0,recovery=0,displacement=0,goalProgress=0,stuck=false,state='Idle',reason='',failures=[];
 let blockedCount=0,plans=0,probes=0,commitStart=0;
 function clearProgress(){window=null;attemptTime=0;rejected=0;}
 function fail(angle,why){failures.push({angle,time:clock});if(failures.length>8)failures.shift();reason=why;}
 function plan(position,sample,allowed,scale){
  const recovering=state==='Blocked'||state==='Waiting'||stuck;if(recovering)recovery++;plans++;let best=null;
  // Fast path: retain the escape heading when safe. Obstacle cases consider both sides, with a stable side bias.
  for(const offset of angles){const angle=desired+offset;let probe=[...position],safe=true;
   for(let i=0;i<5;i++){probe=[probe[0]+Math.sin(angle)*.24*scale,probe[1],probe[2]+Math.cos(angle)*.24*scale];probes++;if(!allowed(probe)){safe=false;break;}const y=sample(probe);if(y===null){safe=false;break;}probe[1]=y;}
   if(!safe)continue;
   const recent=failures.filter(f=>clock-f.time<4&&Math.abs(wrap(angle-f.angle))<.5).length;
   const preference=side&&clock<sideUntil&&Math.sign(offset)===side?.35:0;
   const score=Math.cos(offset)-.12*Math.abs(wrap(angle-actual))+preference-recent*1.2;
   if(!best||score>best.score+1e-8)best={angle,offset,score};
   if(offset===0&&!recent)break;
  }
  if(!best){goal=null;stuck=true;state='Waiting';reason='No supported clear local route';retry=clock+Math.min(2.5,.5+recovery*.35)+jitter;return;}
  heading=best.angle;goal=[position[0]+Math.sin(heading)*1.2*scale,position[1],position[2]+Math.cos(heading)*1.2*scale];until=clock+.9;commitStart=clock;retry=clock+.15;
  if(Math.abs(best.offset)>.3){side=Math.sign(best.offset);sideUntil=clock+2;}
  if(window)window.goalDistance=distance(window.position,goal);
  state=recovering?'Recovering Navigation':'Following';
 }
 return {
  reset(){active=false;goal=null;until=retry=clock;state='Idle';stuck=false;side=0;failures=[];displacement=goalProgress=0;reason='';clearProgress();},
  suspend(){clearProgress();},
  update(dt,{moving,position,desiredHeading,actualHeading,sample,allowed=()=>true,scale=1}){
   clock+=dt;desired=desiredHeading;actual=actualHeading;
   if(!moving){active=false;goal=null;state='Idle';stuck=false;clearProgress();return {heading:actual,go:false};}
   if(!active){active=true;retry=Math.max(retry,clock+jitter);}
   failures=failures.filter(f=>clock-f.time<4);
   if(goal&&distance(position,goal)<.2*scale)goal=null;
   if(clock>=retry&&(!goal||clock>=until&&Math.abs(wrap(desired-heading))>.45))plan(position,sample,allowed,scale);
   return {heading:goal?Math.atan2(goal[0]-position[0],goal[2]-position[2]):actual,go:!!goal};
  },
  attempt(dt,before,after,accepted,failureReason='Ground support or body clearance rejected'){
   if(!window)window={position:[...before],goalDistance:goal?distance(before,goal):0};attemptTime+=dt;
   if(!accepted){blockedCount++;rejected++;fail(heading,failureReason);goal=null;state='Blocked';retry=clock+.15;}
   displacement=distance(window.position,after);goalProgress=goal?window.goalDistance-distance(after,goal):0;
   if(displacement>.15){stuck=false;if(state==='Recovering Navigation')state='Following';}
   if(attemptTime>=.6){
    if(displacement<.12&&(rejected>=2||goalProgress<.05)){stuck=true;state='Blocked';goal=null;retry=clock+.2;reason='No progress during attempted movement';}
    clearProgress();
   }
  },
  snapshot(){return {state,goal:goal?[...goal]:null,desiredHeading:desired,actualHeading:actual,recentDisplacement:displacement,goalProgress,blockedMovementCount:blockedCount,stuck,recoveryAttempts:recovery,avoidanceDirection:side,committedSeconds:goal?Math.max(0,clock-commitStart):0,commitRemaining:goal?Math.max(0,until-clock):0,retryIn:Math.max(0,retry-clock),recentFailureReason:reason,plans,probeCount:probes,rememberedFailures:failures.length};}
 };
}
