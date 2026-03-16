// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/ViewELAN.mjs
// This file defines browser-side View ELAN logic for the Nodevision UI. It renders interface components and handles user interactions.

import { renderFile as renderDelegate } from "./ViewXML.mjs";

export async function renderFile(filename, viewPanel, iframe, serverBase) {
  return renderDelegate(filename, viewPanel, iframe, serverBase);
}
