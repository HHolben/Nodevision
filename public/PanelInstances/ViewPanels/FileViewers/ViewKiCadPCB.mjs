// Nodevision/public/PanelInstances/ViewPanels/FileViewers/ViewKiCadPCB.mjs
// This file delegates KiCad PCB previews to the generic text viewer.

import { renderFile as renderDelegate } from "./ViewText.mjs";

export async function renderFile(filename, viewPanel, iframe, serverBase) {
  return renderDelegate(filename, viewPanel, iframe, serverBase);
}
