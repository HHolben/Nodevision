// Shared SI projectile model. Positions are arrow tips; midpoint integration is identical in prediction and flight.
export const STEP=1/120;
export const ARROW={mass:.03,drawDistance:.5,efficiency:.75,density:1.225,coefficient:.3,area:.00005,length:.65};
export const DEFAULTS=Object.freeze({minForce:10,maxForce:120,drawTime:1.2,trace:false});
export function validSettings(s){return ['minForce','maxForce','drawTime'].every(k=>Number.isFinite(s[k]))&&s.minForce>=.1&&s.maxForce>=s.minForce&&s.maxForce<=500&&s.drawTime>=.05&&s.drawTime<=10&&typeof s.trace==='boolean';}
export function settings(raw={}){const s={...DEFAULTS,...raw};return validSettings(s)?s:{...DEFAULTS};}
export const drawFraction=(held,s)=>Math.max(0,Math.min(1,held/s.drawTime));
export const drawForce=(held,s)=>s.minForce+drawFraction(held,s)*(s.maxForce-s.minForce);
export const launchSpeed=(force,a=ARROW)=>Math.sqrt(2*a.efficiency*force*a.drawDistance/a.mass);
export const initial=(p,v)=>({p:[...p],v:[...v],time:0,distance:0});
function acceleration(p,v,env){const g=typeof env.gravity==='function'?env.gravity(p):env.gravity||[0,-43.2,0],w=env.wind||[0,0,0],relative=v.map((n,i)=>n-w[i]),speed=Math.hypot(...relative),k=env.drag??(.5*ARROW.density*ARROW.coefficient*ARROW.area/ARROW.mass);return g.map((n,i)=>n-k*speed*relative[i]);}
export function advance(s,env,dt=STEP){
 const a=acceleration(s.p,s.v,env),midP=s.p.map((n,i)=>n+s.v[i]*dt*.5),midV=s.v.map((n,i)=>n+a[i]*dt*.5),midA=acceleration(midP,midV,env);
 const p=s.p.map((n,i)=>n+midV[i]*dt),v=s.v.map((n,i)=>n+midA[i]*dt);
 return {p,v,time:s.time+dt,distance:s.distance+Math.hypot(...p.map((n,i)=>n-s.p[i]))};
}
export function advanceSwept(s,env,sweep=()=>null){
 const next=advance(s,env),hit=sweep(s.p,next.p);if(hit){const length=Math.hypot(...next.p.map((n,i)=>n-s.p[i])),distance=Math.hypot(...hit.point.map((n,i)=>n-s.p[i])),u=length?Math.max(0,Math.min(1,distance/length)):0;next.p=[...hit.point];next.v=s.v.map((n,i)=>n+(next.v[i]-n)*u);next.time=s.time+STEP*u;next.distance=s.distance+distance;}return {state:next,hit};
}
export function simulate(s,env,{steps=960,sweep=()=>null,maxDistance=250}={}){
 const states=[s];let hit=null;
 for(let i=0;i<steps;i++){const result=advanceSwept(s,env,sweep);s=result.state;hit=result.hit;states.push(s);if(hit||s.distance>=maxDistance)break;}
 return {states,hit};
}
