// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/insert3DScenePanel.mjs
// Opens the HTML Insert -> 3D Scene Panel workflow.

import { openInsertMediaPanel } from "/ToolbarJSONfiles/insertMediaPanel.mjs";
import { renderInsertUSDScenePanel } from "/ToolbarJSONfiles/insertUSDScenePanel.mjs";

export default async function insert3DScenePanel() {
  const panel = await openInsertMediaPanel("Insert 3D Scene Panel", "USDScene");
  renderInsertUSDScenePanel(panel.mount);
}
