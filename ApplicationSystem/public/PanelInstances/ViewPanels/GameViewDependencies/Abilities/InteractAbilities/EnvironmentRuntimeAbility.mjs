// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/Abilities/InteractAbilities/EnvironmentRuntimeAbility.mjs
// This file defines small environment runtime helpers for Game View movement. It resolves water volumes and updates sound-object runtimes from the listener position.

import { installMovementApi } from "../movementContext.mjs";

export function installEnvironmentRuntimeAbility(ctx) {
  const { objects, waterVolumes } = ctx;

  function updateSoundObjectRuntimes(listenerPosition) {
    if (!Array.isArray(objects)) return;
    objects.forEach((object) => {
      object?.userData?.updateSoundObjectRuntime?.(listenerPosition);
    });
  }

  function getWaterVolumeAtPosition(position) {
    for (const water of waterVolumes || []) {
      if (typeof water?.containsPoint === "function" && water.containsPoint(position)) return water;
      if (water?.box && typeof water.box.containsPoint === "function" && water.box.containsPoint(position)) return water;
    }
    // Procedural worlds expose one analytic volume, independent of chunk residency.
    for (const object of objects || []) {
      const volume = object?.userData?.waterVolumeRef;
      if (typeof volume?.sampleAt === "function") { const liquid=volume.sampleAt(position); if(liquid)return liquid; continue; }
      if (typeof volume?.containsPoint === "function" && volume.containsPoint(position)) return volume;
    }
    return null;
  }

  return installMovementApi(ctx, {
    updateSoundObjectRuntimes,
    getWaterVolumeAtPosition
  });
}
