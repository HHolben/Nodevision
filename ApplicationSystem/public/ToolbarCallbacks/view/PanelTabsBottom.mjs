// Nodevision/ApplicationSystem/public/ToolbarCallbacks/view/PanelTabsBottom.mjs
// This toolbar callback moves the active panel cell tab bar to the bottom edge.

import { setActivePanelTabOrientation } from "./panelTabOrientation.mjs";

export default function run() {
  return setActivePanelTabOrientation("bottom");
}

