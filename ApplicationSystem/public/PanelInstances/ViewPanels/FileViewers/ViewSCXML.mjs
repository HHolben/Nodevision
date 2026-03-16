// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/ViewSCXML.mjs
// This file defines browser-side View SCXML logic for the Nodevision UI. It renders interface components and handles user interactions.

import { renderFile as renderDelegate } from "./ViewXML.mjs";

export async function renderFile(filename, viewPanel, iframe, serverBase) {
  return renderDelegate(filename, viewPanel, iframe, serverBase);
}
