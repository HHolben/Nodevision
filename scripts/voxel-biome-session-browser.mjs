// Nodevision/scripts/voxel-biome-session-browser.mjs
// This fixture checks canonical shoreline and snow faces plus nearby snowy pines in real Sandbox worlds across save and session reload.
import * as THREE from '/lib/three/three.module.js';
export async function checkSandboxBiomes(ctx,root,mode){
  const ok=(v,m)=>{if(!v)throw Error(mode+': '+m);},r=root.userData.proceduralVoxelRuntime;await r.ready;
  const radius=r.manager.radius;r.manager.radius=1;const signature=[];
  for(const [x,y,z,id] of [[32,71,0,'LimestoneGravel'],[96,67,0,'sand'],[1280,73,0,'mud'],[2224,75,0,'snow']]){
    const point=new THREE.Vector3(root.position.x+(x+.5)*.25,root.position.y+(y+1)*.25,root.position.z+(z+.5)*.25);
    r.manager.center='';r.update(point);while(r.stats.queued)r.update(point);root.updateMatrixWorld(true);
    const ray=new THREE.Raycaster(new THREE.Vector3(point.x,point.y+25,point.z),new THREE.Vector3(0,-1,0));
    const hit=ray.intersectObject(root,false).find(h=>h.object.material[h.face.materialIndex].userData.materialId===id);
    ok(hit,'raycast rendered canonical '+id);ok(r.getVoxelMaterialId(x,y,z)===id,'query identity '+id);
    signature.push([id,r.getBiome(x,z),hit.point.y]);
  }
  const tree=r.generator.features.query([2200,0,16],[2456,160,272]).find(f=>r.getBiome(f.origin[0],f.origin[2])==='snowy-pine-forest');
  ok(tree,'snowy pines exist');const [x,y,z]=tree.origin;
  ok(r.getVoxelMaterialId(x,y-1,z)==='snow','pine stands on canonical snow');
  const focus=new THREE.Vector3(root.position.x+x*.25,root.position.y+y*.25,root.position.z+z*.25);
  r.manager.center='';r.update(focus);while(r.stats.queued)r.update(focus);
  ok(root.children.some(m=>m.geometry.groups.some(g=>m.material[g.materialIndex].userData.materialId==='PineFoliage')),'snowy canopy is meshed');
  const camera=ctx.camera.clone();camera.position.copy(focus).add(new THREE.Vector3(12,9,12));camera.lookAt(focus);
  ctx.panel._vrRenderer.render(ctx.scene,camera);ok(ctx.panel._vrRenderer.info.render.triangles>0,'snowy forest draws');
  signature.push(tree.id,tree.origin);
  r.manager.radius=radius;r.manager.center='';r.update(ctx.camera.position);while(r.stats.queued)r.update(ctx.camera.position);
  return JSON.stringify(signature);
}
