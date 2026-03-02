// Nodevision/public/PanelInstances/EditorPanels/GraphicalEditors/ElementLayers.mjs
// Layer manager for SVG editing: create/toggle/select/reorder logical <g> layers.

const SVG_NS = "http://www.w3.org/2000/svg";

function qsa(root, selector) {
  return Array.from(root.querySelectorAll(selector));
}

function ensureGroup(svgRoot, name = "Layer 1", id = null) {
  const group = document.createElementNS(SVG_NS, "g");
  group.setAttribute("data-layer", "true");
  group.setAttribute("data-layer-name", name);
  group.setAttribute("id", id || `layer-${Math.random().toString(36).slice(2, 9)}`);
  return group;
}

export function createElementLayers(svgRoot, hostPanel = null) {
  if (!svgRoot) throw new Error("svgRoot is required");

  let activeLayerId = null;
  let panelEl = null;

  function getLayers() {
    return qsa(svgRoot, ":scope > g[data-layer='true']");
  }

  function normalizeInitialLayers() {
    let layers = getLayers();
    if (layers.length === 0) {
      const layer1 = ensureGroup(svgRoot, "Layer 1");
      while (svgRoot.firstChild) {
        layer1.appendChild(svgRoot.firstChild);
      }
      svgRoot.appendChild(layer1);
      layers = [layer1];
    }
    layers.forEach((layer, i) => {
      if (!layer.getAttribute("id")) {
        layer.setAttribute("id", `layer-${i + 1}`);
      }
      if (!layer.getAttribute("data-layer-name")) {
        layer.setAttribute("data-layer-name", `Layer ${i + 1}`);
      }
    });
    if (!activeLayerId || !layers.find((l) => l.id === activeLayerId)) {
      activeLayerId = layers[0]?.id || null;
    }
  }

  function getActiveLayer() {
    return getLayers().find((l) => l.id === activeLayerId) || getLayers()[0] || null;
  }

  function setActiveLayer(layerId) {
    activeLayerId = layerId;
    renderPanel();
  }

  function createLayer(name = null) {
    const layers = getLayers();
    const nextName = name || `Layer ${layers.length + 1}`;
    const layer = ensureGroup(svgRoot, nextName);
    svgRoot.appendChild(layer);
    activeLayerId = layer.id;
    renderPanel();
    return layer;
  }

  function appendToActiveLayer(node) {
    const layer = getActiveLayer();
    if (!layer) return;
    layer.appendChild(node);
  }

  function removeLayer(layerId) {
    const layers = getLayers();
    if (layers.length <= 1) return false;
    const target = layers.find((l) => l.id === layerId);
    if (!target) return false;
    const fallback = layers.find((l) => l !== target) || null;
    while (target.firstChild && fallback) {
      fallback.appendChild(target.firstChild);
    }
    target.remove();
    activeLayerId = fallback?.id || null;
    renderPanel();
    return true;
  }

  function setLayerVisible(layerId, visible) {
    const layer = getLayers().find((l) => l.id === layerId);
    if (!layer) return;
    layer.style.display = visible ? "" : "none";
  }

  function moveLayer(layerId, direction) {
    const layers = getLayers();
    const idx = layers.findIndex((l) => l.id === layerId);
    if (idx < 0) return;
    const layer = layers[idx];
    const swapIdx = direction < 0 ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= layers.length) return;
    const other = layers[swapIdx];
    if (direction < 0) {
      svgRoot.insertBefore(layer, other);
    } else {
      svgRoot.insertBefore(other, layer);
    }
    renderPanel();
  }

  function createPanelElement() {
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

  function renderPanel() {
    if (!panelEl) return;
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
    addBtn.onclick = () => createLayer();
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
      row.style.border = layer.id === activeLayerId ? "1px solid #5aa9ff" : "1px solid #d5d5d5";
      row.style.background = layer.id === activeLayerId ? "#eef6ff" : "#fff";

      const vis = document.createElement("input");
      vis.type = "checkbox";
      vis.checked = layer.style.display !== "none";
      vis.onchange = () => setLayerVisible(layer.id, vis.checked);
      row.appendChild(vis);

      const nameBtn = document.createElement("button");
      nameBtn.textContent = layer.getAttribute("data-layer-name") || layer.id;
      nameBtn.style.textAlign = "left";
      nameBtn.style.border = "none";
      nameBtn.style.background = "transparent";
      nameBtn.style.padding = "2px 3px";
      nameBtn.onclick = () => setActiveLayer(layer.id);
      row.appendChild(nameBtn);

      const upBtn = document.createElement("button");
      upBtn.textContent = "↑";
      upBtn.title = "Move Up";
      upBtn.onclick = () => moveLayer(layer.id, -1);
      row.appendChild(upBtn);

      const downBtn = document.createElement("button");
      downBtn.textContent = "↓";
      downBtn.title = "Move Down";
      downBtn.onclick = () => moveLayer(layer.id, 1);
      row.appendChild(downBtn);

      const renameBtn = document.createElement("button");
      renameBtn.textContent = "✎";
      renameBtn.title = "Rename";
      renameBtn.onclick = () => {
        const oldName = layer.getAttribute("data-layer-name") || layer.id;
        const next = prompt("Layer name:", oldName);
        if (!next) return;
        layer.setAttribute("data-layer-name", next.trim() || oldName);
        renderPanel();
      };
      row.appendChild(renameBtn);

      const delBtn = document.createElement("button");
      delBtn.textContent = "✕";
      delBtn.title = "Delete Layer";
      delBtn.onclick = () => removeLayer(layer.id);
      row.appendChild(delBtn);

      list.appendChild(row);
    });

    panelEl.appendChild(list);
  }

  function attachHost(nextHost) {
    if (!nextHost) return;
    if (!panelEl) {
      panelEl = createPanelElement();
    }
    if (panelEl.parentElement && panelEl.parentElement !== nextHost) {
      panelEl.parentElement.removeChild(panelEl);
    }
    nextHost.appendChild(panelEl);
    renderPanel();
  }

  normalizeInitialLayers();
  if (hostPanel) attachHost(hostPanel);

  return {
    getLayers,
    getActiveLayer,
    setActiveLayer,
    createLayer,
    appendToActiveLayer,
    setLayerVisible,
    moveLayer,
    removeLayer,
    renderPanel,
    attachHost
  };
}
