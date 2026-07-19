// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/GraphManagerDependencies/ThingDescriptionGraphAdapter.mjs
// Live, derived Thing Description graph layer. Does not persist TD graph data to Notebook graph files.

import { deriveThingDescriptionGraph, isThingDescriptionPath, parseThingDescriptionText } from "/ThingDescription/ThingDescriptionModel.mjs";

export const THING_DESCRIPTION_GRAPH_STYLE = [
  { selector: 'node[source="thing-description"]', style: { 'border-style': 'dashed', 'border-width': 2, 'font-size': '9px', 'text-wrap': 'wrap', 'text-max-width': 120, 'text-valign': 'center', 'text-halign': 'center', 'color': '#2c1b0f', 'text-outline-width': 1, 'text-outline-color': '#fffaf4' } },
  { selector: 'node[type="td-device"]', style: { 'shape': 'round-rectangle', 'background-color': '#f6c177', 'border-color': '#a15c00', 'width': 114, 'height': 58, 'font-weight': '700' } },
  { selector: 'node[type="td-property"]', style: { 'shape': 'ellipse', 'background-color': '#ffe2b8', 'border-color': '#b87518', 'width': 104, 'height': 54 } },
  { selector: 'node[type="td-action"]', style: { 'shape': 'round-diamond', 'background-color': '#f9d6e2', 'border-color': '#a13b61', 'width': 104, 'height': 58 } },
  { selector: 'node[type="td-event"]', style: { 'shape': 'tag', 'background-color': '#dbeafe', 'border-color': '#4169a8', 'width': 104, 'height': 54 } },
  { selector: 'node[type="td-physical-io"]', style: { 'shape': 'barrel', 'background-color': '#d8f3dc', 'border-color': '#40916c', 'width': 108, 'height': 56 } },
  { selector: 'node[type="td-topic"]', style: { 'shape': 'ellipse', 'background-color': '#e5fbf6', 'border-color': '#16806f', 'width': 130, 'height': 58 } },
  { selector: 'node[type="td-csv"]', style: { 'shape': 'round-tag', 'background-color': '#fff7cc', 'border-color': '#a67200', 'width': 118, 'height': 52 } },
  { selector: 'edge[layer="thing-description"]', style: { 'line-color': '#c47a1c', 'target-arrow-color': '#c47a1c', 'target-arrow-shape': 'triangle', 'curve-style': 'bezier', 'width': 2, 'line-style': 'dotted', 'label': 'data(label)', 'font-size': '8px', 'text-background-color': '#ffffff', 'text-background-opacity': 0.85 } },
];

function notebookUrl(path) {
  return `/Notebook/${String(path || '').split('/').filter(Boolean).map(encodeURIComponent).join('/')}`;
}

function ensureControlsSection(container) {
  if (!container) return null;
  let section = container.querySelector("[data-td-layer-controls]");
  if (!section) {
    section = document.createElement("div");
    section.dataset.tdLayerControls = "true";
    section.style.cssText = "display:flex;align-items:center;gap:10px;flex-wrap:wrap;";
    container.appendChild(section);
  }
  return section;
}

function renderControl(container, state, refresh) {
  const section = ensureControlsSection(container);
  if (!section) return;
  section.innerHTML = `<label style="display:flex;align-items:center;gap:5px;white-space:nowrap;"><input data-td-layer type="checkbox" ${state.enabled ? "checked" : ""}>Thing Descriptions</label>`;
  section.querySelector("[data-td-layer]")?.addEventListener("change", (event) => {
    state.enabled = event.target.checked;
    refresh();
  });
}

async function elementsForVisibleTdFiles(cy) {
  const elements = [];
  const fileNodes = cy.nodes('node[type="file"]').filter((node) => isThingDescriptionPath(node.data('fullPath') || node.data('label') || ''));
  for (const fileNode of fileNodes) {
    const path = fileNode.data('fullPath');
    try {
      const res = await fetch(notebookUrl(path), { cache: 'no-store' });
      if (!res.ok) continue;
      const td = parseThingDescriptionText(await res.text());
      const derived = deriveThingDescriptionGraph(td).map((element) => {
        const data = { ...element.data, tdFilePath: path };
        if (element.group === 'nodes') data.parent = data.parent || undefined;
        return { ...element, classes: 'td-live', data };
      });
      const deviceNode = derived.find((element) => element.group === 'nodes' && element.data.type === 'td-device');
      if (deviceNode) {
        derived.push({ group: 'edges', classes: 'td-live', data: { id: `td:file-edge:${encodeURIComponent(path)}`, source: path, target: deviceNode.data.id, label: 'describes', layer: 'thing-description' } });
      }
      elements.push(...derived);
    } catch (err) {
      console.warn('[ThingDescriptionGraph] Failed to derive graph for TD:', path, err?.message || err);
    }
  }
  return elements;
}

export function attachThingDescriptionGraphLayer({ cy, controlsEl, relayout } = {}) {
  if (!cy) return { refresh: () => {}, setControlsElement: () => {}, cleanup: () => {} };
  const state = { enabled: true, rendering: false, pending: false };
  let currentControlsEl = controlsEl || null;

  const refresh = async () => {
    if (state.rendering) {
      state.pending = true;
      return;
    }
    state.rendering = true;
    try {
      renderControl(currentControlsEl, state, refresh);
      if (!state.enabled) {
        cy.elements('.td-live').remove();
        relayout?.({ fit: false, reason: 'td-layer-disabled' });
        return;
      }
      const elements = await elementsForVisibleTdFiles(cy);
      const ids = new Set(elements.map((element) => element.data.id));
      cy.batch(() => {
        cy.elements('.td-live').filter((element) => !ids.has(element.id())).remove();
        for (const element of elements) {
          const existing = cy.getElementById(element.data.id);
          if (existing.empty()) cy.add(element);
          else existing.data(element.data);
        }
      });
      relayout?.({ fit: false, reason: 'td-layer' });
    } finally {
      state.rendering = false;
      if (state.pending) {
        state.pending = false;
        refresh();
      }
    }
  };

  renderControl(currentControlsEl, state, refresh);
  refresh();
  return {
    refresh,
    setControlsElement(container) {
      currentControlsEl = container || null;
      renderControl(currentControlsEl, state, refresh);
    },
    cleanup: () => cy.elements(".td-live").remove(),
  };
}
