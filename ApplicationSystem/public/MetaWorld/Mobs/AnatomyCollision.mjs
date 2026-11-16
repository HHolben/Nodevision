// Exposed analytic sensory/structural boxes; no GPU resources or scene nodes per part.
export function createAnatomyCollision(THREE,schema,pivot){
 const regions=schema.parts.filter(p=>p.hitRegion.exposed!==false).map(p=>({id:p.id,box:new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(...p.position),new THREE.Vector3(...p.bounds))})),localBounds=new THREE.Box3();regions.forEach(r=>localBounds.union(r.box));
 const inverse=new THREE.Matrix4(),a=new THREE.Vector3(),b=new THREE.Vector3(),point=new THREE.Vector3(),world=new THREE.Vector3(),normal=new THREE.Vector3(),ray=new THREE.Ray(),clamped=new THREE.Vector3();
 const stats={queries:0,regions:0,hitTestMs:0};
 return {stats,bounds(out){return out.copy(localBounds).applyMatrix4(pivot.matrixWorld);},sweep(start,end,{allowFallback=true}={}){const begin=performance.now();stats.queries++;inverse.copy(pivot.matrixWorld).invert();a.fromArray(start).applyMatrix4(inverse);b.fromArray(end).applyMatrix4(inverse);const length=a.distanceTo(b);if(length<1e-12)return null;ray.set(a,b.sub(a).divideScalar(length));let best=null,ties=0;
  for(const r of regions){stats.regions++;if(r.box.containsPoint(a))point.copy(a);else if(!ray.intersectBox(r.box,point))continue;const d=point.distanceTo(a);if(d>length+1e-8)continue;
   if(!best||d<best.distance-1e-8){best={region:r,distance:d,local:point.clone()};ties=1;}else if(Math.abs(d-best.distance)<=1e-8)ties++;
  }
  let uncertain=false;
  if(!best&&allowFallback){
   // Coarse silhouette gaps are approximate: select the closest proxy to broad-box entry,
   // never invent a torso hit. Record this explicitly in the collision/event result.
   if(ray.intersectBox(localBounds,point)&&point.distanceTo(a)<=length){let distance=Infinity;for(const r of regions){r.box.clampPoint(point,clamped);const d=point.distanceToSquared(clamped);if(d<distance){distance=d;best={region:r,local:point.clone()};}}uncertain=true;}
  }
  stats.hitTestMs+=performance.now()-begin;if(!best)return null;
  world.copy(best.local).applyMatrix4(pivot.matrixWorld);const box=best.region.box,center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3()),offset=best.local.clone().sub(center),ratios=offset.toArray().map((v,i)=>Math.abs(v)/(size.getComponent(i)/2)),axis=ratios.indexOf(Math.max(...ratios));normal.set(0,0,0).setComponent(axis,Math.sign(offset.getComponent(axis))||1).applyMatrix3(new THREE.Matrix3().getNormalMatrix(pivot.matrixWorld)).normalize();
  return {part:best.region.id,point:world.toArray(),normal:normal.toArray(),distance:world.distanceTo(new THREE.Vector3(...start)),anatomyUncertain:uncertain||ties>1,anatomyMethod:uncertain?'nearest-proxy-fallback':'proxy-box',overlappingEntry:ties>1};
 }};
}
