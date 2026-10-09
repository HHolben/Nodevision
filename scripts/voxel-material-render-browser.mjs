// Nodevision/scripts/voxel-material-render-browser.mjs
// This browser check exposes a finite V1 terrain edge and verifies raycast material identities and shared Three.js resources for mixed canonical materials.
import { createProceduralVoxelWorld } from '/MetaWorld/ProceduralVoxelWorld/ProceduralVoxelWorldRuntime.mjs';
export async function checkVoxelMaterialRendering(THREE, renderer) {
  const ok=(value,message)=>{if(!value)throw Error(message);};
  const definition={id:'material-cutaway',type:'procedural-voxel-world',position:[0,0,0],size:[8,32,8],voxelSize:.25,
    generator:{id:'nodevision-terrain-v1',version:1,seed:123456},chunks:{voxelsPerAxis:32,loadRadius:1}};
  const root=createProceduralVoxelWorld(THREE,definition,[]),runtime=root.userData.proceduralVoxelRuntime;
  ok(await runtime.ready,'cutaway canonical materials ready');runtime.update({x:4,y:20,z:4});while(runtime.stats.queued)runtime.update({x:4,y:20,z:4});
  const scene=new THREE.Scene();scene.add(root,new THREE.AmbientLight(0xffffff,2));
  const camera=new THREE.PerspectiveCamera(60,1.5,.1,100);camera.position.set(-14,20,18);camera.lookAt(4,10,4);
  renderer.render(scene,camera);ok(renderer.info.render.calls<=root.children.length*36,'at most thirty-six draws per mixed chunk');
  const ray=new THREE.Raycaster();
  for(const [y,id] of [[.125,'stone'],[8.125,'limestone'],[18.625,'soil'],[18.875,'grass']]){
    ray.set(new THREE.Vector3(-1,y,.125),new THREE.Vector3(1,0,0));
    const hit=ray.intersectObject(root,false)[0];ok(hit,'cutaway ray hits '+id);
    ok(hit.object.material[hit.face.materialIndex].userData.materialId===id,'rendered face resolves '+id);
  }
  const materials=new Set(root.children.flatMap(mesh=>mesh.material));ok(materials.size===36,'thirty-six pooled materials for entire terrain');
  let releases=0;for(const material of materials)material.addEventListener('dispose',()=>releases++);
  runtime.dispose();ok(releases===36,'pooled resources released once');
}
