// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/Abilities/InspectionModificationAbilities/SvgCameraAbility.mjs
// This file defines the SVG Camera selected-item ability for Game View. It captures the current world view through the existing renderer without mixing export behavior into movement controls.

import { triggerSvgCameraCapture } from "../../svgCameraTool.mjs";
import { installMovementApi } from "../movementContext.mjs";

export function installSvgCameraAbility(ctx) {
  const { scene, camera, movementState } = ctx;

  function useSvgCamera() {
    if (movementState.svgToolLatch) return true;
    movementState.svgToolLatch = true;
    if (movementState.svgCameraBusy) return true;
    const worldContext = window.VRWorldContext || {};
    movementState.svgCameraBusy = true;
    triggerSvgCameraCapture({
      scene,
      camera,
      sourceRenderer: worldContext.renderer,
      worldPath: worldContext.currentWorldPath || window.selectedFilePath || ""
    }).catch((err) => {
      if (err?.name === "AbortError") return;
      console.warn("SVG Camera export failed:", err);
    }).finally(() => {
      movementState.svgCameraBusy = false;
    });
    return true;
  }

  ctx.api.registerSelectedItemAction("svg-camera", { use: useSvgCamera });
  return installMovementApi(ctx, { useSvgCamera });
}
