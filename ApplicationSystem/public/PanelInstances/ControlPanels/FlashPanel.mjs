// Nodevision/ApplicationSystem/public/PanelInstances/ControlPanels/FlashPanel.mjs
// ControlPanel wrapper that mounts the reusable Arduino Flash Panel module.

import { setupFlashPanel } from "/ArduinoFlash/FlashPanel.mjs";

export async function setupPanel(panel, panelVars = {}) {
  await setupFlashPanel(panel, panelVars);
}
