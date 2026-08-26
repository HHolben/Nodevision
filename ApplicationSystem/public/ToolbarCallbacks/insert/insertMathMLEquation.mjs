// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/insertMathMLEquation.mjs
// Opens the shared Insert Equation panel so direct equation toolbar actions and Insert Media use one equation insertion workflow.

import { openEquationMediaPanel } from "/ToolbarJSONfiles/insertMediaEquation.mjs";

// === Toolbar Callback ===
export default async function insertMathMLEquation() {
  try {
    await openEquationMediaPanel(["tex", "latex", "mathml"]);
  } catch (err) {
    console.warn("insertMathMLEquation: unable to open shared equation panel.", err);
  }
}
