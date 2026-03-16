// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/ViewIIIF.mjs
// This file defines browser-side View IIIF logic for the Nodevision UI. It renders interface components and handles user interactions.

import { renderFile as renderDelegate } from "./ViewJSON.mjs";

export async function renderFile(filename, viewPanel, iframe, serverBase) {
  return renderDelegate(filename, viewPanel, iframe, serverBase);
}
