import {createArrowSweep} from '../../PanelInstances/ViewPanels/GameViewDependencies/Archery/Collision.mjs';
export function createSensoryOcclusion(ctx,self){
 const {THREE}=ctx,ray=new THREE.Ray(),origin=new THREE.Vector3(),direction=new THREE.Vector3(),point=new THREE.Vector3();let selected=[],candidates=[];
 const sweep=createArrowSweep({THREE,get objects(){return selected;},get colliders(){return candidates;}});
 return (a,b)=>{origin.fromArray(a);direction.fromArray(b).sub(origin);const length=direction.length();if(length<.001)return true;ray.set(origin,direction.divideScalar(length));const roots=new Set();candidates=[];
  for(const c of ctx.colliders){const root=c.target||c.object3d;if(!root||root===self||root.userData.mobRuntime||root.visible===false)continue;const box=c.box,inside=box&&origin.x>=box.min.x&&origin.x<=box.max.x&&origin.y>=box.min.y&&origin.y<=box.max.y&&origin.z>=box.min.z&&origin.z<=box.max.z;if(box&&!inside){const hit=ray.intersectBox(c.box,point);if(!hit||hit.distanceTo(origin)>=length-.02)continue;}roots.add(root);candidates.push(c);}
  selected=[...roots];if(!selected.length)return true;const hit=sweep.sweep(a,b);return !hit||(!hit.uncertain&&hit.distance>=length-.02);
 };
}
