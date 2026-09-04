// Nodevision/ApplicationSystem/public/ToolbarCallbacks/view/PanelTabsRight.mjs
// This toolbar callback moves the active panel cell tab bar to the right edge.

import { setActivePanelTabOrientation } from "./panelTabOrientation.mjs";

export default function run() {
  return setActivePanelTabOrientation("right");
}

