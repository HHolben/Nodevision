// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/ElementLayers/panel.mjs
// This file defines UI helpers for the ElementLayers module in Nodevision. It builds the layers panel DOM and renders layer rows with controls for visibility, ordering, and renaming.

export function createPanelElement() {
  const el = document.createElement("div");
  el.id = "svg-layer-panel";
  Object.assign(el.style, {
    border: "1px solid #d0d0d0",
    background: "#fafafa",
    padding: "6px",
    minWidth: "220px",
    maxWidth: "280px",
    overflow: "auto",
  });
  return el;
}

export function renderLayersPanel({
  panelEl,
  getLayers,
  activeLayerId,
  createLayer,
  setActiveLayer,
  setLayerVisible,
  moveLayer,
  removeLayer,
  rerender,
} = {}) {
  if (!panelEl || typeof getLayers !== "function") return;
  panelEl.innerHTML = "";

  const header = document.createElement("div");
  header.style.display = "flex";
  header.style.gap = "6px";
  header.style.alignItems = "center";
  header.style.marginBottom = "6px";

  const title = document.createElement("div");
  title.textContent = "Layers";
  title.style.fontWeight = "700";
  title.style.flex = "1";
  header.appendChild(title);

  const addBtn = document.createElement("button");
  addBtn.textContent = "+";
  addBtn.title = "Add Layer";
  addBtn.onclick = () => createLayer?.();
  header.appendChild(addBtn);
  panelEl.appendChild(header);

  const list = document.createElement("div");
  list.style.display = "flex";
  list.style.flexDirection = "column";
  list.style.gap = "4px";

  getLayers().forEach((layer) => {
    const row = document.createElement("div");
    row.style.display = "grid";
    row.style.gridTemplateColumns = "18px 1fr auto auto auto auto";
    row.style.alignItems = "center";
    row.style.gap = "4px";
    row.style.padding = "3px 4px";
    row.style.border =
      layer.id === activeLayerId ? "1px solid #5aa9ff" : "1px solid #d5d5d5";
    row.style.background = layer.id === activeLayerId ? "#eef6ff" : "#fff";

    const vis = document.createElement("input");
    vis.type = "checkbox";
    vis.checked = layer.style.display !== "none";
    vis.onchange = () => setLayerVisible?.(layer.id, vis.checked);
    row.appendChild(vis);

    const nameBtn = document.createElement("button");
    nameBtn.textContent = layer.getAttribute("data-layer-name") || layer.id;
    nameBtn.style.textAlign = "left";
    nameBtn.style.border = "none";
    nameBtn.style.background = "transparent";
    nameBtn.style.padding = "2px 3px";
    nameBtn.onclick = () => setActiveLayer?.(layer.id);
    row.appendChild(nameBtn);

    const upBtn = document.createElement("button");
    upBtn.textContent = "↑";
    upBtn.title = "Move Up";
    upBtn.onclick = () => moveLayer?.(layer.id, -1);
    row.appendChild(upBtn);

    const downBtn = document.createElement("button");
    downBtn.textContent = "↓";
    downBtn.title = "Move Down";
    downBtn.onclick = () => moveLayer?.(layer.id, 1);
    row.appendChild(downBtn);

    const renameBtn = document.createElement("button");
    renameBtn.textContent = "✎";
    renameBtn.title = "Rename";
    renameBtn.onclick = () => {
      const oldName = layer.getAttribute("data-layer-name") || layer.id;
      const next = prompt("Layer name:", oldName);
      if (!next) return;
      layer.setAttribute("data-layer-name", next.trim() || oldName);
      rerender?.();
    };
    row.appendChild(renameBtn);

    const delBtn = document.createElement("button");
    delBtn.textContent = "✕";
    delBtn.title = "Delete Layer";
    delBtn.onclick = () => removeLayer?.(layer.id);
    row.appendChild(delBtn);

    list.appendChild(row);
  });

  panelEl.appendChild(list);
}

