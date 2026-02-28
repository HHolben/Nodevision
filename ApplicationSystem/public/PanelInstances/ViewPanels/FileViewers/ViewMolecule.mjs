// Nodevision/public/PanelInstances/ViewPanels/FileViewers/ViewMolecule.mjs
// This file delegates molecule previews to the existing MOL viewer.

import { renderFile as renderDelegate } from "./ViewMOL.mjs";

export async function renderFile(filename, viewPanel, iframe, serverBase) {
  return renderDelegate(filename, viewPanel, iframe, serverBase);
}
