import {compiledRegions} from './AnatomyGeometry.mjs';
// Analytic segment tests in region coordinates preserve affine/nonuniform root transforms.
export function createAnatomyCollision(T,schema,pivot){
 const regions=compiledRegions(T,schema),localBounds=new T.Box3();for(const r of regions)localBounds.union(r.box.clone().applyMatrix4(r.matrix));
 const inverse=new T.Matrix4(),a=new T.Vector3(),b=new T.Vector3(),point=new T.Vector3(),world=new T.Vector3(),normal=new T.Vector3(),ray=new T.Ray(),clamped=new T.Vector3();
 const stats={queries:0,regions:0,hitTestMs:0};
 function intersect(r,start,end){const x=start.clone().applyMatrix4(r.inverse),y=end.clone().applyMatrix4(r.inverse),delta=y.sub(x),length=delta.length();if(!length)return null;const dir=delta.divideScalar(length),rr=new T.Ray(x,dir);let hit=null;
  if(r.shape==='box')hit=r.box.containsPoint(x)?x.clone():rr.intersectBox(r.box,new T.Vector3());
  else if(r.shape==='sphere'){const sphere=new T.Sphere(new T.Vector3(),r.dimensions[0]/2);hit=sphere.containsPoint(x)?x.clone():rr.intersectSphere(sphere,new T.Vector3());}
  else {const radius=r.dimensions[0]/2,h=(r.dimensions[1]-r.dimensions[0])/2,candidates=[];const nearestY=Math.max(-h,Math.min(h,x.y));if(x.x*x.x+x.z*x.z+(x.y-nearestY)**2<=radius*radius)return x.applyMatrix4(r.matrix);
   for(const cy of [-h,h]){const v=rr.intersectSphere(new T.Sphere(new T.Vector3(0,cy,0),radius),new T.Vector3());if(v&&(cy<0?v.y<=-h:v.y>=h))candidates.push(v);}
   const A=dir.x**2+dir.z**2,B=2*(x.x*dir.x+x.z*dir.z),C=x.x*x.x+x.z*x.z-radius*radius,D=B*B-4*A*C;if(A>1e-15&&D>=0)for(const t of [(-B-Math.sqrt(D))/(2*A),(-B+Math.sqrt(D))/(2*A)])if(t>=0){const v=rr.at(t,new T.Vector3());if(Math.abs(v.y)<=h)candidates.push(v);}candidates.sort((u,v)=>u.distanceToSquared(x)-v.distanceToSquared(x));hit=candidates[0];
  }
  return hit&&hit.distanceTo(x)<=length+1e-8?hit.applyMatrix4(r.matrix):null;
 }
 return {stats,regions,bounds(out){return out.copy(localBounds).applyMatrix4(pivot.matrixWorld);},sweep(start,end,{allowFallback=true}={}){const begin=performance.now();stats.queries++;inverse.copy(pivot.matrixWorld).invert();a.fromArray(start).applyMatrix4(inverse);b.fromArray(end).applyMatrix4(inverse);const length=a.distanceTo(b);if(length<1e-12||localBounds.isEmpty())return null;ray.set(a,b.clone().sub(a).divideScalar(length));let best=null,ties=0;
  for(const r of regions){stats.regions++;const hit=intersect(r,a,b);if(!hit)continue;const d=hit.distanceTo(a);if(!best||d<best.distance-1e-8){best={region:r,distance:d,local:hit};ties=1;}else if(Math.abs(d-best.distance)<=1e-8)ties++;}
  let uncertain=false;
  if(!best&&allowFallback&&schema.coordinates!=='parent-local'&&ray.intersectBox(localBounds,point)&&point.distanceTo(a)<=length){let distance=Infinity;for(const r of regions){r.box.clampPoint(point.clone().applyMatrix4(r.inverse),clamped);clamped.applyMatrix4(r.matrix);const d=point.distanceToSquared(clamped);if(d<distance){distance=d;best={region:r,local:point.clone()};}}uncertain=true;}
  stats.hitTestMs+=performance.now()-begin;if(!best)return null;world.copy(best.local).applyMatrix4(pivot.matrixWorld);
  const r=best.region,hit=best.local.clone().applyMatrix4(r.inverse);if(r.shape==='box'){const ratios=hit.toArray().map((v,i)=>Math.abs(v)/(r.dimensions[i]/2)),axis=ratios.indexOf(Math.max(...ratios));normal.set(0,0,0).setComponent(axis,Math.sign(hit.getComponent(axis))||1);}else {normal.copy(hit);if(r.shape==='capsule'){const h=(r.dimensions[1]-r.dimensions[0])/2;normal.y-=Math.max(-h,Math.min(h,hit.y));}normal.normalize();}
  if(normal.lengthSq()<1e-20)normal.copy(a).sub(b).transformDirection(r.inverse);
  normal.applyMatrix3(new T.Matrix3().getNormalMatrix(new T.Matrix4().multiplyMatrices(pivot.matrixWorld,r.matrix))).normalize();
  return {part:r.part,region:r.id,point:world.toArray(),normal:normal.toArray(),distance:world.distanceTo(new T.Vector3(...start)),anatomyUncertain:uncertain||ties>1,anatomyMethod:uncertain?'nearest-proxy-fallback':'proxy-'+r.shape,overlappingEntry:ties>1};
 }};
}
