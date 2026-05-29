// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/equationSymbolsWidget.mjs
// This widget renders Equation Editing symbol tool buttons. The toolbar reuses the shared equation input surface actions.

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

  const mount = hostElement.querySelector("#nv-equation-symbols") || hostElement;
  mount.id = "nv-equation-symbols";
  renderEquationToolbarGroup(mount, { group: "symbols", onAction: dispatch });
}
