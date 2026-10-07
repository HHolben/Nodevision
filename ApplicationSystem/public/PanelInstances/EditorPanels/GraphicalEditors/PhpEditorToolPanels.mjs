// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/PhpEditorToolPanels.mjs
// This module opens the PHP auxiliary panels and builds logic and dashboard configuration lists.
import { createPanelDOM } from '/panels/panelFactory.mjs';
import { ensureDefaultBlocks, ensureDefaultWidgets } from './PhpEditorState.mjs';
import { buildDeviceManagerPanel } from './PhpEditorDevicePanel.mjs';
import { buildLoggerPanel } from './PhpEditorLogging.mjs';

export const PHP_TOOL_PANEL_INSTANCE = {
  devices: "nv-php-device-manager-panel",
  logic: "nv-php-logic-editor-panel",
  dashboard: "nv-php-dashboard-config-panel",
  logging: "nv-php-logging-panel"
};

export function buildLogicPanel(state, panel) {
  panel.innerHTML = "";
  ensureDefaultBlocks(state);
  const card = document.createElement("div");
  card.className = "nv-php-card";
  card.innerHTML = `<h3>Logic Blocks (Visual Scaffold)</h3>`;
  panel.appendChild(card);
  const list = document.createElement("ul");
  list.className = "nv-php-list";
  card.appendChild(list);
  state.logic.blocks.forEach((block) => {
    const li = document.createElement("li");
    li.textContent = `${block.id}: ${block.type}`;
    list.appendChild(li);
  });
}

export function buildDashboardPanel(state, panel) {
  panel.innerHTML = "";
  ensureDefaultWidgets(state);
  const card = document.createElement("div");
  card.className = "nv-php-card";
  card.innerHTML = `<h3>Dashboard Widgets</h3>`;
  panel.appendChild(card);
  const list = document.createElement("ul");
  list.className = "nv-php-list";
  card.appendChild(list);
  state.dashboard.widgets.forEach((widget) => {
    const li = document.createElement("li");
    li.textContent = `${widget.id}: ${widget.type} <- ${widget.source}`;
    list.appendChild(li);
  });
}

export async function openPhpToolPanel(kind, state) {
  const panelId = PHP_TOOL_PANEL_INSTANCE[kind];
  if (!panelId) return null;

  const titleByKind = {
    devices: "PHP Device Management",
    logic: "PHP Logic Blocks",
    dashboard: "PHP Dashboard Config",
    logging: "PHP Data Logging"
  };

  const builderByKind = {
    devices: () => buildDeviceManagerPanel(state, content),
    logic: () => buildLogicPanel(state, content),
    dashboard: () => buildDashboardPanel(state, content),
    logging: () => buildLoggerPanel(state, content)
  };

  const existing = document.querySelector(`.panel[data-instance-id="${panelId}"]`);
  let content = existing?.querySelector?.(".panel-content");
  if (!content) {
    const panelInst = await createPanelDOM(
      "PHPToolPanel",
      panelId,
      "InfoPanel",
      { displayName: titleByKind[kind] || "PHP Tools" }
    );
    document.body.appendChild(panelInst.panel);
    panelInst.panel.__nvDefaultDockCell = (
      window.activeCell && window.activeCell.classList?.contains("panel-cell")
    ) ? window.activeCell : null;
    if (panelInst.dockBtn && typeof panelInst.dockBtn.click === "function") {
      panelInst.dockBtn.click();
    }
    panelInst.panel.style.width = "min(520px, 90vw)";
    panelInst.panel.style.height = "auto";
    panelInst.panel.style.maxHeight = "min(620px, 86vh)";
    panelInst.panel.style.left = `${Math.max(20, Math.round(window.innerWidth * 0.2))}px`;
    panelInst.panel.style.top = `${Math.max(20, Math.round(window.innerHeight * 0.12))}px`;
    panelInst.panel.style.zIndex = "23000";
    panelInst.content.style.padding = "10px";
    panelInst.content.style.background = "#f8f8f8";
    panelInst.content.style.overflow = "auto";
    panelInst.content.innerHTML = "";
    content = panelInst.content;
  }

  const builder = builderByKind[kind];
  if (typeof builder === "function") {
    return builder();
  }
  return null;
}
