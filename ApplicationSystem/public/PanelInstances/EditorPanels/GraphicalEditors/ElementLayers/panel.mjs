// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/ElementLayers/panel.mjs
// This file defines UI helpers for the ElementLayers module in Nodevision. It builds the layers panel DOM and renders layer rows with controls for visibility, ordering, and renaming.

function ensurePanelState(panelEl) {
  if (!panelEl) return { expandedLayers: new Map() };
  if (!panelEl.__nvElementLayersState) {
    Object.defineProperty(panelEl, "__nvElementLayersState", {
      value: {
        expandedLayers: new Map(),
        selected: { type: null, layerId: null, element: null },
        keyHandlerInstalled: false,
        rerender: null,
        dragData: null,
      },
      enumerable: false,
      configurable: false,
      writable: false,
    });
  }
  return panelEl.__nvElementLayersState;
}

function isSvgElementVisible(el) {
  if (!el || el.nodeType !== Node.ELEMENT_NODE) return true;
  if (el.style?.display === "none") return false;
  if (el.getAttribute?.("display") === "none") return false;
  if (el.style?.visibility === "hidden") return false;
  if (el.getAttribute?.("visibility") === "hidden") return false;
  return true;
}

function setSvgElementVisible(el, visible) {
  if (!el || el.nodeType !== Node.ELEMENT_NODE) return;
  if (visible) {
    if (el.style) {
      el.style.display = "";
      el.style.visibility = "";
    }
    if (el.getAttribute?.("display") === "none") el.removeAttribute("display");
    if (el.getAttribute?.("visibility") === "hidden") el.removeAttribute("visibility");
  } else {
    if (el.style) el.style.display = "none";
  }
}

function describeSvgElement(el) {
  const explicit = el?.getAttribute?.("data-element-name");
  if (explicit) return explicit;
  const tag = (el?.tagName || "element").toLowerCase();
  const id = el?.getAttribute?.("id");
  const cls = (el?.getAttribute?.("class") || "").trim();
  const classToken = cls ? ` .${cls.split(/\s+/).filter(Boolean).join(".")}` : "";
  const idToken = id ? ` #${id}` : "";

  let extra = "";
  if (tag === "g" && el?.children?.length) extra = ` (${el.children.length})`;
  if (tag === "text") {
    const t = (el.textContent || "").trim().replace(/\s+/g, " ");
    if (t) extra = `${extra} “${t.slice(0, 32)}${t.length > 32 ? "…" : ""}”`;
  }
  return `${tag}${idToken}${classToken}${extra}`;
}

function getDropHalf(event, targetEl) {
  const rect = targetEl?.getBoundingClientRect?.();
  if (!rect || !Number.isFinite(rect.top) || !Number.isFinite(rect.height)) return "upper";
  const mid = rect.top + (rect.height / 2);
  return event.clientY < mid ? "upper" : "lower";
}

function getElementDropZone(event, targetEl) {
  const rect = targetEl?.getBoundingClientRect?.();
  if (!rect || !Number.isFinite(rect.top) || !Number.isFinite(rect.height)) return "before";
  const y = event.clientY;
  const upper = rect.top + (rect.height / 3);
  const lower = rect.bottom - (rect.height / 3);
  if (y <= upper) return "before";
  if (y >= lower) return "after";
  return "inside";
}

function isValidSvgContainer(el) {
  if (!el || el.nodeType !== Node.ELEMENT_NODE) return false;
  const tag = String(el.tagName || "").toLowerCase();
  return [
    "g",
    "svg",
    "a",
    "switch",
    "symbol",
    "defs",
    "marker",
    "mask",
    "pattern",
    "clippath",
    "foreignobject",
  ].includes(tag);
}

function setDropIndicator(targetEl, zone) {
  if (!targetEl?.style) return;
  if (zone === "inside") {
    targetEl.style.boxShadow = "inset 0 0 0 2px #2f80ff";
    return;
  }
  targetEl.style.boxShadow = zone === "before"
    ? "inset 0 2px 0 #2f80ff"
    : "inset 0 -2px 0 #2f80ff";
}

function clearDropIndicator(targetEl) {
  if (!targetEl?.style) return;
  targetEl.style.boxShadow = "";
}

function renderLayerContents({
  layer,
  rootLayerId,
  containerEl,
  rerender,
  depth = 0,
  state,
  panelEl,
  setActiveLayer,
  moveElementToLayer,
} = {}) {
  // Render topmost element first so panel order matches SVG z-order.
  const children = Array.from(layer?.children || []).reverse();
  if (children.length === 0) {
    const empty = document.createElement("div");
    empty.textContent = "No elements in this layer.";
    Object.assign(empty.style, {
      fontStyle: "italic",
      color: "#666",
      padding: "2px 6px",
    });
    containerEl.appendChild(empty);
    return;
  }

  children.forEach((child) => {
    const item = document.createElement("div");
    Object.assign(item.style, {
      display: "grid",
      gridTemplateColumns: "52px 1fr",
      alignItems: "center",
      gap: "4px",
      padding: "2px 4px",
      paddingLeft: `${8 + depth * 12}px`,
      borderRadius: "4px",
      cursor: "pointer",
    });
    item.draggable = true;

    const visible = isSvgElementVisible(child);
    const visBtn = document.createElement("button");
    visBtn.type = "button";
    visBtn.textContent = visible ? "Unsee" : "See";
    visBtn.title = visible ? "Hide element" : "Show element";
    visBtn.setAttribute("aria-pressed", String(visible));
    visBtn.onclick = () => {
      setSvgElementVisible(child, !visible);
      rerender?.();
    };
    item.appendChild(visBtn);

    const label = document.createElement("div");
    label.textContent = describeSvgElement(child);
    Object.assign(label.style, {
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
      fontSize: "12px",
      color: "#222",
      userSelect: "text",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    });
    item.appendChild(label);

    const isSelected = state?.selected?.type === "element" && state.selected.element === child;
    if (isSelected) {
      item.style.background = "rgba(255, 183, 77, 0.22)";
      item.style.outline = "1px solid rgba(255, 183, 77, 0.75)";
    }

    label.ondblclick = () => {
      const current = child.getAttribute("data-element-name") || describeSvgElement(child);
      const next = prompt("Rename element", current);
      if (next && next.trim()) {
        child.setAttribute("data-element-name", next.trim());
        label.textContent = describeSvgElement(child);
      }
    };

    item.addEventListener("dragstart", (e) => {
      state.dragData = { type: "element", element: child, layerId: rootLayerId };
      e.dataTransfer?.setData("text/plain", "element");
      e.dataTransfer?.setDragImage?.(item, 0, 0);
    });
    item.addEventListener("dragend", () => {
      state.dragData = null;
      item.style.backgroundColor = isSelected ? "rgba(255, 183, 77, 0.22)" : "";
      clearDropIndicator(item);
    });
    item.addEventListener("dragover", (e) => {
      if (state.dragData?.type === "element") {
        e.preventDefault();
        e.stopPropagation();
        item.style.backgroundColor = "rgba(90,169,255,0.18)";
        const zone = getElementDropZone(e, item);
        const indicatorZone = zone === "inside" && !isValidSvgContainer(child)
          ? getDropHalf(e, item) === "upper" ? "before" : "after"
          : zone;
        setDropIndicator(item, indicatorZone);
      }
    });
    item.addEventListener("dragleave", (e) => {
      e.stopPropagation();
      item.style.backgroundColor = isSelected ? "rgba(255, 183, 77, 0.22)" : "";
      clearDropIndicator(item);
    });
    item.addEventListener("drop", (e) => {
      if (state.dragData?.type !== "element") return;
      e.preventDefault();
      e.stopPropagation();
      const dragging = state.dragData.element;
      if (!dragging || dragging === child) return;
      const targetLayerId = rootLayerId;
      const rawZone = getElementDropZone(e, item);
      const zone = rawZone === "inside" && !isValidSvgContainer(child)
        ? getDropHalf(e, item) === "upper" ? "before" : "after"
        : rawZone;
      // Top third places dragged item above target in panel (after in DOM),
      // middle third nests inside target (for container elements),
      // bottom third places it below target in panel (before in DOM).
      const canNest = zone === "inside";
      const beforeEl = canNest ? null : zone === "before" ? child.nextSibling : child;
      const targetParent = canNest
        ? child
        : child.parentNode instanceof SVGElement
          ? child.parentNode
          : null;
      moveElementToLayer?.(dragging, targetLayerId, beforeEl, targetParent);
      state.dragData = null;
      item.style.backgroundColor = isSelected ? "rgba(255, 183, 77, 0.22)" : "";
      clearDropIndicator(item);
    });

    item.addEventListener("click", (e) => {
      if (e.target instanceof HTMLElement && e.target.tagName === "BUTTON") return;
      if (state?.selected) {
        state.selected.type = "element";
        state.selected.layerId = rootLayerId || null;
        state.selected.element = child;
      }
      const ctx = window.SVGEditorContext;
      if (ctx?.setSelection) {
        ctx.setSelection([child], { primary: child });
      }
      panelEl?.focus?.({ preventScroll: true });
      setActiveLayer?.(rootLayerId);
    });

    containerEl.appendChild(item);

    if (child.children && child.children.length > 0) {
      renderLayerContents({
        layer: child,
        rootLayerId,
        containerEl,
        rerender,
        depth: depth + 1,
        state,
        panelEl,
        setActiveLayer,
        moveElementToLayer,
      });
    }
  });
}

export function createPanelElement() {
  const el = document.createElement("div");
  el.id = "svg-layer-panel";
  el.tabIndex = 0;
  Object.assign(el.style, {
    border: "1px solid #d0d0d0",
    background: "#fafafa",
    padding: "6px",
    minWidth: "220px",
    maxWidth: "280px",
    overflow: "auto",
    outline: "none",
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
  moveLayerTo,
  moveElementToLayer,
  removeLayer,
  rerender,
} = {}) {
  if (!panelEl || typeof getLayers !== "function") return;
  const state = ensurePanelState(panelEl);
  state.rerender = rerender || null;

  if (state.selected?.element && !state.selected.element.isConnected) {
    state.selected = { type: null, layerId: null, element: null };
  }

  if (!state.keyHandlerInstalled) {
    const handler = (e) => {
      const ctx = window.SVGEditorContext;
      if (!ctx) return;
      const key = String(e.key || "").toLowerCase();
      const mod = e.ctrlKey || e.metaKey;

      const selectedType = state.selected?.type;
      const selectedLayerId = state.selected?.layerId || null;
      const selectedElement = state.selected?.element || null;

      if (key === "delete" || key === "backspace") {
        if (selectedType === "element" && selectedElement && selectedElement.isConnected) {
          ctx.setSelection?.([selectedElement], { primary: selectedElement });
          const deleted = ctx.deleteSelection?.();
          if (deleted) {
            state.selected = { type: null, layerId: null, element: null };
            state.rerender?.();
            e.preventDefault();
          }
        }
        return;
      }

      if (!mod) return;
      if (!["c", "x", "v"].includes(key)) return;

      const tryPasteLayer = () => {
        if (!ctx.layers?.pasteLayer) return null;
        const pasted = ctx.layers.pasteLayer(selectedType === "layer" ? selectedLayerId : null);
        if (pasted && ctx.setSelection) ctx.setSelection([pasted], { primary: pasted });
        return pasted;
      };

      const tryPasteElements = () => {
        if (!ctx.pasteSelection) return [];
        const pasted = ctx.pasteSelection();
        if (pasted?.length) state.rerender?.();
        return pasted;
      };

      if (key === "c") {
        if (selectedType === "layer" && selectedLayerId && ctx.layers?.copyLayer) {
          ctx.layers.copyLayer(selectedLayerId);
          e.preventDefault();
          return;
        }
        if (selectedType === "element" && selectedElement && selectedElement.isConnected) {
          ctx.setSelection?.([selectedElement], { primary: selectedElement });
          if (ctx.copySelection?.()) e.preventDefault();
          return;
        }
        if (ctx.copySelection?.()) e.preventDefault();
        return;
      }

      if (key === "x") {
        if (selectedType === "layer" && selectedLayerId && ctx.layers?.cutLayer) {
          ctx.layers.cutLayer(selectedLayerId);
          state.selected = { type: null, layerId: null, element: null };
          e.preventDefault();
          return;
        }
        if (selectedType === "element" && selectedElement && selectedElement.isConnected) {
          ctx.setSelection?.([selectedElement], { primary: selectedElement });
          const copied = ctx.copySelection?.();
          const deleted = ctx.deleteSelection?.();
          if (deleted) state.rerender?.();
          if (copied || deleted) e.preventDefault();
          return;
        }
        const copied = ctx.copySelection?.();
        const deleted = ctx.deleteSelection?.();
        if (deleted) state.rerender?.();
        if (copied || deleted) e.preventDefault();
        return;
      }

      if (key === "v") {
        if (selectedType === "layer") {
          const pasted = tryPasteLayer();
          if (pasted) {
            e.preventDefault();
            return;
          }
        }
        const pastedEls = tryPasteElements();
        if (pastedEls?.length) {
          e.preventDefault();
          return;
        }
        const pastedLayer = tryPasteLayer();
        if (pastedLayer) {
          e.preventDefault();
        }
      }
    };

    panelEl.addEventListener("keydown", handler, true);
    state.keyHandlerInstalled = true;
  }

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

  const domOrderedLayers = getLayers();
  const currentLayerIds = new Set(domOrderedLayers.map((l) => l.id));
  [...state.expandedLayers.keys()].forEach((id) => {
    if (!currentLayerIds.has(id)) state.expandedLayers.delete(id);
  });
  if (state.selected?.type === "layer" && state.selected.layerId && !currentLayerIds.has(state.selected.layerId)) {
    state.selected = { type: null, layerId: null, element: null };
  }

  // Render topmost layer first so top row corresponds to top on canvas.
  [...domOrderedLayers].reverse().forEach((layer) => {
    if (!state.expandedLayers.has(layer.id)) {
      state.expandedLayers.set(layer.id, layer.id === activeLayerId);
    }
    const isExpanded = !!state.expandedLayers.get(layer.id);
    const isSelectedLayer = state.selected?.type === "layer" && state.selected.layerId === layer.id;

    const wrapper = document.createElement("div");
    wrapper.style.border =
      layer.id === activeLayerId ? "1px solid #5aa9ff" : "1px solid #d5d5d5";
    wrapper.style.background = layer.id === activeLayerId ? "#eef6ff" : "#fff";
    wrapper.style.borderRadius = "6px";
    wrapper.draggable = true;
    if (isSelectedLayer) {
      wrapper.style.outline = "2px solid rgba(255, 183, 77, 0.95)";
      wrapper.style.outlineOffset = "-2px";
    }

    const row = document.createElement("div");
    row.style.display = "grid";
    row.style.gridTemplateColumns = "20px 52px 1fr auto auto auto auto";
    row.style.alignItems = "center";
    row.style.gap = "4px";
    row.style.padding = "3px 4px";

    const expandBtn = document.createElement("button");
    expandBtn.type = "button";
    expandBtn.textContent = isExpanded ? "▾" : "▸";
    expandBtn.title = isExpanded ? "Collapse layer contents" : "Expand layer contents";
    expandBtn.setAttribute("aria-expanded", String(isExpanded));
    expandBtn.onclick = () => {
      state.expandedLayers.set(layer.id, !isExpanded);
      rerender?.();
    };
    row.appendChild(expandBtn);

    const isVisible = layer.style.display !== "none";
    const visBtn = document.createElement("button");
    visBtn.type = "button";
    visBtn.textContent = isVisible ? "Unsee" : "See";
    visBtn.title = isVisible ? "Hide layer" : "Show layer";
    visBtn.setAttribute("aria-pressed", String(isVisible));
    visBtn.onclick = () => {
      const nextVisible = layer.style.display === "none";
      setLayerVisible?.(layer.id, nextVisible);
      rerender?.();
    };
    row.appendChild(visBtn);

    const nameBtn = document.createElement("button");
    nameBtn.textContent = layer.getAttribute("data-layer-name") || layer.id;
    nameBtn.style.textAlign = "left";
    nameBtn.style.border = "none";
    nameBtn.style.background = "transparent";
    nameBtn.style.padding = "2px 3px";
    nameBtn.title = "Select layer";
    nameBtn.onclick = () => {
      state.selected.type = "layer";
      state.selected.layerId = layer.id;
      state.selected.element = null;
      const ctx = window.SVGEditorContext;
      if (ctx?.setSelection) ctx.setSelection([layer], { primary: layer });
      panelEl?.focus?.({ preventScroll: true });
      setActiveLayer?.(layer.id);
    };
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

    wrapper.appendChild(row);

    wrapper.addEventListener("dragstart", (e) => {
      state.dragData = { type: "layer", layerId: layer.id };
      e.dataTransfer?.setData("text/plain", layer.id);
      e.dataTransfer?.setDragImage?.(wrapper, 0, 0);
    });
    wrapper.addEventListener("dragend", () => {
      state.dragData = null;
      wrapper.style.background = layer.id === activeLayerId ? "#eef6ff" : "#fff";
      clearDropIndicator(row);
    });
    wrapper.addEventListener("dragover", (e) => {
      if (state.dragData?.type === "layer") {
        e.preventDefault();
        setDropIndicator(row, getDropHalf(e, row) === "upper" ? "before" : "after");
        wrapper.style.background = "rgba(90,169,255,0.18)";
      } else if (state.dragData?.type === "element") {
        e.preventDefault();
        setDropIndicator(row, getDropHalf(e, row) === "upper" ? "before" : "after");
        wrapper.style.background = "rgba(90,169,255,0.12)";
      }
    });
    wrapper.addEventListener("dragleave", () => {
      wrapper.style.background = layer.id === activeLayerId ? "#eef6ff" : "#fff";
      clearDropIndicator(row);
    });
    wrapper.addEventListener("drop", (e) => {
      const half = getDropHalf(e, row);
      if (state.dragData?.type === "layer") {
        e.preventDefault();
        const draggingId = state.dragData.layerId;
        if (draggingId && draggingId !== layer.id) {
          // Top half = place above target in panel (after in DOM for top-first view).
          // Bottom half = place below target in panel (before in DOM for top-first view).
          moveLayerTo?.(draggingId, layer.id, half === "upper" ? "after" : "before");
        }
      } else if (state.dragData?.type === "element") {
        e.preventDefault();
        const draggingEl = state.dragData.element;
        if (draggingEl) {
          // Top half puts element at front/top of layer, bottom half at back/bottom.
          const beforeEl = half === "upper" ? null : layer.firstChild;
          moveElementToLayer?.(draggingEl, layer.id, beforeEl, layer);
        }
      }
      state.dragData = null;
      wrapper.style.background = layer.id === activeLayerId ? "#eef6ff" : "#fff";
      clearDropIndicator(row);
    });

    if (isExpanded) {
      const contents = document.createElement("div");
      Object.assign(contents.style, {
        borderTop: "1px dashed rgba(0,0,0,0.15)",
        background: "rgba(255,255,255,0.55)",
        padding: "4px 2px 6px 2px",
      });
      renderLayerContents({
        layer,
        rootLayerId: layer.id,
        containerEl: contents,
        rerender,
        state,
        panelEl,
        setActiveLayer,
        moveElementToLayer,
      });
      wrapper.appendChild(contents);
    }

    list.appendChild(wrapper);
  });

  panelEl.appendChild(list);
}
