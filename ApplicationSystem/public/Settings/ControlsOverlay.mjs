// Nodevision/ApplicationSystem/public/Settings/ControlsOverlay.mjs
// This module opens the Control Mappings reference through Nodevision's existing panel factory overlay layout so the Settings Control Mappings action participates in normal panel lifecycle behavior.

import { createPanelDOM } from "/panels/panelFactory.mjs";

function removeExistingControlsPanel() {
  document.querySelectorAll('.panel[data-instance-name="ControlsPanel"]').forEach((panel) => panel.remove());
}

export async function openControlsOverlay() {
  removeExistingControlsPanel();
  const id = `ControlsPanel-${Date.now()}`;
  const created = await createPanelDOM("ControlsPanel", id, "InfoPanel", {
    displayName: "Control Mappings",
  });
  document.body.appendChild(created.panel);
  created.panel.__nvSetLayout?.("overlay");
  return created.panel;
}
