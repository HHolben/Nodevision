// Nodevision/ApplicationSystem/public/TemplateSystem/NodevisionOverlayPanel.mjs
// Promise wrapper for opening lightweight Nodevision overlay panels.

import { createPanelDOM } from "/panels/panelFactory.mjs";

export async function openNodevisionOverlayPanel(instanceName, panelVars = {}, options = {}) {
  return new Promise(async (resolve) => {
    let panel = null;
    let observer = null;
    let finished = false;

    const finish = (value = null) => {
      if (finished) return;
      finished = true;
      observer?.disconnect();
      if (panel?.isConnected) panel.remove();
      resolve(value);
    };

    const vars = {
      ...panelVars,
      onCancel: (...args) => {
        if (typeof panelVars.onCancel === "function") panelVars.onCancel(...args);
        finish(null);
      },
      onDone: (value) => finish(value),
    };

    try {
      const instanceId = `${instanceName}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const created = await createPanelDOM(instanceName, instanceId, options.panelClass || "InfoPanel", vars);
      panel = created.panel;
      document.body.appendChild(panel);
      panel.__nvSetLayout?.("overlay", { onDismiss: () => finish(null) });

      for (const selector of [".panel-confirm-btn", ".panel-dock-btn", ".panel-max-btn"]) {
        const button = panel.querySelector(selector);
        if (button) button.style.display = "none";
      }

      observer = new MutationObserver(() => {
        if (finished || !panel || panel.isConnected) return;
        finish(null);
      });
      observer.observe(document.body, { childList: true });
    } catch (err) {
      console.error(`Failed to open ${instanceName} overlay panel:`, err);
      finish(null);
    }
  });
}
