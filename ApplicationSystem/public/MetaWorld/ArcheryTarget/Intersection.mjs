// Closed finite circular board in local XY; front +Z scores, back and rim are physical but do not score.
export function boardIntersection(THREE,root,def,raycaster){
 root.updateWorldMatrix(true,false);if(Math.abs(root.matrixWorld.determinant())<1e-12)return null;
 const local=raycaster.ray.clone().applyMatrix4(root.matrixWorld.clone().invert()),o=local.origin,d=local.direction,r=def.diameter/2,h=def.faceHeight,t=def.thickness/2,candidates=[];
 const add=(distance,part,normal)=>{if(distance< -1e-8||!Number.isFinite(distance))return;const p=local.at(Math.max(0,distance),new THREE.Vector3()),world=p.clone().applyMatrix4(root.matrixWorld),worldDistance=world.distanceTo(raycaster.ray.origin);if(worldDistance<raycaster.near||worldDistance>raycaster.far+1e-8)return;candidates.push({distance:worldDistance,point:world,localPoint:p.toArray(),part,object:root,root,face:{normal:new THREE.Vector3(...normal)},normal:new THREE.Vector3(...normal).applyMatrix3(new THREE.Matrix3().getNormalMatrix(root.matrixWorld)).normalize()});};
 if(Math.abs(d.z)>1e-12)for(const side of [1,-1]){const distance=(side*t-o.z)/d.z,p=local.at(distance,new THREE.Vector3());if(p.x*p.x+(p.y-h)**2<=r*r+1e-9)add(distance,side===1?'face':'back',[0,0,side]);}
 const a=d.x*d.x+d.y*d.y,b=2*(o.x*d.x+(o.y-h)*d.y),c=o.x*o.x+(o.y-h)**2-r*r,discriminant=b*b-4*a*c;
 if(a>1e-12&&discriminant>=0)for(const sign of [-1,1]){const distance=(-b+sign*Math.sqrt(discriminant))/(2*a),p=local.at(distance,new THREE.Vector3());if(Math.abs(p.z)<=t+1e-8)add(distance,'rim',[p.x/r,(p.y-h)/r,0]);}
 return candidates.sort((a,b)=>a.distance-b.distance)[0]||null;
}
