// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/ViewUSD.mjs
// USD file viewer panel backed by the shared USD scene runtime.

import { updateToolbarState } from "/panels/createToolbar.mjs";
import { createUSDSceneViewer, usdModelUrl } from "/PanelInstances/ViewPanels/FileViewers/USDSceneRuntime.mjs";

const viewers = new WeakMap();

export function renderUSD(filePath, container, serverBase = "/Notebook") {
  if (!container) return null;
  if (typeof container._dispose === "function") {
    try {
      container._dispose();
    } catch (err) {
      console.warn("[ViewUSD] Previous viewer cleanup failed:", err);
    }
  }

  container.innerHTML = "";
  container.style.cssText = "display:flex;flex-direction:column;width:100%;height:100%;min-width:0;min-height:360px;overflow:hidden;box-sizing:border-box;padding:8px;background:#0f1720;";

  const mount = document.createElement("div");
  mount.style.cssText = "flex:1;min-width:0;min-height:360px;width:100%;position:relative;overflow:hidden;border:1px solid #2f3a48;border-radius:8px;";
  container.appendChild(mount);

  const viewer = createUSDSceneViewer(mount, { minHeight: "360px", background: "#151a20" });
  viewers.set(container, viewer);
  viewer.loadFromUrl(usdModelUrl(filePath, serverBase));

  const token = Symbol("nv-usd-viewer-context");
  window.__nvUsdViewerApi = viewer;
  window.NodevisionModelExportContext = null;
  updateToolbarState({
    currentMode: "USDviewing",
    activePanelType: "ViewPanel",
    selectedFile: filePath,
    modelCanExportSTL: false,
  });

  container._dispose = () => {
    viewer.dispose();
    if (window.__nvUsdViewerApi === viewer) window.__nvUsdViewerApi = null;
    if (window.NodevisionModelExportContext?.token === token) window.NodevisionModelExportContext = null;
    container._dispose = null;
  };
  return viewer;
}

export async function renderFile(filename, viewPanel, iframe, serverBase = "/Notebook") {
  try {
    renderUSD(filename, viewPanel, serverBase);
    return true;
  } catch (err) {
    console.error("[ViewUSD] Critical error:", err);
    viewPanel.innerHTML = `<p style="color:#b00020;margin:12px;">Critical USD viewer error: ${err?.message || err}</p>`;
    return false;
  }
}
