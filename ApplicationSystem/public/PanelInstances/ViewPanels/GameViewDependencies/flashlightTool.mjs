// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/flashlightTool.mjs
// This controller maintains a transient crosshair-aimed spotlight for a flashlight held in either player hand. Its light is separate from authored world lights and its settings remain on the inventory item while it is unequipped.
import { normalizeFlashlightSettings, openFlashlightSettings } from './flashlightSettings.mjs';
export function createFlashlightTool({THREE,scene,panel,inventory,playerCamera,getCamera,objects = [],movementState,controls}) {
  const light = new THREE.SpotLight();
  light.name = 'Player flashlight'; light.userData.isEditorHelper = true;
  light.distance = 50; light.penumbra = 0.35; light.decay = 2; light.visible = false;
  light.target.name = 'Player flashlight target'; light.target.userData.isEditorHelper = true;
  scene.add(light,light.target);
  const ray = new THREE.Raycaster(), offset = new THREE.Vector3(), rotation = new THREE.Quaternion();
  ray.far = 50;
  let dialog = null, disposed = false;
  const held = () => inventory.getHeldItems().find(entry => entry.item.id === 'flashlight');
  function update() {
    if (disposed) return;
    const entry = held(), camera = getCamera() || playerCamera;
    light.visible = Boolean(entry && camera && movementState.worldMode !== '2d');
    if (!light.visible) { dialog?.close(); return; }
    const settings = normalizeFlashlightSettings(entry.item.flashlightSettings);
    light.color.set(settings.color); light.intensity = settings.intensity;
    light.angle = Math.atan(settings.radius / 10);
    camera.updateWorldMatrix(true,false); playerCamera.updateWorldMatrix(true,false);
    playerCamera.getWorldPosition(light.position); playerCamera.getWorldQuaternion(rotation);
    offset.set(entry.hand === 'off' ? -0.22 : 0.22,-0.18,-0.12).applyQuaternion(rotation);
    light.position.add(offset);
    ray.setFromCamera({x:0,y:0},camera);
    for (const object of objects) object.updateWorldMatrix?.(true,true);
    const hit = ray.intersectObjects(objects,true).find(hit => {
      for (let object = hit.object; object; object = object.parent) if (!object.visible || object.userData?.isEditorHelper) return false;
      return true;
    });
    if (hit) light.target.position.copy(hit.point);
    else ray.ray.at(50,light.target.position);
    light.updateMatrixWorld(); light.target.updateMatrixWorld();
  }
  function openSettings() {
    if (disposed || !held() || movementState.worldMode === '2d') return false;
    if (dialog) { dialog.dialog.focus(); return true; }
    const item = held().item;
    dialog = openFlashlightSettings({panel,movementState,controls,settings:normalizeFlashlightSettings(item.flashlightSettings),
      onChange(settings) { item.flashlightSettings = settings; update(); },onClose() { dialog = null; }});
    return true;
  }
  const unsubscribe = inventory.subscribeSelection(update);
  update();
  return {update,openSettings,light,
    dispose() { if (disposed) return; disposed = true; unsubscribe(); dialog?.close(); light.removeFromParent(); light.target.removeFromParent(); light.dispose(); }
  };
}
