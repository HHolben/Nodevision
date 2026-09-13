// Nodevision/ApplicationSystem/public/panels/workspaceParts/workspaceSerialization.mjs
// This module serializes visible Nodevision workspace rows and panel tab state for layout saving.

import { getActivePanelTab, serializePanelTabsForCell } from "../panelTabs.mjs";

function serializableLayoutChildren(node) {
  return Array.from(node?.children || []).filter((child) => child.classList?.contains("panel-row") || child.classList?.contains("panel-cell"));
}

function serializeWorkspaceNode(node) {
  if (!node) return null;
  if (node.classList?.contains("panel-row")) {
    const direction = node.dataset.direction || (node.dataset.isVertical === "1" ? "column" : "row");
    return { type: direction === "column" ? "vertical" : "row", direction, flex: node.style.flex || "", children: serializableLayoutChildren(node).map(serializeWorkspaceNode).filter(Boolean) };
  }
  if (node.classList?.contains("panel-cell")) {
    const tabState = serializePanelTabsForCell(node);
    const activeTab = getActivePanelTab(node);
    return {
      type: "cell", id: node.dataset.panelId || node.dataset.id || "Panel",
      panelType: activeTab?.panelType || node.dataset.id || node.dataset.panelId || "Panel",
      panelClass: activeTab?.panelClass || node.dataset.panelClass || "InfoPanel",
      flex: node.style.flex || "", tabOrientation: tabState?.tabOrientation || node.dataset.nvTabOrientation || "top",
      ...(tabState || {}),
    };
  }
  return null;
}

export function serializeWorkspace(workspace) {
  const children = serializableLayoutChildren(workspace);
  if (children.length === 1) return serializeWorkspaceNode(children[0]);
  return { type: "row", direction: "column", children: children.map(serializeWorkspaceNode).filter(Boolean) };
}
