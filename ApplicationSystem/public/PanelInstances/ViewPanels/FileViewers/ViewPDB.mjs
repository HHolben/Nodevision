// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/ViewPDB.mjs
// This file defines browser-side View PDB logic for the Nodevision UI. It renders interface components and handles user interactions.

import { renderFile as renderDelegate } from "./ViewText.mjs";

export async function renderFile(filename, viewPanel, iframe, serverBase) {
  return renderDelegate(filename, viewPanel, iframe, serverBase);
}
