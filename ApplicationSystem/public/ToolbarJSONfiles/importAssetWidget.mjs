// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/importAssetWidget.mjs
// This toolbar widget opens the specialized Import Asset panel for hidden Nodevision Meta Worlds.

import { createPanelDOM } from "/panels/panelFactory.mjs";
import { setStatus } from "/StatusBar.mjs";

export async function openImportAssetPanel() {
  const instanceId = "nv-meta-world-import-panel";
  const existing = document.querySelector(`.panel[data-instance-id="${instanceId}"]`);
  if (existing && existing.parentNode) existing.parentNode.removeChild(existing);

  const panelInst = await createPanelDOM(
    "MetaWorldImportPanel",
    instanceId,
    "EditorPanel",
    { displayName: "Import Asset" }
  );

  panelInst.panel.__nvDefaultDockCell = window.activeCell?.classList?.contains("panel-cell") ? window.activeCell : null;
  document.body.appendChild(panelInst.panel);
  if (panelInst.dockBtn && typeof panelInst.dockBtn.click === "function") {
    try {
      panelInst.dockBtn.dispatchEvent(new MouseEvent("click", { bubbles: false, cancelable: true, view: window }));
    } catch {
      panelInst.dockBtn.click();
    }
  }
  panelInst.panel.style.width = "min(760px, 94vw)";
  panelInst.panel.style.height = "auto";
  panelInst.panel.style.maxHeight = "min(760px, 84vh)";
  panelInst.panel.style.left = `${Math.max(20, Math.round(window.innerWidth * 0.16))}px`;
  panelInst.panel.style.top = `${Math.max(20, Math.round(window.innerHeight * 0.12))}px`;
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
