// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/playerAvatarVisual.mjs
// This module owns a foot-origin avatar normalized to the current physical player height, including fallback feet and safe asynchronous custom-model disposal.
export const STANDING_AVATAR_HEIGHT=1.75;
function release(root){
  const geometries=new Set(),materials=new Set();
  root.traverse(node=>{if(node.geometry)geometries.add(node.geometry);for(const m of [node.material].flat().filter(Boolean))materials.add(m);});
  geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
  root.removeFromParent();
}
export function normalizeAvatar(THREE,model){
  model.updateMatrixWorld(true);
  let box=new THREE.Box3().setFromObject(model),height=box.max.y-box.min.y;
  if(!Number.isFinite(height)||height<=0)throw Error('Avatar has no finite visible height');
  model.scale.multiplyScalar(STANDING_AVATAR_HEIGHT/height);model.updateMatrixWorld(true);
  box=new THREE.Box3().setFromObject(model);
  model.position.sub(new THREE.Vector3((box.min.x+box.max.x)/2,box.min.y,(box.min.z+box.max.z)/2));
  model.updateMatrixWorld(true);return model;
}
export function createFallbackAvatar(THREE){
  const group=new THREE.Group(),cloth=new THREE.MeshStandardMaterial({color:0x2e6da4}),skin=new THREE.MeshStandardMaterial({color:0xf0c8a0});
  function part(geometry,material,x,y,z=0){const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);group.add(mesh);}
  part(new THREE.CapsuleGeometry(.25,.55,6,10),cloth,0,1.02);
  part(new THREE.SphereGeometry(.22,20,20),skin,0,1.53);
  for(const x of [-.13,.13]){part(new THREE.BoxGeometry(.18,.58,.2),cloth,x,.36);part(new THREE.BoxGeometry(.2,.12,.34),cloth,x,.06,.06);}
  return normalizeAvatar(THREE,group);
}
export function createPlayerAvatarVisual(THREE,scene){
  const root=new THREE.Group();root.userData.isPlayerAvatar=true;root.visible=false;scene.add(root);
  let model=createFallbackAvatar(THREE),disposed=false;root.add(model);
  import('/lib/three/examples/jsm/loaders/GLTFLoader.js').then(({GLTFLoader})=>{
    if(disposed)return;
    new GLTFLoader().load('/UserSettings/PlayerAvatar.glTF',gltf=>{
      if(!gltf?.scene)return;if(disposed){release(gltf.scene);return;}
      try{const next=normalizeAvatar(THREE,gltf.scene);release(model);model=next;root.add(model);}
      catch(error){release(gltf.scene);console.warn('Invalid player avatar; using fallback.',error);}
    },undefined,()=>{});
  }).catch(()=>{});
  return {root,update(player,height,heading){root.position.set(player.position.x,player.position.y-height,player.position.z);root.scale.y=height/STANDING_AVATAR_HEIGHT;root.rotation.y=heading;},
    dispose(){disposed=true;release(root);} };
}
