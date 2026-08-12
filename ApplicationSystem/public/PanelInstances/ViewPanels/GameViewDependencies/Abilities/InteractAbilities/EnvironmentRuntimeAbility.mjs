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
    if (!Array.isArray(waterVolumes) || waterVolumes.length === 0) return null;
    for (const water of waterVolumes) {
      if (typeof water?.containsPoint === "function" && water.containsPoint(position)) return water;
      if (water?.box && typeof water.box.containsPoint === "function" && water.box.containsPoint(position)) return water;
    }
    return null;
  }

  return installMovementApi(ctx, {
    updateSoundObjectRuntimes,
    getWaterVolumeAtPosition
  });
}
