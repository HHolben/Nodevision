// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/ViewMolecule.mjs
// This file defines browser-side View Molecule logic for the Nodevision UI. It renders interface components and handles user interactions.

import { renderFile as renderDelegate } from "./ViewMOL.mjs";

export async function renderFile(filename, viewPanel, iframe, serverBase) {
  return renderDelegate(filename, viewPanel, iframe, serverBase);
}
