import {terrainPointCovered} from '../ProceduralVoxelWorld/TerrainCoverage.mjs';
import {createCollisionChecker} from '../../PanelInstances/ViewPanels/GameViewDependencies/collisionCheck.mjs';
import {surfaceHits} from '../../PanelInstances/ViewPanels/GameViewDependencies/RaycastingTeleporter/Target.mjs';
// Local, bounded support and clearance checks. No map preparation or distant terrain generation.
export function createGround(ctx,self,stats){
 const {THREE}=ctx,ray=new THREE.Raycaster(),point=new THREE.Vector3();
 function height(x,z,y,step){stats.groundQueries++;let best=-Infinity,covered=false;
  for(const c of ctx.colliders){const root=c.target||c.object3d;if(root===self||root?.userData.mobRuntime||root?.visible===false)continue;const terrain=root?.userData.terrainRuntime;
   if(terrain){const d=terrain.definition,inf=terrain.generator.dimensions.infinite;if(!inf&&(x<root.position.x||z<root.position.z||x>=root.position.x+d.size[0]||z>=root.position.z+d.size[2]))continue;covered=true;if(!terrainPointCovered(terrain,x,z)||!terrain.mapSampleReady([x,y,z]))return NaN;}
   let h;if(c.sampleGroundY)h=c.sampleGroundY(x,z,y+step);else if(root){ray.set(point.set(x,y+step,z),new THREE.Vector3(0,-1,0));ray.near=0;ray.far=step*2+.1;h=surfaceHits(THREE,ray,root)[0]?.point.y;}
   if(Number.isFinite(h)&&h<=y+step+.001)best=Math.max(best,h);
  }
  if(!covered&&ctx.objects.some(o=>o.userData.terrainRuntime))return NaN;
  if(!Number.isFinite(best)&&!covered&&ctx.ground){ray.set(point.set(x,y+step,z),new THREE.Vector3(0,-1,0));ray.near=0;ray.far=step*2+.1;best=surfaceHits(THREE,ray,ctx.ground)[0]?.point.y;}
  return Number.isFinite(best)&&Math.abs(best-y)<=step+.001?best:NaN;
 }
 return {sample(position,radius,heightValue,step=.26){
  const [x,y,z]=position,values=[[0,0],[radius,0],[-radius,0],[0,radius],[0,-radius]].map(([dx,dz])=>height(x+dx,z+dz,y,step));if(values.some(v=>!Number.isFinite(v))||Math.max(...values)-Math.min(...values)>Math.max(.26,radius*1.4))return null;
  const floor=Math.max(...values),state={playerHeight:heightValue,isGrounded:false,phaseThroughObjects:false};point.set(x,floor+heightValue+.03,z);
  stats.collisionQueries++;if(createCollisionChecker({colliders:ctx.colliders,movementState:state,playerRadius:radius})(point,{ignoreCollider:self.userData.colliderRef}))return null;
  if(ctx.api?.getWaterVolumeAtPosition?.(point))return null;return floor;
 }};
}
