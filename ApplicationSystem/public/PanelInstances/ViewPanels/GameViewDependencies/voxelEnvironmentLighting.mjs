// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/voxelEnvironmentLighting.mjs
// This module supplies environment illumination for legacy voxel worlds that have neither authored lights nor astronomy. Its transient lights follow the environment brightness and are removed when another world supplies its own illumination.
export function createVoxelEnvironmentLighting(THREE, scene) {
  let root = null;
  function clear() {
    if (!root) return;
    for (const light of root.children) light.dispose?.();
    root.removeFromParent();
    root = null;
  }
  return {
    update(context) {
      if (context?.scene !== scene) { clear(); return; }
      const world = context.currentWorldDefinition ?? context.state?.currentWorldDefinition;
      const astronomy = world?.metadata?.astronomy;
      const hasAstronomy = context.astronomy || (astronomy?.model === 'earth' && astronomy.enabled !== false);
      let hasTerrain = false, hasAuthoredLight = false;
      scene.traverse(object => {
        if (object.userData?.proceduralVoxelRuntime) hasTerrain = true;
        if (object.isLight && object.parent !== root &&
            (context.lights?.includes(object) || object.userData?.metaWorldLayerId)) hasAuthoredLight = true;
      });
      if (!hasTerrain || hasAstronomy || hasAuthoredLight) { clear(); return; }
      if (!root) {
        root = new THREE.Group();
        root.name = 'Voxel environment lighting';
        root.userData.runtimeGenerated = true;
        const fill = new THREE.HemisphereLight('#ffffff', '#b4bec8', 1.8);
        const sun = new THREE.DirectionalLight('#ffffff', 2.2);
        sun.position.set(5, 8, 4);
        for (const light of [fill, sun]) {
          light.userData.runtimeGenerated = true;
          light.userData.nvDayNightBaseIntensity = light.intensity;
          root.add(light);
        }
        scene.add(root);
      }
      const value = context.environmentBrightness ?? context.movementState?.environmentBrightness;
      const brightness = Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 1;
      for (const light of root.children) light.intensity = light.userData.nvDayNightBaseIntensity * brightness;
    },
    dispose: clear
  };
}
