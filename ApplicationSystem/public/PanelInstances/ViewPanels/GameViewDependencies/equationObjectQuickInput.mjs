// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/GameViewDependencies/equationObjectQuickInput.mjs
// This module parses the equation text field and synchronizes coefficient, bound, and liquid controls without mutating world objects.

import { parseAxisInequality, parseNumber, isLiquidMaterialEntry } from "./equationObjectDefaults.mjs";

// Text parsing and control availability are shared by insertion and modification.
export function createEquationQuickInput(fields, materials, getActiveTarget) {
  const {
    equationLine, quickInequalityInput, aInput, bInput, cInput,
    dInput, xminInput, xmaxInput, yminInput, ymaxInput,
    zminInput, zmaxInput, boundXInput, boundYInput, boundZInput,
    colliderInput, waterSideSelect, statusLine,
  } = fields;
  const { getSelectedMaterialEntry, setMaterialSelection } = materials;
  function updateEquationLine() {
    const expression = String(quickInequalityInput.value || "").trim();
    if (expression) {
      equationLine.textContent = expression;
      return;
    }
    equationLine.textContent = (aInput.value || 0) + "x + " + (bInput.value || 0) + "y + " + (cInput.value || 0) + "z + " + (dInput.value || 0) + " = 0";
  }

  function refreshBoundControls() {
    xminInput.disabled = boundXInput.checked !== true;
    xmaxInput.disabled = boundXInput.checked !== true;
    yminInput.disabled = boundYInput.checked !== true;
    ymaxInput.disabled = boundYInput.checked !== true;
    zminInput.disabled = boundZInput.checked !== true;
    zmaxInput.disabled = boundZInput.checked !== true;
  }

  function refreshWaterControls() {
    const liquidEnabled = isLiquidMaterialEntry(getSelectedMaterialEntry());
    const inequalityEnabled = parseAxisInequality(quickInequalityInput.value)?.inequality === true
      || String(getActiveTarget()?.userData?.nvType || "").toLowerCase() === "equation-inequality";
    colliderInput.disabled = liquidEnabled || inequalityEnabled;
    waterSideSelect.disabled = !liquidEnabled && !inequalityEnabled;
    if (liquidEnabled || inequalityEnabled) colliderInput.checked = false;
    refreshBoundControls();
  }

  function applyQuickInequality(options = {}) {
    const text = String(quickInequalityInput.value || "").trim();
    if (!text) return true;
    const parsed = parseAxisInequality(text);
    if (!parsed) return false;
    aInput.value = String(parsed.a);
    bInput.value = String(parsed.b);
    cInput.value = String(parsed.c);
    dInput.value = String(parsed.d);
    waterSideSelect.value = parsed.liquidSide || parsed.waterSide;
    const boundInputs = {
      x: [xminInput, xmaxInput],
      y: [yminInput, ymaxInput],
      z: [zminInput, zmaxInput]
    }[parsed.axis];
    if (boundInputs) {
      const currentMin = parseNumber(boundInputs[0].value, parsed.limit - 30);
      const currentMax = parseNumber(boundInputs[1].value, parsed.limit + 30);
      const span = Math.max(1, Math.abs(currentMax - currentMin) || 30);
      if (parsed.operator.startsWith("<")) {
        boundInputs[0].value = String(parsed.limit - span);
        boundInputs[1].value = String(parsed.limit);
      } else {
        boundInputs[0].value = String(parsed.limit);
        boundInputs[1].value = String(parsed.limit + span);
      }
    }
    if (options.markLiquid === true) {
      const liquidEntry = materials.catalog.find(isLiquidMaterialEntry);
      if (liquidEntry) setMaterialSelection(liquidEntry);
      materials.liquidInfinite = true;
    }
    updateEquationLine();
    refreshWaterControls();
    return true;
  }

  function prepareQuickInequality() {
    if (applyQuickInequality()) return true;
    statusLine.textContent = "Use declarations followed by an axis equation or inequality, like Num = 5, a = (2, 5, 7), z < Num + a.z.";
    return false;
  }

  return { updateEquationLine, refreshBoundControls, refreshWaterControls, prepareQuickInequality };
}
