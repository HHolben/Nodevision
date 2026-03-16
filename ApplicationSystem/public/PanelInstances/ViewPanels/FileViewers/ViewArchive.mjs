// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/ViewArchive.mjs
// This file defines browser-side View Archive logic for the Nodevision UI. It renders interface components and handles user interactions.

import { renderFile as renderBinaryFile } from "./ViewBinary.mjs";

export async function renderFile(filename, viewPanel, iframe, serverBase) {
  await renderBinaryFile(filename, viewPanel, iframe, serverBase);

  const note = document.createElement("p");
  note.style.margin = "0 1rem 1rem 1rem";
  note.textContent = "Archive contents are not expanded in this panel.";
  viewPanel.appendChild(note);
}
