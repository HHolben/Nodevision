// Nodevision/ApplicationSystem/public/MetaWorld/DownloadedImagePlane.mjs
// Adds downloaded images through the existing world layer history, image-plane loader and saveable definitions.
import { applyImagePlaneTexture } from '/PanelInstances/ViewPanels/GameViewDependencies/imagePlaneLoader.mjs';
export function createDownloadedImagePlane(THREE, def, load = true) {
  const size = def.size || [2, 2];
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size[0], size[1]), new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, side: THREE.DoubleSide }));
  mesh.userData.imageFilePath = def.imageFile;
  mesh.userData.assetProvenance = def.assetProvenance;
  if (load) void applyImagePlaneTexture(mesh, THREE);
  return mesh;
}
export function installDownloadedImageCommand({ bridge, THREE, scene, objects, layerEntries, changed }) {
  bridge.insertDownloadedImage = async ({ validate = () => true, ...input }) => {
    const def = { ...input, id: `asset-${crypto.randomUUID()}`, type: 'image-plane', size: [2, 2], isSolid: false, collider: false, collidable: false, preserveLocalTransform: true };
    const mesh = createDownloadedImagePlane(THREE, def, false);
    const texture = await applyImagePlaneTexture(mesh, THREE);
    if (!texture || !validate()) { mesh.geometry.dispose(); mesh.material.dispose(); texture?.dispose(); throw new Error('Image could not be loaded or the originating world changed.'); }
    bridge.recordHistory();
    mesh.position.fromArray(def.position || [0, 1, -2]);
    Object.assign(mesh.userData, { nvType: def.type, metaWorldLayerId: def.id, tag: def.id, placedByPlayer: true, preserveLocalTransform: true });
    bridge.worldData.objects.push(def); layerEntries.push({ id: def.id, def, object3d: mesh }); scene.add(mesh); objects.push(mesh);
    changed(def.id); return def;
  };
}
