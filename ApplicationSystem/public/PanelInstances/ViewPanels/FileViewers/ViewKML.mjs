// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/ViewKML.mjs
// Google-Earth-like KML viewer/editor surface built on Leaflet.

import { renderKMLEditor } from "./KML/KMLEditor.mjs";

export async function renderFile(filename, viewPanel) {
  try {
    await renderKMLEditor(filename, viewPanel, { mode: "viewer" });
  } catch (err) {
    viewPanel.innerHTML = "";
    const message = document.createElement("div");
    message.style.cssText = "padding:12px;color:#b00020;font:13px/1.45 ui-monospace,SFMono-Regular,Consolas,monospace;";
    message.textContent = `Error loading KML file: ${err.message}`;
    viewPanel.appendChild(message);
  }
}

export async function setupPanel(panel, instanceVars = {}) {
  const filePath = window.selectedFilePath || instanceVars.filePath || "";
  await renderFile(filePath, panel);
}
