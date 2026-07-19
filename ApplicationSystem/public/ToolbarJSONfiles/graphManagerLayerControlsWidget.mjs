// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/graphManagerLayerControlsWidget.mjs
// Compact Graph Manager layer toggles for the sub-toolbar.

export function initToolbarWidget(hostElement) {
  if (!hostElement) return;

  hostElement.innerHTML = "";
  hostElement.style.display = "flex";
  hostElement.style.alignItems = "center";
  hostElement.style.gap = "10px";
  hostElement.style.flexWrap = "wrap";

  const controls = document.createElement("div");
  controls.dataset.graphManagerLayerControls = "true";
  controls.style.cssText = "display:flex;align-items:center;gap:14px;flex-wrap:wrap;font-size:12px;color:#1f2937;";
  hostElement.appendChild(controls);

  const bindControls = () => {
    const binder = window.bindGraphManagerLayerControls;
    if (typeof binder === "function") {
      binder(controls);
      return true;
    }
    return false;
  };

  if (!bindControls()) {
    const handleReady = () => bindControls();
    window.addEventListener("graphManagerLayersReady", handleReady, { once: true });
    window.setTimeout(bindControls, 50);
  }
}
