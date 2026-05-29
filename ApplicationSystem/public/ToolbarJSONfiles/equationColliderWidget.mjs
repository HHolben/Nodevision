// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/equationColliderWidget.mjs
// This widget renders Insert > Equation Object controls for MetaWorld editing. The button creates expression layers through the shared MetaWorld layer bridge.

import { setStatus } from "/StatusBar.mjs";
import { addMetaWorldExpressionLayer, getActiveMetaWorldLayerBridge } from "/MetaWorld/MetaWorldLayerState.mjs";

function makeButton(label, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    onClick?.();
  });
  return button;
}

function makePresetButton(label, expression, type, name) {
  return makeButton(label, () => {
    const layer = addMetaWorldExpressionLayer({ expression, type, name });
    setStatus(layer ? `${name} added to MetaWorld layers.` : "Open a MetaWorld editor before adding expression layers.");
  });
}

export function initToolbarWidget(hostElement) {
  if (!hostElement) return;
  hostElement.innerHTML = "";
  hostElement.classList.add("nv-equation-collider-toolbar");

  const bridge = getActiveMetaWorldLayerBridge();
  if (!bridge?.addExpressionLayer) {
    hostElement.appendChild(document.createTextNode("Open a MetaWorld editor to insert expression layers."));
    setStatus("Open a MetaWorld editor before inserting expression layers.");
    return;
  }

  const addSurface = makePresetButton("Add Expression Layer", "z = sin(x) * cos(y)", "functionSurface", "Expression Surface");
  const addCurve = makePresetButton("Add Curve", "y = x^2", "functionCurve", "Expression Curve");
  const addParametric = makePresetButton("Add Parametric Curve", "x = cos(t), y = sin(t), z = t / 10", "parametricCurve", "Parametric Curve");

  [addSurface, addCurve, addParametric].forEach((element) => hostElement.appendChild(element));
}
