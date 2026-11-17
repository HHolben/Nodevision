import {terrainPointCovered} from '../ProceduralVoxelWorld/TerrainCoverage.mjs';
import {createCollisionChecker} from '../../PanelInstances/ViewPanels/GameViewDependencies/collisionCheck.mjs';
import {surfaceHits} from '../../PanelInstances/ViewPanels/GameViewDependencies/RaycastingTeleporter/Target.mjs';
// Local, bounded support and clearance checks. No map preparation or distant terrain generation.
function buildGround(ctx,self,stats){
 const {THREE}=ctx,ray=new THREE.Raycaster(),point=new THREE.Vector3(),bodyBounds=new THREE.Box3(),nearby=[];let failure='';
 function height(x,z,y,step){stats.groundQueries++;let best=-Infinity,covered=false;
  for(const c of ctx.colliders){const root=c.target||c.object3d;if(root===self||root?.userData.mobRuntime||root?.visible===false)continue;const terrain=root?.userData.terrainRuntime;
   if(terrain){const d=terrain.definition,inf=terrain.generator.dimensions.infinite;if(!inf&&(x<root.position.x||z<root.position.z||x>=root.position.x+d.size[0]||z>=root.position.z+d.size[2]))continue;covered=true;if(!terrainPointCovered(terrain,x,z)||!terrain.mapSampleReady([x,y,z])){failure='Source coverage or readiness';return NaN;}}
   // Existing world boxes are authoritative broad-phase bounds; avoid raycasting unrelated objects.
   if(c.box&&(x<c.box.min.x||x>c.box.max.x||z<c.box.min.z||z>c.box.max.z||c.box.min.y>y+step||c.box.max.y<y-step))continue;
   let h;if(!root&&c.type==='box'&&c.box)h=c.box.max.y;else if(c.sampleGroundY)h=c.sampleGroundY(x,z,y+step);else if(root){ray.set(point.set(x,y+step,z),new THREE.Vector3(0,-1,0));ray.near=0;ray.far=step*2+.1;h=surfaceHits(THREE,ray,root)[0]?.point.y;}
   if(Number.isFinite(h)&&h<=y+step+.001)best=Math.max(best,h);
  }
  if(!covered&&ctx.objects.some(o=>o.userData.terrainRuntime)){failure='Source coverage or readiness';return NaN;}
  if(!Number.isFinite(best)&&!covered&&ctx.ground){ray.set(point.set(x,y+step,z),new THREE.Vector3(0,-1,0));ray.near=0;ray.far=step*2+.1;best=surfaceHits(THREE,ray,ctx.ground)[0]?.point.y;}
  return Number.isFinite(best)&&Math.abs(best-y)<=step+.001?best:NaN;
 }
 return {get lastFailure(){return failure;},
 // Sweep feet downward through this fixed step, never snap to surfaces above the feet.
 fall(position,nextY,radius){failure='';const [x,y,z]=position,top=y+.002,bottom=nextY-.002,mid=(top+bottom)/2,reach=(top-bottom)/2;
  const values=[[0,0],[radius,0],[-radius,0],[0,radius],[0,-radius]].map(([dx,dz])=>height(x+dx,z+dz,mid,reach));
  if(failure==='Source coverage or readiness')return {ready:false};
  const floors=values.filter(Number.isFinite);return {ready:true,floor:floors.length?Math.max(...floors):null};
 },sample(position,radius,heightValue,step=.26){failure='';
  const [x,y,z]=position,values=[[0,0],[radius,0],[-radius,0],[0,radius],[0,-radius]].map(([dx,dz])=>height(x+dx,z+dz,y,step));if(values.some(v=>!Number.isFinite(v))||Math.max(...values)-Math.min(...values)>Math.max(.26,radius*1.4)){failure||='Missing footprint support, slope or step limit';return null;}
  const floor=Math.max(...values),state={playerHeight:heightValue,isGrounded:false,phaseThroughObjects:false};point.set(x,floor+heightValue+.03,z);
  bodyBounds.min.set(x-radius,floor+.03,z-radius);bodyBounds.max.set(x+radius,floor+.03+heightValue,z+radius);nearby.length=0;for(const c of ctx.colliders)if(!c.box||bodyBounds.intersectsBox(c.box))nearby.push(c);
  stats.collisionQueries++;if(createCollisionChecker({colliders:nearby,movementState:state,playerRadius:radius})(point,{ignoreCollider:self.userData.colliderRef})){failure='Body clearance';return null;}
  if(ctx.api?.getWaterVolumeAtPosition?.(point)){failure='Water clearance';return null;}return floor;
 }};
}

export function createGround(ctx,self,stats){
 const queries=buildGround(ctx,self,stats);stats.groundAndClearanceMs??=0;
 for(const key of ['fall','sample']){const query=queries[key];queries[key]=(...args)=>{const start=performance.now();try{return query(...args);}finally{stats.groundAndClearanceMs+=performance.now()-start;}};}
 return queries;
}
