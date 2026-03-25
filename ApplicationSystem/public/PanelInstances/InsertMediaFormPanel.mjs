// Nodevision/ApplicationSystem/public/PanelInstances/InsertMediaFormPanel.mjs
// Minimal PanelInstances module used for undocked Insert → Media forms (content is filled by toolbar widgets).

export async function createPanel(contentElem) {
  if (!contentElem) return;
  contentElem.innerHTML = "";
}

