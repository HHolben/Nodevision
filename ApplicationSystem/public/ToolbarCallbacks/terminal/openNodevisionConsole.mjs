// Nodevision/ApplicationSystem/public/ToolbarCallbacks/terminal/openNodevisionConsole.mjs
// Opens the floating Nodevision browser-context console.

import { createPanelDOM } from "/panels/panelFactory.mjs";
import { setStatus } from "/StatusBar.mjs";

function showConsoleSubToolbar() {
  window.dispatchEvent(new CustomEvent("nv-show-subtoolbar", {
    detail: {
      heading: "Nodevision Console",
      force: true,
      toggle: false,
    },
  }));
}

function activateConsolePanel(panel) {
  if (!panel) return;
  window.__nvActivePanelElement = panel;
  window.__nvActiveLegacyUndockedPanel = null;
  window.activePanel = "NodevisionConsole";
  window.activePanelClass = "InfoPanel";
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.activePanelType = "InfoPanel";
  panel.style.display = "";
  panel.style.visibility = "";
  panel.style.zIndex = String(Math.max(22000, Number.parseInt(panel.style.zIndex || "0", 10) || 0) + 1);
  window.dispatchEvent(new CustomEvent("activePanelChanged", {
    detail: {
      panel: "NodevisionConsole",
      cell: null,
      panelClass: "InfoPanel",
    },
  }));
}

export default async function openNodevisionConsole() {
  const existing = document.querySelector('.panel[data-instance-name="NodevisionConsole"]');
  if (existing?.isConnected) {
    activateConsolePanel(existing);
    window.NVNodevisionConsole?.focus?.();
    showConsoleSubToolbar();
    setStatus("Nodevision Console", "Focused");
    return existing;
  }

  const instanceId = `NodevisionConsole-${Date.now()}`;
  const created = await createPanelDOM("NodevisionConsole", instanceId, "InfoPanel", {
    displayName: "Nodevision Console",
  });

  const panel = created.panel;
  document.body.appendChild(panel);
  panel.__nvSetLayout?.("floating");
  panel.style.left = "72px";
  panel.style.top = "calc(var(--nv-global-toolbar-height, 40px) + 56px)";
  panel.style.width = "min(860px, calc(100vw - 112px))";
  panel.style.height = "min(560px, calc(100vh - var(--nv-global-toolbar-height, 40px) - 112px))";
  panel.style.minWidth = "360px";
  panel.style.minHeight = "260px";

  activateConsolePanel(panel);
  showConsoleSubToolbar();
  window.NVNodevisionConsole?.focus?.();
  setStatus("Nodevision Console", "Opened");
  return panel;
}
