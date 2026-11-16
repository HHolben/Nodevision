// Legacy world gravity uses metres per reference-frame squared (60 Hz). Convert to SI, including point-mass gravity at each projectile position.
export function arrowEnvironment(ctx){
 const model=ctx.api.readActiveGravityModel(),point=model.mode==='point-mass'?ctx.api.resolveGravityPointPosition(model).toArray():null;
 return {key:JSON.stringify([model,point]),gravity:p=>{
  if(model.mode==='none')return [0,0,0];if(model.mode==='flat')return [0,-model.flatG*3600,0];
  const d=point.map((n,i)=>n-p[i]),sq=Math.max(.0001,d.reduce((s,n)=>s+n*n,0)),length=Math.hypot(...d);
  return length?d.map(n=>n/length*Math.min(4,model.bigG*model.mass/sq)*3600):[0,0,0];
 }};
}
