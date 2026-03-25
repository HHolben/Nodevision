// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/insertMediaPanel.mjs
// Creates an undocked floating panel (Insert → Media) matching the Insert Image panel behavior.

import { createPanelDOM } from "/panels/panelFactory.mjs";

function normalizeIdPart(s) {
  return String(s || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "media";
}

export async function openInsertMediaPanel(title, familyKey = "") {
  const idPart = normalizeIdPart(familyKey || title);
  const instanceId = `nv-insert-media-${idPart}-panel`;
  const existing = document.querySelector(`.panel[data-instance-id="${instanceId}"]`);
  if (existing && existing.parentNode) existing.parentNode.removeChild(existing);

  const panelInst = await createPanelDOM(
    "InsertMediaFormPanel",
    instanceId,
    "GenericPanel",
    { displayName: title || "Insert Media" }
  );

  document.body.appendChild(panelInst.panel);
  panelInst.panel.__nvDefaultDockCell = (
    window.activeCell &&
    window.activeCell.classList?.contains("panel-cell")
  ) ? window.activeCell : null;

  if (panelInst.dockBtn && typeof panelInst.dockBtn.click === "function") {
    try {
      panelInst.dockBtn.dispatchEvent(new MouseEvent("click", { bubbles: false, cancelable: true, view: window }));
    } catch {
      panelInst.dockBtn.click();
    }
  }

  panelInst.panel.style.width = "min(620px, 92vw)";
  panelInst.panel.style.height = "auto";
  panelInst.panel.style.maxHeight = "min(700px, 82vh)";
  panelInst.panel.style.left = `${Math.max(20, Math.round(window.innerWidth * 0.2))}px`;
  panelInst.panel.style.top = `${Math.max(20, Math.round(window.innerHeight * 0.15))}px`;
  panelInst.panel.style.zIndex = "23000";
  panelInst.panel.style.pointerEvents = "auto";

  panelInst.content.style.padding = "10px";
  panelInst.content.style.background = "#f8f8f8";
  panelInst.content.style.overflow = "auto";
  panelInst.content.innerHTML = "";

  const topRow = document.createElement("div");
  topRow.style.cssText = "display:flex;justify-content:flex-end;gap:8px;margin-bottom:8px;";

  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "Close";
  close.style.cssText = "font:12px monospace;padding:6px 10px;border:1px solid #333;background:#eee;cursor:pointer;";
  close.addEventListener("click", () => {
    if (panelInst.panel.parentNode) panelInst.panel.parentNode.removeChild(panelInst.panel);
  });

  topRow.appendChild(close);

  const mount = document.createElement("div");
  panelInst.content.appendChild(topRow);
  panelInst.content.appendChild(mount);

  return { panelEl: panelInst.panel, body: panelInst.content, mount, closeBtn: close };
}
