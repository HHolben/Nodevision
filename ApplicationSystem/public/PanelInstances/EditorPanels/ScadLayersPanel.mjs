// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/ScadLayersPanel.mjs
// Layer panel component for the graphical SCAD editor.

export function renderScadLayersPanel(container, state, actions = {}) {
  if (!container) return;
  const { model, selectedIds = [], activeLayerId = null } = state;
  container.innerHTML = "";
  Object.assign(container.style, {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    minWidth: "240px",
    maxWidth: "300px",
    borderLeft: "1px solid #d6dce5",
    background: "#fbfcfe",
    overflow: "auto",
  });

  const header = document.createElement("div");
  Object.assign(header.style, { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px", borderBottom: "1px solid #e5e7eb" });
  header.innerHTML = `<div style="font:600 12px/1.3 system-ui,sans-serif;color:#1f2937;">SCAD Layers</div>`;
  const add = smallButton("+", () => actions.addLayer?.());
  add.title = "Add layer";
  header.appendChild(add);
  container.appendChild(header);

  for (const layer of model.layers || []) {
    const layerBlock = document.createElement("div");
    Object.assign(layerBlock.style, { borderBottom: "1px solid #edf0f4", padding: "8px" });
    const isActive = layer.id === activeLayerId;
    const row = document.createElement("div");
    Object.assign(row.style, { display: "grid", gridTemplateColumns: "18px 1fr auto", alignItems: "center", gap: "6px" });
    row.innerHTML = `
      <span style="width:12px;height:12px;border-radius:3px;background:${escapeAttr(layer.color || "#4f8cff")};display:inline-block;"></span>
      <button type="button" style="text-align:left;border:0;background:${isActive ? "#eef5ff" : "transparent"};font:600 12px/1.2 system-ui,sans-serif;padding:4px;border-radius:4px;cursor:pointer;">${escapeHtml(layer.name || "Layer")}</button>
      <span style="display:flex;gap:3px;"></span>
    `;
    row.children[1].addEventListener("click", () => actions.setActiveLayer?.(layer.id));
    const controls = row.lastElementChild;
    controls.appendChild(smallButton(layer.visible === false ? "Show" : "Hide", () => actions.toggleLayerVisible?.(layer.id)));
    controls.appendChild(smallButton(layer.locked ? "Unlock" : "Lock", () => actions.toggleLayerLocked?.(layer.id)));
    layerBlock.appendChild(row);

    const layerControls = document.createElement("div");
    Object.assign(layerControls.style, { display: "flex", gap: "4px", margin: "6px 0 4px 18px", flexWrap: "wrap" });
    layerControls.appendChild(smallButton("Rename", () => {
      const next = prompt("Layer name", layer.name || "Layer");
      if (next !== null) actions.renameLayer?.(layer.id, next);
    }));
    layerControls.appendChild(smallButton("Up", () => actions.reorderLayer?.(layer.id, -1)));
    layerControls.appendChild(smallButton("Down", () => actions.reorderLayer?.(layer.id, 1)));
    layerControls.appendChild(smallButton("Delete", () => actions.deleteLayer?.(layer.id)));
    layerBlock.appendChild(layerControls);

    const objects = (layer.objectIds || []).map((id) => model.objects.find((obj) => obj.id === id)).filter(Boolean);
    const objectList = document.createElement("div");
    Object.assign(objectList.style, { display: "flex", flexDirection: "column", gap: "3px", marginLeft: "18px" });
    if (!objects.length) {
      const empty = document.createElement("div");
      empty.textContent = "No objects";
      Object.assign(empty.style, { font: "11px/1.3 system-ui,sans-serif", color: "#8a93a3", padding: "3px 4px" });
      objectList.appendChild(empty);
    }
    objects.forEach((obj) => {
      const item = document.createElement("button");
      item.type = "button";
      item.textContent = obj.name || obj.type;
      const selected = selectedIds.includes(obj.id);
      Object.assign(item.style, {
        textAlign: "left",
        border: selected ? "1px solid #f59e0b" : "1px solid transparent",
        background: selected ? "#fff7ed" : "transparent",
        borderRadius: "4px",
        padding: "4px 6px",
        cursor: layer.locked ? "not-allowed" : "pointer",
        color: layer.locked ? "#9ca3af" : "#374151",
        font: "12px/1.25 system-ui,sans-serif",
      });
      item.addEventListener("click", (event) => actions.selectObject?.(obj.id, event));
      objectList.appendChild(item);
    });
    layerBlock.appendChild(objectList);

    if (selectedIds.length && layer.id !== activeLayerId) {
      const move = smallButton("Move selection here", () => actions.moveSelectionToLayer?.(layer.id));
      move.style.margin = "6px 0 0 18px";
      layerBlock.appendChild(move);
    }

    container.appendChild(layerBlock);
  }
}

function smallButton(label, handler) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.textContent = label;
  Object.assign(btn.style, { font: "10px/1 system-ui,sans-serif", padding: "4px 5px", border: "1px solid #d1d5db", borderRadius: "4px", background: "#fff", cursor: "pointer" });
  btn.addEventListener("click", handler);
  return btn;
}

function escapeHtml(value = "") {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function escapeAttr(value = "") {
  return escapeHtml(value).replaceAll("'", "&#39;");
}
