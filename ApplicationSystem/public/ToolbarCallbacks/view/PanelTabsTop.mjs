// Nodevision/ApplicationSystem/public/ToolbarCallbacks/view/PanelTabsTop.mjs
// This toolbar callback moves the active panel cell tab bar to the top edge.

import { setActivePanelTabOrientation } from "./panelTabOrientation.mjs";

export default function run() {
  return setActivePanelTabOrientation("top");
}

