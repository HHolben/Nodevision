// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/equationObjectFormConfig.mjs
// This module reads equation form values into world-object configurations and populates those controls from existing meshes, including temporal equations and liquid metadata.

import { DEFAULT_WORLD_OBJECT_MATERIAL_ID, readWorldObjectMatterState,
  readWorldObjectPhysicsMaterialId, materialFileForWorldObjectMaterial } from "/MetaWorld/Materials/WorldObjectMaterialDefaults.mjs";
import { normalizePlaneEquationConfig, expressionUsesTimeVariable, isEquationInequalityConfig } from "./equationColliderTool.mjs";
import { DEFAULT_PLANE, parseAxisInequality, parseNumber, clampOpacity, materialOptionValue,
  firstColorHex, firstMaterialOpacity, alphaPercentFromOpacity, syncAlphaControl } from "./equationObjectDefaults.mjs";

// Configuration conversion preserves the ordinary equation-object save format.
export function createEquationFormConfig(fields, materials, quick) {
  const {
    quickInequalityInput, aInput, bInput, cInput, dInput,
    xminInput, xmaxInput, yminInput, ymaxInput, zminInput,
    zmaxInput, depthInput, colorInput, alphaInput, alphaValue,
    boundXInput, boundYInput, boundZInput, colliderInput, waterSideSelect,
    modeLine,
  } = fields;
  const { getSelectedMaterialEntry, setMaterialSelection } = materials;
  const { refreshWaterControls, updateEquationLine } = quick;
  function normalizePanelWaterSide(value) {
    return String(value || "negative").toLowerCase() === "positive" ? "positive" : "negative";
  }


  function readConfig() {
    const expression = String(quickInequalityInput.value || "").trim();
    const parsed = parseAxisInequality(expression);
    const temporal = parsed?.equationTemporal === true || expressionUsesTimeVariable(expression);
    const timeSeconds = window.VRWorldContext?.temporalController?.getTimeSeconds?.() ?? 0;
    const selectedMaterial = getSelectedMaterialEntry();
    const matterState = readWorldObjectMatterState(selectedMaterial);
    const liquid = matterState === "liquid";
    const materialId = selectedMaterial?.materialId || readWorldObjectPhysicsMaterialId(selectedMaterial, DEFAULT_WORLD_OBJECT_MATERIAL_ID);
    const materialFile = materialOptionValue(selectedMaterial) || materialFileForWorldObjectMaterial(materialId);
    const inequality = parsed?.inequality === true || liquid;
    const operator = parsed?.inequality === true ? parsed.operator : (inequality ? (normalizePanelWaterSide(waterSideSelect.value) === "positive" ? ">=" : "<=") : "");
    const inequalitySide = parsed?.inequalitySide || normalizePanelWaterSide(waterSideSelect.value);
    const current = normalizePlaneEquationConfig({
      a: parseNumber(aInput.value, DEFAULT_PLANE.a),
      b: parseNumber(bInput.value, DEFAULT_PLANE.b),
      c: parseNumber(cInput.value, DEFAULT_PLANE.c),
      d: parseNumber(dInput.value, DEFAULT_PLANE.d),
      xmin: parseNumber(xminInput.value, DEFAULT_PLANE.xmin),
      xmax: parseNumber(xmaxInput.value, DEFAULT_PLANE.xmax),
      ymin: parseNumber(yminInput.value, DEFAULT_PLANE.ymin),
      ymax: parseNumber(ymaxInput.value, DEFAULT_PLANE.ymax),
      zmin: parseNumber(zminInput.value, DEFAULT_PLANE.zmin),
      zmax: parseNumber(zmaxInput.value, DEFAULT_PLANE.zmax),
      thickness: parseNumber(depthInput.value, DEFAULT_PLANE.thickness),
      boundX: boundXInput.checked === true,
      boundY: boundYInput.checked === true,
      boundZ: boundZInput.checked === true,
      inequality,
      operator,
      inequalitySide,
      expression,
      equationTemporal: temporal,
      equationBaseExpression: temporal ? expression : "",
      timeSeconds
    });
    return {
      ...current,
      collider: liquid || inequality ? false : colliderInput.checked === true,
      color: colorInput.value || DEFAULT_PLANE.color,
      opacity: clampOpacity(Number(alphaInput.value) / 100, liquid ? 0.48 : DEFAULT_PLANE.opacity),
      inequality,
      operator,
      inequalitySide,
      expression,
      equationExpression: expression,
      equationTemporal: temporal,
      equationBaseExpression: temporal ? expression : "",
      timeSeconds,
      physicsMaterialId: materialId,
      physicsMaterialFile: materialFile,
      materialName: selectedMaterial?.materialName || selectedMaterial?.displayName || materialId,
      MatterState: matterState || undefined,
      matterState,
      isLiquid: liquid,
      ...(liquid ? {
        liquid: true,
        liquidSide: inequalitySide,
        liquidInfinite: materials.liquidInfinite !== false,
        equationLiquidSide: inequalitySide,
        equationLiquidInfinite: materials.liquidInfinite !== false,
      } : {})
    };
  }

  function setConfig(config = {}, target = null) {
    const normalized = normalizePlaneEquationConfig(config);
    const targetData = target?.userData || {};
    const targetType = String(targetData.nvType || "").toLowerCase();
    const inequalityEnabled = target
      ? targetType === "equation-inequality" || normalized.inequality === true
      : (normalized.inequality === true || isEquationInequalityConfig(config));
    const expressionText = target
      ? (targetData.equationExpression || normalized.expression || config.expression || config.equationExpression || "")
      : (config.expression || config.equationExpression || "");
    const legacyLiquid = targetData.isWater === true || config.isWater === true || config.water === true;
    const matterState = readWorldObjectMatterState(targetData, readWorldObjectMatterState(config, legacyLiquid ? "liquid" : ""));
    const liquidEnabled = matterState === "liquid" || targetData.isLiquid === true || config.isLiquid === true || config.liquid === true;
    const materialId = readWorldObjectPhysicsMaterialId(targetData, readWorldObjectPhysicsMaterialId(config, legacyLiquid ? "water" : DEFAULT_WORLD_OBJECT_MATERIAL_ID));
    const materialFile = targetData.physicsMaterialFile || config.physicsMaterialFile || materialFileForWorldObjectMaterial(materialId);
    setMaterialSelection({ materialFile, materialId, matterState });
    materials.liquidInfinite = liquidEnabled
      ? (target
        ? (targetData.equationLiquidInfinite !== false && targetData.equationWaterInfinite !== false)
        : (config.liquidInfinite !== false && config.equationLiquidInfinite !== false && config.waterInfinite !== false && config.equationWaterInfinite !== false))
      : true;
    aInput.value = String(normalized.a);
    bInput.value = String(normalized.b);
    cInput.value = String(normalized.c);
    dInput.value = String(normalized.d);
    xminInput.value = String(normalized.xmin);
    xmaxInput.value = String(normalized.xmax);
    yminInput.value = String(normalized.ymin);
    ymaxInput.value = String(normalized.ymax);
    zminInput.value = String(normalized.zmin);
    zmaxInput.value = String(normalized.zmax);
    boundXInput.checked = normalized.boundX === true;
    boundYInput.checked = normalized.boundY === true;
    boundZInput.checked = normalized.boundZ === true;
    depthInput.value = String(normalized.thickness);
    quickInequalityInput.value = String(expressionText || "");
    waterSideSelect.value = normalizePanelWaterSide(targetData.equationLiquidSide || targetData.equationWaterSide || targetData.equationInequalitySide || config.liquidSide || config.equationLiquidSide || config.waterSide || config.equationWaterSide || normalized.inequalitySide);
    colliderInput.checked = liquidEnabled || inequalityEnabled ? false : (target ? Boolean(targetData.colliderRef) : config.collider !== false);
    colorInput.value = target ? firstColorHex(target) : (config.color || DEFAULT_PLANE.color);
    alphaInput.value = String(alphaPercentFromOpacity(target ? firstMaterialOpacity(target, liquidEnabled ? 0.48 : DEFAULT_PLANE.opacity) : config.opacity, liquidEnabled ? 0.48 : DEFAULT_PLANE.opacity));
    syncAlphaControl(alphaInput, alphaValue);
    modeLine.textContent = target ? (inequalityEnabled ? "Editing selected inequality" : "Editing selected plane") : "New equation object";
    refreshWaterControls();
    updateEquationLine();
  }

  return { readConfig, setConfig };
}
