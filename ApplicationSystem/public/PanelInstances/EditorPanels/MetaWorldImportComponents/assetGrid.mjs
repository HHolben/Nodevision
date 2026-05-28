// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/MetaWorldImportComponents/assetGrid.mjs
// This file renders asset cards for the Meta World import panel and forwards safe import actions.

import { createPreview, typeLabel } from "./assetTypes.mjs";

export function renderAssetGrid(root, assets, { onImport } = {}) {
  root.innerHTML = "";
  if (!assets.length) {
    const empty = document.createElement("div");
    empty.className = "nv-mw-import-empty";
    empty.textContent = "No supported Notebook assets found.";
    root.appendChild(empty);
    return;
  }

  for (const asset of assets) {
    const card = document.createElement("article");
    card.className = "nv-mw-import-card";
    card.appendChild(createPreview(asset));

    const title = document.createElement("div");
    title.className = "nv-mw-import-card-title";
    title.textContent = asset.name;

    const meta = document.createElement("div");
    meta.className = "nv-mw-import-card-meta";
    meta.textContent = `${typeLabel(asset.type)} · ${asset.notebookPath}`;

    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Import to World";
    button.addEventListener("click", () => onImport?.(asset, button));

    card.append(title, meta, button);
    root.appendChild(card);
  }
}
