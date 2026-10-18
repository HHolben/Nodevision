// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/MetaWorldImportPanel.mjs
// This panel imports Notebook assets into the hidden Nodevision Meta World definition for the selected HTML file.

import { setStatus } from "/StatusBar.mjs";
import { cleanNotebookPath, isHtmlWorldPath, selectedWorldPath } from "./MetaWorldImportComponents/assetTypes.mjs";
import { createAssetBrowser } from "./MetaWorldImportComponents/assetBrowser.mjs";
import { importNotebookAsset } from "./MetaWorldImportComponents/importAssetApi.mjs";

function styles() {
  return `
    <style>
      .nv-mw-import { display:flex; flex-direction:column; gap:10px; font:12px monospace; color:#1d2520; min-width:320px; }
      .nv-mw-import-target { padding:8px; border:1px solid #aab8ae; background:#f4f7f4; }
      .nv-mw-import-tabs, .nv-mw-import-controls { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
      .nv-mw-import-tab, .nv-mw-import button { border:1px solid #333; background:#eee; padding:6px 10px; cursor:pointer; font:12px monospace; }
      .nv-mw-import-tab[aria-selected="true"] { background:#d8eadc; }
      .nv-mw-import input[type="search"] { flex:1; min-width:180px; padding:6px; border:1px solid #8a968d; font:12px monospace; }
      .nv-mw-import-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(170px, 1fr)); gap:8px; max-height:430px; overflow:auto; }
      .nv-mw-import-card { display:flex; flex-direction:column; gap:6px; border:1px solid #bcc8bf; background:#fff; padding:8px; }
      .nv-mw-import-preview { height:92px; display:flex; align-items:center; justify-content:center; background:#edf1ee; border:1px solid #d4ddd7; overflow:hidden; }
      .nv-mw-import-preview img { width:100%; height:100%; object-fit:contain; }
      .nv-mw-import-preview--placeholder { color:#4e5c54; text-align:center; }
      .nv-mw-import-card-title { font-weight:700; overflow-wrap:anywhere; }
      .nv-mw-import-card-meta { color:#58655d; font-size:11px; line-height:1.3; overflow-wrap:anywhere; }
      .nv-mw-import-empty { padding:14px; color:#58655d; border:1px dashed #aab8ae; }
      .nv-mw-import-panel { display:none; }
      .nv-mw-import-panel[aria-hidden="false"] { display:block; }
    </style>
  `;
}

async function refreshWorldViewport(worldPath) {
  const loader = window.VRWorldContext?.loadWorldFromFile;
  if (typeof loader === "function") {
    await loader(worldPath, { reason: "asset-import" });
    return true;
  }
  document.dispatchEvent(new CustomEvent("fileSelected", { detail: { filePath: worldPath } }));
  return false;
}

function renderTarget(root, path) {
  root.textContent = isHtmlWorldPath(path)
    ? `Target world: Notebook/${path}`
    : "Select an HTML world file first.";
}

export function createPanel(contentElem, options = {}) {
  let activeTab = "notebook";
  let placement = "origin";
  const targetWorld = cleanNotebookPath(options.worldPath || selectedWorldPath());
  const worldPath = () => targetWorld;

  contentElem.innerHTML = `${styles()}<div class="nv-mw-import">
    <div data-target class="nv-mw-import-target"></div>
    <div class="nv-mw-import-tabs" role="tablist">
      <button type="button" class="nv-mw-import-tab" data-tab="notebook" aria-selected="true">Notebook Assets</button>
      <button type="button" class="nv-mw-import-tab" data-tab="online" aria-selected="false">Free Online</button>
    </div>
    <section data-panel="notebook" class="nv-mw-import-panel" aria-hidden="false">
      <div class="nv-mw-import-controls">
        <label><input data-placement type="radio" name="nv-mw-placement" value="origin" checked> Place at Origin</label>
        <label><input data-placement type="radio" name="nv-mw-placement" value="camera-target"> Place at Camera Target</label>
      </div>
      <div data-browser></div>
    </section>
    <section data-panel="online" class="nv-mw-import-panel" aria-hidden="true">
      <div class="nv-mw-import-empty">Free/open asset search will support license, attribution, Notebook localization, and metadata before insertion.</div>
    </section>
    <div data-status class="nv-mw-import-card-meta"></div>
  </div>`;

  const targetEl = contentElem.querySelector("[data-target]");
  const statusEl = contentElem.querySelector("[data-status]");

  const setLocalStatus = (message) => {
    statusEl.textContent = message || "";
    if (message) setStatus(message);
  };

  renderTarget(targetEl, worldPath());
  contentElem.cleanup = createAssetBrowser(contentElem.querySelector('[data-browser]'), {
    startDirectory: targetWorld.split('/').slice(0,-1).join('/'),
    onStatus: message => { statusEl.textContent=message; },
    onImport: async (asset, button) => {
      const target = worldPath();
      if (!isHtmlWorldPath(target)) {
        setLocalStatus("Select an HTML world file first.");
        return;
      }
      button.disabled = true;
      try {
        const result = await importNotebookAsset({ worldPath: target, assetPath: asset.notebookPath, placement });
        if(cleanNotebookPath(selectedWorldPath())===target)await refreshWorldViewport(target);
        setLocalStatus(`Imported ${result.assetPath.split("/").pop()} into world.`);
      } catch (err) {
        setLocalStatus(err?.message || "Import failed.");
      } finally {
        button.disabled = false;
      }
    },
  });

  contentElem.querySelectorAll("[data-tab]").forEach((tab) => {
    tab.addEventListener("click", () => {
      activeTab = tab.dataset.tab;
      contentElem.querySelectorAll("[data-tab]").forEach((node) => node.setAttribute("aria-selected", String(node === tab)));
      contentElem.querySelectorAll("[data-panel]").forEach((panel) => panel.setAttribute("aria-hidden", String(panel.dataset.panel !== activeTab)));
    });
  });
  contentElem.querySelectorAll("[data-placement]").forEach((input) => {
    input.addEventListener("change", () => { placement = input.value; });
  });
}
