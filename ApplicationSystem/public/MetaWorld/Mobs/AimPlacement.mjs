import {acquireTarget,surfaceHits} from '../../PanelInstances/ViewPanels/GameViewDependencies/RaycastingTeleporter/Target.mjs';

// Mob placement accepts any aimed surface; unsupported placements settle through gravity.
export function mobPlacement(ctx){
 const {THREE}=ctx,camera=ctx.panel?._vrViewController?.getActiveCamera?.()||ctx.camera;
 camera.updateWorldMatrix(true,false);
 const ray=new THREE.Raycaster();ray.setFromCamera({x:0,y:0},camera);ray.far=camera.far??Infinity;
 const objects=ctx.objects.filter(o=>!o.userData.mobRuntime);
 let hit=acquireTarget(THREE,ray,objects,ctx.colliders);
 // Include imported/decorative surfaces and the scene ground, without requiring a collider.
 const roots=new Set([...objects.filter(o=>!ctx.colliders.some(c=>c.target===o||c.object3d===o||c===o.userData.colliderRef)),ctx.ground]);
 for(const root of roots){if(!root)continue;const candidate=surfaceHits(THREE,ray,root)[0];if(candidate&&(!hit||candidate.distance<hit.distance))hit=candidate;}
 const point=hit?.point||ray.ray.at(1,new THREE.Vector3()),direction=ray.ray.direction;
 return {position:point.toArray(),rotation:[0,Math.atan2(-direction.x,-direction.z),0]};
}
