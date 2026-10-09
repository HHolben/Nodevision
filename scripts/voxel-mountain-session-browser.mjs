// Nodevision/scripts/voxel-mountain-session-browser.mjs
// This fixture verifies canonical mountain snow and three procedural species through real chunk rendering and deterministic session reload.
import * as THREE from '/lib/three/three.module.js';
export function checkMountainLandscape(ctx,root,mode){
  const ok=(v,m)=>{if(!v)throw Error(mode+': '+m);},r=root.userData.proceduralVoxelRuntime,oldRadius=r.manager.radius,signature=[];r.manager.radius=1;
  const cells=[[1632,400,2816,'snow'],[71,76,69,'MapleWood'],[123,78,267,'OakWood'],[1415,84,75,'PineWood'],[697,79,21,'MagnoliaWood'],[1484,83,52,'water'],[3876,115,116,'water'],[3882,120,116,'water'],[3002,73,332,'water']];
  for(const [x,y,z,id] of cells){
    const point=new THREE.Vector3(root.position.x+(x+.5)*.25,root.position.y+y*.25,root.position.z+(z+.5)*.25);
    r.manager.center='';r.update(point);while(r.stats.queued)r.update(point);
    ok(r.getVoxelMaterialId(x,y,z)===id,'final '+id+' identity');
    const visible=id.replace('Wood','Foliage');
    ok(root.children.some(m=>m.geometry.groups.some(g=>m.material[g.materialIndex].userData.materialId===visible)),'rendered '+visible);
    const camera=ctx.camera.clone();camera.position.copy(point).add(new THREE.Vector3(14,12,14));camera.lookAt(point);
    ctx.panel._vrRenderer.render(ctx.scene,camera);ok(ctx.panel._vrRenderer.info.render.triangles>0,'landscape draws');
    signature.push([id,r.generator.getTerrainHeight(x,z),r.getBiome(x,z)]);
  }
  // Stand inside a connected cavern and draw the streamed underground surfaces.
  const cave=r.generator.getCavern(156,1280),feet=root.position.y+cave.floor*.25;
  const point=new THREE.Vector3(root.position.x+156.5*.25,feet+1.75,root.position.z+1280.5*.25);
  r.manager.center='';r.update(point);while(r.stats.queued)r.update(point);
  const collider=root.userData.colliderRef;
  ok(collider.sampleGroundY(point.x,point.z,feet+.6)===feet,'cavern ground stays underground');
  ok(!collider.intersectsPlayer(point,.2,feet,point.y),'passage fits player');
  ok(root.children.some(m=>m.geometry.groups.some(g=>m.material[g.materialIndex].userData.materialId==='limestone')),'cavern formations meshed');
  const camera=ctx.camera.clone();camera.position.copy(point);camera.lookAt(point.clone().add(new THREE.Vector3(-3,1,3)));
  ctx.panel._vrRenderer.render(ctx.scene,camera);ok(ctx.panel._vrRenderer.info.render.triangles>0,'underground geometry draws');
  signature.push(['cavern',cave.floor,cave.ceiling]);
  r.manager.radius=oldRadius;r.manager.center='';r.update(ctx.camera.position);while(r.stats.queued)r.update(ctx.camera.position);
  return JSON.stringify(signature);
}
