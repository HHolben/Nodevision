// Nodevision/scripts/voxel-pine-session-browser.mjs
// This fixture verifies shared pine geometry, semantic materials, trunk collision and seed-stable trees in actual Sandbox sessions.
import * as THREE from '/lib/three/three.module.js';
import { createCollisionChecker } from '/PanelInstances/ViewPanels/GameViewDependencies/collisionCheck.mjs';
export async function checkSandboxPines(ctx,root,mode){
  const ok=(v,m)=>{if(!v)throw Error(mode+': '+m);},r=root.userData.proceduralVoxelRuntime;await r.ready;
  const f=r.generator.features.query([0,0,0],[512,200,512])[0];ok(f,'pine distribution exists');
  const [x,y,z]=f.origin,point=new THREE.Vector3(root.position.x+(x+.5)*.25,root.position.y+y*.25+1.75,root.position.z+(z+.5)*.25);
  const oldRadius=r.manager.radius;r.manager.radius=1;r.manager.center='';r.update(point);while(r.stats.queued)r.update(point);
  root.updateMatrixWorld(true);
  const ray=new THREE.Raycaster(new THREE.Vector3(point.x+1,point.y-.5,point.z),new THREE.Vector3(-1,0,0));
  const hit=ray.intersectObject(root,false)[0];ok(hit?.object.material[hit.face.materialIndex].userData.materialId==='PineBark','visible trunk uses canonical bark');
  const foliage=root.children.some(mesh=>mesh.geometry.groups.some(g=>mesh.material[g.materialIndex].userData.materialId==='PineFoliage'));
  ok(foliage,'canopy uses canonical foliage');ok(r.getVoxelMaterialId(x,y,z)==='PineWood','trunk has canonical wood core');
  const state={playerHeight:1.75,isGrounded:true,activeExpressionTerrainColliderId:r.definition.id};
  const collide=createCollisionChecker({colliders:ctx.colliders,movementState:state,playerRadius:.35});
  ok(collide(point),'trunk blocks body');
  for(const dx of [-1.5,1.5])ok(!collide(new THREE.Vector3(point.x+dx,point.y+.5,point.z)),'movement has clearance beside trunk');
  const camera=ctx.camera.clone();camera.position.set(point.x+9,point.y+5,point.z+9);camera.lookAt(point.x,point.y+2,point.z);
  ctx.panel._vrRenderer.render(ctx.scene,camera);ok(ctx.panel._vrRenderer.info.render.triangles>0,'tree scene renders');
  const snapshot=JSON.stringify(r.generator.generateChunk(Math.floor(x/32),Math.floor(y/32),Math.floor(z/32)));
  r.update(new THREE.Vector3(point.x+100,point.y,point.z+100));r.update(point);
  ok(JSON.stringify(r.generator.generateChunk(Math.floor(x/32),Math.floor(y/32),Math.floor(z/32)))===snapshot,'travel preserves tree voxels');
  r.manager.radius=oldRadius;r.manager.center='';r.update(ctx.camera.position);while(r.stats.queued)r.update(ctx.camera.position);
  return f.id+':'+f.origin.join(',')+':'+JSON.stringify(f.parameters);
}
