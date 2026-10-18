// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/importAssetWidget.mjs
// This toolbar widget opens the specialized Import Asset panel for hidden Nodevision Meta Worlds.

import { createPanelDOM } from "/panels/panelFactory.mjs";
import {selectedWorldPath} from "/PanelInstances/EditorPanels/MetaWorldImportComponents/assetTypes.mjs";
import { setStatus } from "/StatusBar.mjs";

export async function openImportAssetPanel() {
  const instanceId = "nv-meta-world-import-panel";
  const existing = document.querySelector(`.panel[data-instance-id="${instanceId}"]`);
  if (existing?.isConnected) { existing.focus(); return {panel:existing}; }
  const worldPath=selectedWorldPath();

  const panelInst = await createPanelDOM(
    "MetaWorldImportPanel",
    instanceId,
    "EditorPanel",
    { displayName: "Import Asset", worldPath }
  );

  document.body.appendChild(panelInst.panel);
  panelInst.panel.__nvSetLayout?.('overlay', {onDismiss:()=>panelInst.panel.remove()});
  panelInst.panel.style.width = "min(760px, 94vw)";
  panelInst.panel.style.height = "min(650px, 84vh)";
  panelInst.panel.style.maxHeight = "min(760px, 84vh)";
  panelInst.panel.style.zIndex = "23000";
  panelInst.content.style.overflow = "auto";
  setStatus("Import Asset panel opened");
  return panelInst;
}

export function initToolbarWidget() {
  void openImportAssetPanel().catch((err) => {
    setStatus("Failed to open Import Asset panel", err?.message || "");
  });
}
