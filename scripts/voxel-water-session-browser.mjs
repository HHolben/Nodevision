// Nodevision/scripts/voxel-water-session-browser.mjs
// This check exercises canonical water rendering and the live swimming frame in both Sandbox modes while preserving the fixture's original camera state.
import { applyFlyingMovement } from '/PanelInstances/ViewPanels/GameViewDependencies/movementSteps.mjs';
import { createCollisionChecker } from '/PanelInstances/ViewPanels/GameViewDependencies/collisionCheck.mjs';
import * as THREE from '/lib/three/three.module.js';
import { TERRAIN_V1 } from '/MetaWorld/ProceduralVoxelWorld/VoxelTerrainParameters.mjs';
export async function checkSandboxWater(ctx, root, mode) {
  const ok=(value,message)=>{if(!value)throw Error(mode+': '+message);};
  const runtime=root.userData.proceduralVoxelRuntime;await runtime.ready;
  const g=runtime.generator,level=(TERRAIN_V1.waterLevelVoxelY+1)*.25;
  let wet;
  for(let z=64;z<g.dimensions[2]-64&&!wet;z+=64)for(let x=64;x<g.dimensions[0]-64;x+=64){
    if(g.getTerrainHeight(x,z)*.25<level-3){wet=[x,z];break;}
  }
  ok(wet,'deep procedural water exists');
  const saved=ctx.camera.position.clone(),oldFlying=ctx.movementState.isFlying;
  const point=new THREE.Vector3(root.position.x+(wet[0]+.5)*.25,root.position.y+level-1,root.position.z+(wet[1]+.5)*.25);
  ctx.camera.position.copy(point);ctx.camera.position.y+=3;
  ctx.movementState.isFlying=false;ctx.movementState.velocityY=0;
  const wouldCollide=createCollisionChecker({colliders:ctx.colliders,movementState:ctx.movementState,playerRadius:.35});
  for(let i=0;i<30;i++)applyFlyingMovement({THREE,controls:{getObject:()=>ctx.camera},inputState:{flyDown:true},speed:.1,wouldCollide});
  ok(Math.abs(ctx.camera.position.y-point.y)<.001,'existing movement crosses water surface without solid collision');
  runtime.update(point);while(runtime.stats.queued)runtime.update(point);
  ok(root.userData.waterVolumeRef.containsPoint(point),'canonical liquid volume recognizes entry');
  for(let i=0;i<40&&!ctx.movementState.isSwimming;i++)await new Promise(r=>setTimeout(r,25));
  ok(ctx.movementState.isSwimming,'live player movement enters swimming');
  ctx.panel._vrRenderer.render(ctx.scene,ctx.camera);
  const ray=new THREE.Raycaster(new THREE.Vector3(point.x,root.position.y+level+2,point.z),new THREE.Vector3(0,-1,0));
  root.updateMatrixWorld(true);
  const hit=ray.intersectObject(root,false)[0];
  ok(hit?.object.material[hit.face.materialIndex].userData.materialId==='water','rendered surface is canonical water');
  ok(hit.object.material[hit.face.materialIndex].opacity===.48,'canonical transparency');
  ctx.camera.position.y=root.position.y+level+4;ctx.movementState.isFlying=true;
  for(let i=0;i<40&&ctx.movementState.isSwimming;i++)await new Promise(r=>setTimeout(r,25));
  ok(!ctx.movementState.isSwimming,'live player movement exits swimming');
  ctx.camera.position.copy(saved);ctx.movementState.isFlying=oldFlying;ctx.movementState.velocityY=0;
  return [wet[0],g.getTerrainHeight(...wet),wet[1]].join(',');
}
