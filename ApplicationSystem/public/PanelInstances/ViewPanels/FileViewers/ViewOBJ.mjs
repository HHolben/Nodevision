// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/ViewOBJ.mjs
// OBJ file viewer with a Three.js viewport, orientation widget, and STL export.

import { updateToolbarState } from "/panels/createToolbar.mjs";
import { createObjGraphicalPreview } from "/PanelInstances/EditorPanels/GraphicalEditors/ModelFamilyEditor.mjs";

function objViewerUrl(pathValue = "", serverBase = "/Notebook") {
  const base = String(serverBase || "/Notebook").replace(/\/+$/, "");
  const clean = String(pathValue || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/[?#].*$/, "")
    .replace(/^\/+/, "")
    .replace(/^Notebook\/+/, "");
  const encoded = clean.split("/").filter(Boolean).map(encodeURIComponent).join("/");
  return `${base}/${encoded}`;
}

export async function renderFile(filename, viewPanel, iframe, serverBase = "/Notebook") {
  if (typeof viewPanel?._dispose === "function") {
    try {
      viewPanel._dispose();
    } catch (err) {
      console.warn("[ViewOBJ] Previous viewer cleanup failed:", err);
    }
  }

  viewPanel.innerHTML = "";
  viewPanel.style.cssText = "display:flex;flex-direction:column;gap:8px;width:100%;height:100%;min-width:0;min-height:360px;overflow:hidden;box-sizing:border-box;padding:8px;";
  window.NodevisionModelExportContext = null;
  updateToolbarState({ currentMode: "OBJviewing", activePanelType: "ViewPanel", selectedFile: filename, modelCanExportSTL: false });

  const status = document.createElement("div");
  status.style.cssText = "font:12px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;color:#475569;min-height:18px;";
  status.textContent = "Loading OBJ...";

  const mount = document.createElement("div");
  mount.style.cssText = "flex:1;min-height:360px;min-width:0;width:100%;position:relative;overflow:hidden;";
  viewPanel.append(status, mount);

  try {
    const response = await fetch(objViewerUrl(filename, serverBase), { cache: "no-store" });
    if (!response.ok) throw new Error(`${response.status} ${response.statusText || "OBJ load failed"}`);
    const source = await response.text();
    const preview = await createObjGraphicalPreview(mount, source, status);
    const exportToken = Symbol("nv-obj-viewer-export-context");
    window.NodevisionModelExportContext = {
      token: exportToken,
      kind: "obj-viewer",
      filePath: filename,
      exportSTL: () => preview.exportSTL(filename),
    };
    updateToolbarState({ currentMode: "OBJviewing", activePanelType: "ViewPanel", selectedFile: filename, modelCanExportSTL: true });

    viewPanel._dispose = () => {
      preview.dispose();
      if (window.NodevisionModelExportContext?.token === exportToken) {
        window.NodevisionModelExportContext = null;
        updateToolbarState({ modelCanExportSTL: false });
      }
      viewPanel._dispose = null;
    };
  } catch (err) {
    console.error("[ViewOBJ] Error:", err);
    mount.innerHTML = `<p style="color:#b00020;margin:12px;">Error loading OBJ file: ${err?.message || err}</p>`;
    status.textContent = "OBJ load failed.";
  }
}
