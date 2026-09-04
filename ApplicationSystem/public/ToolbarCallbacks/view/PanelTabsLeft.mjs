// Nodevision/ApplicationSystem/public/ToolbarCallbacks/view/PanelTabsLeft.mjs
// This toolbar callback moves the active panel cell tab bar to the left edge.

import { setActivePanelTabOrientation } from "./panelTabOrientation.mjs";

export default function run() {
  return setActivePanelTabOrientation("left");
}

