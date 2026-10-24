// Nodevision/ApplicationSystem/public/MetaWorld/Paths/PathJoin.mjs
// Projects a picked path surface onto its centerline so branches meet at the same world-space height.
export function nearestPathPoint(samples,point,offset=[0,0,0]) {
  let best=null,distance=Infinity;
  for(let i=1;i<samples.length;i++) {
    const a=samples[i-1].map((v,j)=>v+offset[j]),b=samples[i].map((v,j)=>v+offset[j]);
    const dx=b[0]-a[0],dz=b[2]-a[2],den=dx*dx+dz*dz;if(den<1e-12)continue;
    const t=Math.max(0,Math.min(1,((point[0]-a[0])*dx+(point[2]-a[2])*dz)/den));
    const p=a.map((v,j)=>v+(b[j]-v)*t),d=Math.hypot(p[0]-point[0],p[2]-point[2]);
    if(d<distance){distance=d;best=p;}
  }
  return best;
}
export function pickedPathPoint(context,ray,excludeId) {
  context.scene?.updateMatrixWorld(true);
  const paths=context.objects.filter(o=>o.visible!==false&&o.userData?.pathRuntime&&o.userData.metaWorldLayerId!==excludeId);
  const hit=ray?.intersectObjects(paths,false)[0];if(!hit)return null;
  const runtime=hit.object.userData.pathRuntime,ribbon=runtime.ribbon;if(!ribbon)return null;
  const offset=hit.object.position.toArray().map((v,i)=>v-ribbon.def.position[i]);
  return nearestPathPoint(ribbon.samples,hit.point.toArray(),offset);
}
