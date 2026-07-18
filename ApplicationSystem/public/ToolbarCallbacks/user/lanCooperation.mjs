// Nodevision/ApplicationSystem/public/ToolbarCallbacks/user/lanCooperation.mjs
// Opens the LAN Cooperation user panel.

import { openFloatingInfoPanel } from "/panels/userPanelLauncher.mjs";

export default async function lanCooperation() {
  await openFloatingInfoPanel("LANCooperationPanel", "LAN Cooperation");
}
