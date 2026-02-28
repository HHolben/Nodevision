// Nodevision/public/PanelInstances/ViewPanels/FileViewers/ViewArchive.mjs
// This file previews archive files with a lightweight summary and a download action.

import { renderFile as renderBinaryFile } from "./ViewBinary.mjs";

export async function renderFile(filename, viewPanel, iframe, serverBase) {
  await renderBinaryFile(filename, viewPanel, iframe, serverBase);

  const note = document.createElement("p");
  note.style.margin = "0 1rem 1rem 1rem";
  note.textContent = "Archive contents are not expanded in this panel.";
  viewPanel.appendChild(note);
}
