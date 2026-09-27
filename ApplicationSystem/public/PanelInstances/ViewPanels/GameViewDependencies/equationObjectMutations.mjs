// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/equationObjectMutations.mjs
// This module applies equation form changes to meshes and synchronizes their collision references, liquid volumes, appearance, and layer definitions.

import { makePlaneColliderRef, syncPlaneColliderRef, resizeEquationColliderPlaneMesh,
  syncPlaneWaterVolumeRef } from "./equationColliderTool.mjs";
import { applyColor } from "./equationObjectDefaults.mjs";
import { syncEquationLayer } from "./equationObjectLayers.mjs";

// Keep collider and liquid-volume updates in the same object mutation path.
export function createEquationObjectMutations({ THREE, colliders, waterVolumes, fields, form, quick }) {
  const { statusLine } = fields;
  const { readConfig } = form;
  const { prepareQuickInequality, refreshWaterControls } = quick;
  function syncTargetCollider(target, colliderEnabled) {
    const existing = target?.userData?.colliderRef;
    if (!colliderEnabled && existing) {
      const idx = colliders.indexOf(existing);
      if (idx !== -1) colliders.splice(idx, 1);
      delete target.userData.colliderRef;
      return;
    }
    if (colliderEnabled && !existing) {
      const ref = makePlaneColliderRef(THREE, target);
      colliders.push(ref);
      target.userData.colliderRef = ref;
      return;
    }
    if (colliderEnabled && existing) syncPlaneColliderRef(THREE, target);
  }

  function applyToTarget(target) {
    if (!target) return false;
    if (!prepareQuickInequality()) return false;
    const config = readConfig();
    const liquidEnabled = config.isLiquid === true || config.matterState === "liquid";
    resizeEquationColliderPlaneMesh(THREE, target, config);
    target.userData.nvType = config.inequality === true ? "equation-inequality" : "equation-collider-plane";
    target.userData.physicsMaterialId = config.physicsMaterialId;
    target.userData.physicsMaterialFile = config.physicsMaterialFile;
    target.userData.materialName = config.materialName;
    target.userData.MatterState = config.MatterState || "";
    target.userData.matterState = config.matterState || "";
    target.userData.isLiquid = liquidEnabled;
    target.userData.isWater = false;
    delete target.userData.materialType;
    if (liquidEnabled) {
      target.userData.equationLiquidSide = config.liquidSide;
      target.userData.equationLiquidInfinite = config.liquidInfinite !== false;
    } else {
      delete target.userData.equationLiquidSide;
      delete target.userData.equationLiquidInfinite;
    }
    delete target.userData.equationWaterSide;
    delete target.userData.equationWaterInfinite;
    target.userData.equationExpression = config.expression || "";
    target.userData.equationTemporal = config.equationTemporal === true;
    target.userData.equationBaseExpression = config.equationBaseExpression || (config.equationTemporal ? config.expression : "");
    target.userData.equationTimeSeconds = config.timeSeconds || 0;
    target.userData.equationInequalityOperator = config.operator || "";
    target.userData.equationInequalitySide = config.inequalitySide || config.liquidSide;
    target.userData.isSolid = liquidEnabled ? false : config.collider;
    target.userData.physicsEnabled = liquidEnabled ? false : config.collider;
    syncTargetCollider(target, !liquidEnabled && config.collider);
    syncPlaneWaterVolumeRef(THREE, waterVolumes, target, config, {
      liquid: liquidEnabled,
      side: config.liquidSide,
      infinite: config.liquidInfinite,
      buoyancyScale: Number.isFinite(config.buoyancyScale) ? config.buoyancyScale : 1
    });
    applyColor(target, config.color, THREE, { liquid: liquidEnabled, opacity: config.opacity });
    void syncEquationLayer(target, "equationObjectUpdated");
    refreshWaterControls();
    statusLine.textContent = liquidEnabled ? "Liquid inequality volume updated." : (config.inequality ? "Equation inequality volume updated." : "Equation object updated.");
    return true;
  }

  return { applyToTarget };
}
