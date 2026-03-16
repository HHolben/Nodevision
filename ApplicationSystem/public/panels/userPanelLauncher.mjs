// Nodevision/ApplicationSystem/public/panels/userPanelLauncher.mjs
// This file defines browser-side user Panel Launcher logic for the Nodevision UI. It renders interface components and handles user interactions.

import { createPanelDOM } from "./panelFactory.mjs";

function removeExisting(panelName) {
  const existing = document.querySelector(`.panel[data-instance-name="${panelName}"]`);
  if (existing && existing.parentNode) {
    existing.parentNode.removeChild(existing);
  }
}

function getBodyDockCell() {
  if (window.activeCell && window.activeCell.classList?.contains("panel-cell")) {
    return window.activeCell;
  }
  return null;
}

export async function openFloatingInfoPanel(panelName, displayName) {
  removeExisting(panelName);
  const instanceId = `nv-${panelName.toLowerCase()}-${Date.now()}`;
  const panelInst = await createPanelDOM(
    panelName,
    instanceId,
    "InfoPanel",
    { displayName }
  );

  document.body.appendChild(panelInst.panel);
  const dockTarget = getBodyDockCell();
  if (dockTarget) {
    panelInst.panel.__nvDefaultDockCell = dockTarget;
  }

  if (panelInst.dockBtn && typeof panelInst.dockBtn.click === "function") {
    panelInst.dockBtn.click();
  }

  Object.assign(panelInst.panel.style, {
    width: "min(560px, 92vw)",
    maxHeight: "min(620px, 86vh)",
    left: `${Math.max(24, Math.round(window.innerWidth * 0.28))}px`,
    top: `${Math.max(32, Math.round(window.innerHeight * 0.12))}px`,
    zIndex: "23000",
    pointerEvents: "auto",
    position: "absolute",
  });

  panelInst.panel.style.height = "auto";
  panelInst.content.style.padding = "14px";
  panelInst.content.style.overflowY = "auto";
  return panelInst;
}
