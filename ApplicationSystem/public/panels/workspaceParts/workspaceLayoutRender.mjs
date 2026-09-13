// Nodevision/ApplicationSystem/public/panels/workspaceParts/workspaceLayoutRender.mjs
// This module loads and renders serialized Nodevision workspace layouts into rows, cells, tabs, and panel modules.

import { activatePanelTab } from "../panelTabs.mjs";
import { ensurePanelEdgeSplitHandles } from "./workspaceEdgeHandles.mjs";
import { loadPanelIntoCell, loadPanelIntoSpecificCell } from "./workspacePanelLoader.mjs";
import { rebuildLayoutDividersForContainer } from "./workspaceDividers.mjs";
import { normalizePanelIdentifier, toFlexValue, toPanelCssSlug } from "./workspacePrimitives.mjs";

export async function loadDefaultLayout() {
  try {
    const res = await fetch("/UserSettings/DefaultLayout.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const raw = await res.text();
    console.log("Fetched layout file (raw):", raw);
    const json = JSON.parse(raw);
    const layout = json.workspace || json.layout || json;
    console.log("Parsed layout object:", layout);
    return layout;
  } catch (err) {
    console.warn("Failed to load DefaultLayout.json:", err);
    return null;
  }
}

function applyCellStyle(cell, node, normalizedCellId, requestedCellId) {
  const panelCssSlug = toPanelCssSlug(normalizedCellId || requestedCellId);
  cell.className = `panel-cell panel-cell--${panelCssSlug}`;
  cell.dataset.panelId = normalizedCellId || requestedCellId;
  cell.dataset.panelSlug = panelCssSlug;
  Object.assign(cell.style, {
    border: "1px solid #bbb", background: "#fafafa", overflow: "auto", display: "flex",
    flexDirection: "column", position: "relative", minHeight: "0", minWidth: "0",
  });
  const explicitFlex = toFlexValue(node.flex);
  if (explicitFlex) cell.style.flex = explicitFlex;
  cell.dataset.id = normalizedCellId || requestedCellId;
  cell.dataset.panelClass = node.panelClass || "InfoPanel";
  if (node.tabOrientation || node.tabsOrientation) cell.dataset.nvTabOrientation = node.tabOrientation || node.tabsOrientation;
}

async function restorePanelTabsForCell(cell, node = {}) {
  const tabs = Array.isArray(node.tabs) ? node.tabs : [];
  if (!cell || !tabs.length) return;
  const activeTabId = node.activeTabId || tabs[0]?.tabId || "";
  for (let index = 0; index < tabs.length; index += 1) {
    const tab = tabs[index] || {};
    const tabPanelType = normalizePanelIdentifier(tab.panelType || tab.panelId || tab.id) || tab.panelType || tab.panelId || tab.id;
    if (!tabPanelType) continue;
    await loadPanelIntoSpecificCell(cell, tabPanelType, {
      ...(tab.panelVars || {}), id: tabPanelType, displayName: tab.displayName || tabPanelType,
      panelClass: tab.panelClass || node.panelClass || "InfoPanel",
      tabOrientation: node.tabOrientation || node.tabsOrientation || "top",
      allowDuplicateTab: true, __nvTabId: tab.tabId, __nvTabIndex: index,
    });
  }
  if (activeTabId) activatePanelTab(cell, activeTabId, { announce: false });
}

export function renderLayout(node, parent, options = {}) {
  const loadPromises = options.loadPromises || [];
  const isRootRender = !options.loadPromises;
  const isContainer = node.direction || node.type === "row" || node.type === "vertical";
  if (isContainer && node.children) {
    const container = document.createElement("div");
    container.className = "panel-row";
    const direction = node.direction === "column" || node.type === "vertical" ? "column" : "row";
    const isVertical = direction === "column";
    Object.assign(container.style, { display: "flex", flexDirection: direction, overflow: "hidden", flex: node.flex ? `${node.flex} 1 0` : "1 1 auto", alignItems: "stretch", minHeight: "0", minWidth: "0" });
    container.dataset.direction = direction;
    container.dataset.isVertical = isVertical ? "1" : "0";
    parent.appendChild(container);
    node.children.forEach((child) => renderLayout(child, container, { ...options, loadPromises }));
    const children = Array.from(container.children).filter((c) => c.classList.contains("panel-cell") || c.classList.contains("panel-row"));
    console.log(`Layout: Adding dividers: ${children.length} children in ${direction} container`);
    const inserted = rebuildLayoutDividersForContainer(container, isVertical);
    if (inserted > 0) console.log(`Layout: Inserted ${isVertical ? "vertical" : "horizontal"} divider(s) for ${children.length} children`);
  } else if (node.instanceName || node.type === "cell") {
    const requestedCellId = node.instanceName || node.id;
    const normalizedCellId = normalizePanelIdentifier(requestedCellId);
    const cell = document.createElement("div");
    applyCellStyle(cell, node, normalizedCellId, requestedCellId);
    parent.appendChild(cell);
    ensurePanelEdgeSplitHandles(cell);
    window.activeCell = cell;
    const requestedPanelType = node.panelType || node.instanceName || (node.module ? String(node.module).split("/").pop().replace(/\.mjs$/, "") : "InfoPanel");
    const panelType = normalizePanelIdentifier(requestedPanelType) || requestedPanelType;
    if (Array.isArray(node.tabs) && node.tabs.length) {
      loadPromises.push(Promise.resolve(restorePanelTabsForCell(cell, node).catch((err) => console.warn("Failed to restore panel tabs:", err))));
      return isRootRender ? Promise.allSettled(loadPromises) : loadPromises;
    }
    if (node.deferLoad !== true) {
      loadPromises.push(Promise.resolve(loadPanelIntoCell(panelType, {
        id: normalizedCellId || requestedCellId, displayName: node.displayName || normalizedCellId || requestedCellId,
        tabOrientation: node.tabOrientation || node.tabsOrientation || "top", ...node.panelVars,
      })));
    }
  }
  return isRootRender ? Promise.allSettled(loadPromises) : loadPromises;
}
