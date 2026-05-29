// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/equationElementsWidget.mjs
// This widget renders Equation Editing structural tool buttons. The toolbar reuses the shared equation input surface actions.

import { renderEquationToolbarGroup } from "/Equation/EquationExpressionEditor.mjs";

const MODE = "EquationEditing";

function dispatch(actionKey) {
  const handler = window.NodevisionState?.activeActionHandler;
  if (typeof handler === "function") {
    handler(actionKey);
  }
}

export function initToolbarWidget(hostElement) {
  if (!hostElement) return;
  if ((window.NodevisionState?.currentMode || "") !== MODE) return;

  const mount = hostElement.querySelector("#nv-equation-elements") || hostElement;
  mount.id = "nv-equation-elements";
  renderEquationToolbarGroup(mount, { group: "elements", onAction: dispatch });
}
