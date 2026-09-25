// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/SvgBackgroundAppearanceOverlay.mjs
// This overlay hosts the reusable appearance panel for the active SVG document background without embedding SVG document mutation logic in the generic controls.

import { createAppearancePanel } from "../Common/Appearance/AppearancePanel.mjs";

export function createPanel(content, vars = {}, panelRoot = null) {
  content.innerHTML = "";
  const title = document.createElement("h2");
  title.textContent = vars.title || "SVG Background";
  title.style.margin = "0 0 10px";
  title.style.fontSize = "16px";

  const adapter = vars.adapter || window.SVGEditorContext?.createBackgroundAppearanceAdapter?.();
  if (!adapter) {
    content.append(title, document.createTextNode("Open an SVG editor to edit the SVG document background."));
    return null;
  }

  let completed = false;
  const panel = createAppearancePanel(adapter, {
    title: vars.title || "SVG Background",
    onDone: (value) => { completed = true; vars.onDone?.(value); },
    onCancel: () => { completed = true; vars.onCancel?.(); },
  });
  content.append(title, panel.element);

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    observer?.disconnect?.();
    if (!completed) adapter.cancelAppearance?.();
    panel.destroy?.();
  };
  const observer = panelRoot && typeof MutationObserver === "function"
    ? new MutationObserver(() => { if (!panelRoot.isConnected) cleanup(); })
    : null;
  observer?.observe?.(document.body, { childList: true });
  content.cleanup = cleanup;
  content.__nvPanelTabDestroy = cleanup;
  if (panelRoot) panelRoot.__nvAppearanceCleanup = cleanup;

  return {
    activate: () => panel.activate?.(),
    destroy: cleanup,
  };
}
