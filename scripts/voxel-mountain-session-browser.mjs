// Nodevision/scripts/voxel-mountain-session-browser.mjs
// This fixture verifies canonical mountain snow and three procedural species through real chunk rendering and deterministic session reload.
import * as THREE from '/lib/three/three.module.js';
export function checkMountainLandscape(ctx,root,mode){
  const ok=(v,m)=>{if(!v)throw Error(mode+': '+m);},r=root.userData.proceduralVoxelRuntime,oldRadius=r.manager.radius,signature=[];r.manager.radius=1;
  const cells=[[1632,400,2816,'snow'],[71,76,69,'MapleWood'],[123,78,267,'OakWood'],[1415,84,75,'PineWood'],[697,79,21,'MagnoliaWood'],[570,99,6,'SunflowerStem'],[1484,83,52,'water'],[3876,115,116,'water'],[3882,120,116,'water'],[3002,73,332,'water']];
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
  r.manager.radius=oldRadius;r.manager.center='';r.update(ctx.camera.position);while(r.stats.queued)r.update(ctx.camera.position);
  return JSON.stringify(signature);
}
