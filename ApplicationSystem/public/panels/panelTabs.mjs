// Nodevision/ApplicationSystem/public/panels/panelTabs.mjs
// This module owns per-panel tab collections for Nodevision workspace cells. It creates compact tab bars, preserves mounted content sessions where possible, and exposes generic operations for opening, activating, closing, reordering, moving, orienting, and serializing tabs.

import { setStatus } from "/StatusBar.mjs";
import { applyPanelTabContext } from "./panelTabContext.mjs";
import {
  buildPanelTabMetadata,
  normalizeTabOrientation,
  refreshPanelTabMetadata,
  serializePanelTab,
} from "./panelTabMetadata.mjs";
import { installPanelTabDrag, resolveTabDropIndex } from "./panelTabDrag.mjs";

const SYSTEM_CLASSES = new Set([
  "panel-edge-split-handle",
  "workspace-edge-split-handle",
  "panel-resize-placeholder",
]);

let tabSequence = 0;
let activeDropCell = null;

function nextTabId() {
  tabSequence += 1;
  return `panel-tab-${Date.now().toString(36)}-${tabSequence.toString(36)}`;
}

function isSystemChild(child) {
  if (!child?.classList) return false;
  if (child.classList.contains("nv-panel-tab-shell")) return true;
  if (child.classList.contains("panel-split-placeholder")) return true;
  return [...SYSTEM_CLASSES].some((className) => child.classList.contains(className));
}

function removeEmptyPlaceholders(cell) {
  Array.from(cell?.children || []).forEach((child) => {
    if (child.classList?.contains("panel-split-placeholder")) child.remove();
  });
}

function insertCellShell(cell, shell) {
  const firstSystem = Array.from(cell.children).find((child) =>
    child.classList?.contains("panel-edge-split-handle")
  );
  cell.insertBefore(shell, firstSystem || null);
}

function makeEmptyPlaceholder(cell) {
  const placeholder = document.createElement("div");
  placeholder.className = "panel-split-placeholder";
  placeholder.textContent = "Empty panel";
  cell.appendChild(placeholder);
}

function legacyContentChildren(cell) {
  return Array.from(cell?.children || []).filter((child) => !isSystemChild(child));
}

function adoptLegacyContentAsTab(state, legacyChildren = []) {
  if (!state || !legacyChildren.length) return null;
  const cell = state.cell;
  const panelType = cell.dataset.id || cell.dataset.panelId || "Panel";
  const panelClass = cell.dataset.panelClass || "InfoPanel";
  const filePath = cell.dataset.currentFilePath || "";
  const tab = {
    ...buildPanelTabMetadata({
      panelType,
      panelClass,
      panelVars: { filePath },
      tabId: nextTabId(),
    }),
    panelVars: { filePath },
  };
  tab.contentElement = createContentElement(tab);
  const cleanups = [cell.cleanup, ...legacyChildren.map((child) => child.cleanup)].filter((fn, index, arr) =>
    typeof fn === "function" && arr.indexOf(fn) === index
  );
  if (cleanups.length) {
    tab.cleanup = () => cleanups.forEach((cleanup) => {
      try { cleanup(); } catch (err) { console.warn("Legacy panel tab cleanup failed:", err); }
    });
    cell.cleanup = null;
  }
  legacyChildren.forEach((child) => tab.contentElement.appendChild(child));
  state.tabs.push(tab);
  state.stack.appendChild(tab.contentElement);
  state.activeTabId = tab.tabId;
  return tab;
}

function applyOrientation(state) {
  state.orientation = normalizeTabOrientation(state.orientation);
  state.cell.dataset.nvTabOrientation = state.orientation;
  state.shell.dataset.orientation = state.orientation;
  state.tabList.setAttribute("aria-orientation",
    state.orientation === "left" || state.orientation === "right" ? "vertical" : "horizontal");
}

export function ensurePanelTabs(cell, options = {}) {
  if (!cell?.classList?.contains?.("panel-cell")) return null;
  let state = cell.__nvPanelTabs;
  if (state?.shell?.isConnected) {
    state.orientation = normalizeTabOrientation(options.orientation || cell.dataset.nvTabOrientation || state.orientation);
    applyOrientation(state);
    return state;
  }

  const legacyChildren = legacyContentChildren(cell);
  removeEmptyPlaceholders(cell);
  const shell = document.createElement("div");
  shell.className = "nv-panel-tab-shell";
  const tabList = document.createElement("div");
  tabList.className = "nv-panel-tab-list";
  tabList.setAttribute("role", "tablist");
  const stack = document.createElement("div");
  stack.className = "nv-panel-tab-content-stack";
  shell.append(tabList, stack);
  insertCellShell(cell, shell);
  state = {
    cell,
    shell,
    tabList,
    stack,
    tabs: [],
    activeTabId: null,
    orientation: normalizeTabOrientation(options.orientation || cell.dataset.nvTabOrientation || "top"),
    dropIndex: -1,
  };
  cell.__nvPanelTabs = state;
  applyOrientation(state);
  adoptLegacyContentAsTab(state, legacyChildren);
  return state;
}

function tabById(state, tabId) {
  return state?.tabs?.find((tab) => tab.tabId === tabId) || null;
}

function composeCleanup(host, returnedCleanup) {
  const cleanups = [returnedCleanup, host.cleanup].filter((fn, index, arr) =>
    typeof fn === "function" && arr.indexOf(fn) === index
  );
  return () => {
    cleanups.forEach((cleanup) => {
      try { cleanup(); } catch (err) { console.warn("Panel tab cleanup failed:", err); }
    });
    host.cleanup = null;
  };
}

function createContentElement(tab) {
  const content = document.createElement("div");
  content.className = "nv-panel-tab-content";
  content.dataset.nvPanelTabId = tab.tabId;
  content.dataset.nvPanelType = tab.panelType;
  content.setAttribute("role", "tabpanel");
  content.setAttribute("tabindex", "0");
  content.setAttribute("aria-label", tab.fullDisplayName || tab.displayName || tab.panelType);
  if (tab.resourcePath) content.dataset.currentFilePath = tab.resourcePath;
  return content;
}

function setContentVisibility(state) {
  state.tabs.forEach((tab) => {
    const active = tab.tabId === state.activeTabId;
    tab.contentElement.hidden = !active;
    tab.contentElement.style.display = active ? "" : "none";
    tab.contentElement.setAttribute("aria-hidden", String(!active));
  });
}

function makeDropIndicator() {
  const indicator = document.createElement("div");
  indicator.className = "nv-panel-tab-drop-indicator";
  indicator.setAttribute("aria-hidden", "true");
  return indicator;
}

export function renderPanelTabs(cell) {
  const state = ensurePanelTabs(cell);
  if (!state) return;
  applyOrientation(state);
  state.tabList.innerHTML = "";
  const dragApi = { updateDragHover, finishDrag, clearDragHover };
  state.tabs.forEach((tab, index) => {
    if (state.dropIndex === index) state.tabList.appendChild(makeDropIndicator());
    const tabEl = document.createElement("div");
    tabEl.className = "nv-panel-tab";
    tabEl.dataset.nvPanelTabId = tab.tabId;
    tabEl.setAttribute("role", "tab");
    tabEl.setAttribute("tabindex", tab.tabId === state.activeTabId ? "0" : "-1");
    tabEl.setAttribute("aria-selected", String(tab.tabId === state.activeTabId));
    tabEl.title = tab.fullDisplayName || tab.displayName || tab.panelType;
    const label = document.createElement("span");
    label.className = "nv-panel-tab-label";
    label.textContent = tab.displayName || tab.panelType;
    const close = document.createElement("button");
    close.className = "nv-panel-tab-close";
    close.type = "button";
    close.textContent = "×";
    close.title = "Close tab";
    close.setAttribute("aria-label", `Close ${tab.displayName || tab.panelType}`);
    tabEl.append(label, close);
    tabEl.addEventListener("click", (event) => {
      if (event.target?.closest?.(".nv-panel-tab-close")) return;
      activatePanelTab(cell, tab.tabId);
    });
    tabEl.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        activatePanelTab(cell, tab.tabId);
      }
    });
    close.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      closePanelTab(cell, tab.tabId);
    });
    installPanelTabDrag(tabEl, cell, tab, dragApi);
    state.tabList.appendChild(tabEl);
  });
  if (state.dropIndex === state.tabs.length) state.tabList.appendChild(makeDropIndicator());
  state.shell.classList.toggle("nv-panel-tab-shell--empty", state.tabs.length === 0);
  state.shell.classList.toggle("nv-panel-tab-shell--single", state.tabs.length === 1);
  state.shell.classList.toggle("nv-panel-tab-shell--drop-target", state.dropIndex >= 0);
  setContentVisibility(state);
}

export function activatePanelTab(cell, tabId, options = {}) {
  const state = ensurePanelTabs(cell);
  const tab = tabById(state, tabId);
  if (!tab) return null;
  state.activeTabId = tab.tabId;
  setContentVisibility(state);
  applyPanelTabContext(cell, tab, options);
  renderPanelTabs(cell);
  tab.contentElement.__nvOnPanelTabActivate?.(tab);
  return tab;
}

export async function openPanelTabInCell(cell, descriptor, mountContent) {
  const state = ensurePanelTabs(cell, { orientation: descriptor?.tabOrientation });
  if (!state || typeof mountContent !== "function") return null;
  const metadata = buildPanelTabMetadata({ ...descriptor, tabId: descriptor.tabId || nextTabId() });
  if (!descriptor.allowDuplicate) {
    const existing = state.tabs.find((tab) => tab.identityKey === metadata.identityKey);
    if (existing) return activatePanelTab(cell, existing.tabId, { announce: false });
  }
  const tab = { ...metadata, panelVars: { ...(descriptor.panelVars || {}) } };
  tab.contentElement = createContentElement(tab);
  const index = Math.max(0, Math.min(descriptor.index ?? state.tabs.length, state.tabs.length));
  state.tabs.splice(index, 0, tab);
  state.stack.appendChild(tab.contentElement);
  activatePanelTab(cell, tab.tabId, { announce: false });
  const previousActiveCell = window.activeCell;
  window.activeCell = tab.contentElement;
  try {
    const cleanup = await mountContent(tab.contentElement, tab.panelVars, tab);
    tab.cleanup = composeCleanup(tab.contentElement, cleanup);
  } finally {
    window.activeCell = cell || previousActiveCell;
  }
  refreshPanelTabMetadata(tab, cell);
  activatePanelTab(cell, tab.tabId, { announce: false });
  return tab;
}

function tabLooksDirty(tab, state = null) {
  const isEditor = /editor/i.test(tab.panelType || "") || /editor/i.test(tab.panelClass || "");
  if (!isEditor) return false;
  const session = tab.contentElement?.__nvCodeEditorSession;
  if (session?.dirty) return true;
  const active = !state || tab.tabId === state.activeTabId;
  return active && Boolean(window.__nvCodeEditorDirty || window.NodevisionState?.fileIsDirty);
}

function destroyTab(state, tab) {
  const index = state.tabs.indexOf(tab);
  tab.cleanup?.();
  tab.contentElement.remove();
  state.tabs.splice(index, 1);
  if (state.activeTabId === tab.tabId) {
    const next = state.tabs[Math.max(0, index - 1)] || state.tabs[index] || null;
    state.activeTabId = next?.tabId || null;
    if (next) activatePanelTab(state.cell, next.tabId, { announce: false });
  }
  if (!state.tabs.length) emptyPanelTabs(state.cell);
  else renderPanelTabs(state.cell);
}

export function closePanelTab(cell, tabId, options = {}) {
  const state = ensurePanelTabs(cell);
  const tab = tabById(state, tabId || state.activeTabId);
  if (!tab) return false;
  if (!options.force && tabLooksDirty(tab, state) && window.__nvGuardEditorSwitch) {
    if (tab.tabId !== state.activeTabId) activatePanelTab(cell, tab.tabId, { announce: false });
    window.__nvGuardEditorSwitch(tab.resourcePath || "", () => destroyTab(state, tab));
    return false;
  }
  destroyTab(state, tab);
  return true;
}

export function emptyPanelTabs(cell) {
  const state = cell?.__nvPanelTabs;
  if (state?.shell?.isConnected) state.shell.remove();
  delete cell.__nvPanelTabs;
  delete cell.dataset.currentPanelTabId;
  delete cell.dataset.currentFilePath;
  cell.dataset.id = "EmptyPanel";
  cell.dataset.panelId = "EmptyPanel";
  cell.dataset.panelClass = "InfoPanel";
  removeEmptyPlaceholders(cell);
  makeEmptyPlaceholder(cell);
  setStatus("Panel empty", cell.dataset.id || "Panel");
}

export function closePanelTabsInCell(cell, options = {}) {
  const state = cell?.__nvPanelTabs;
  if (!state) return;
  [...state.tabs].forEach((tab) => closePanelTab(cell, tab.tabId, { ...options, force: true }));
}

export function getActivePanelTab(cell) {
  const state = cell?.__nvPanelTabs;
  return tabById(state, state?.activeTabId);
}

export function setPanelTabOrientation(cell, orientation) {
  const state = ensurePanelTabs(cell, { orientation });
  if (!state) return "top";
  state.orientation = normalizeTabOrientation(orientation);
  applyOrientation(state);
  renderPanelTabs(cell);
  setStatus("Panel tabs", `Tabs ${state.orientation}`);
  return state.orientation;
}

export function serializePanelTabsForCell(cell) {
  const state = cell?.__nvPanelTabs;
  if (!state?.tabs?.length) return null;
  return {
    tabOrientation: state.orientation,
    activeTabId: state.activeTabId,
    tabs: state.tabs.map(serializePanelTab),
  };
}

export function findPanelTabMatch(descriptor = {}) {
  const metadata = buildPanelTabMetadata(descriptor);
  for (const cell of document.querySelectorAll(".panel-cell")) {
    const tab = cell.__nvPanelTabs?.tabs?.find((candidate) => candidate.identityKey === metadata.identityKey);
    if (tab) return { cell, tab };
  }
  return null;
}

export function findCellWithPanelTab(panelType) {
  const clean = String(panelType || "");
  return Array.from(document.querySelectorAll(".panel-cell")).find((cell) =>
    cell.__nvPanelTabs?.tabs?.some((tab) => tab.panelType === clean)
  ) || null;
}

function tabDropTargetFromEvent(event) {
  const elements = document.elementsFromPoint(event.clientX, event.clientY);
  const tabList = elements
    .map((el) => el.closest?.(".nv-panel-tab-list"))
    .find(Boolean);
  if (tabList) return { cell: tabList.closest(".panel-cell"), tabList };

  const cell = elements
    .map((el) => el.closest?.(".panel-cell"))
    .find(Boolean);
  if (!cell) return null;
  return { cell, tabList: cell.__nvPanelTabs?.tabList || null };
}

function dropIndexForState(state, tabList, event) {
  if (!state?.tabs) return -1;
  const tabListVisible = Boolean(tabList?.getClientRects?.().length);
  if (!tabListVisible) return state.tabs.length;
  return resolveTabDropIndex(tabList, event);
}

function updateDragHover(event) {
  const target = tabDropTargetFromEvent(event);
  if (!target?.cell) return clearDragHover();
  const { cell, tabList } = target;
  const state = cell.__nvPanelTabs || null;
  if (activeDropCell && activeDropCell !== cell) clearDragHover();
  activeDropCell = cell;
  if (!state) {
    cell.classList?.add("nv-panel-tab-cell--drop-target");
    return;
  }
  const index = dropIndexForState(state, tabList, event);
  state.dropIndex = index;
  state.tabList.classList.add("nv-panel-tab-list--drop-target");
  renderPanelTabs(cell);
}

function clearDragHover() {
  if (!activeDropCell) return;
  const cell = activeDropCell;
  const state = cell.__nvPanelTabs || null;
  cell.classList?.remove("nv-panel-tab-cell--drop-target");
  if (state) {
    state.dropIndex = -1;
    state.tabList.classList.remove("nv-panel-tab-list--drop-target");
    state.shell.classList.remove("nv-panel-tab-shell--drop-target");
    renderPanelTabs(cell);
  }
  activeDropCell = null;
}

function finishDrag(drag, event) {
  if (!activeDropCell && event) updateDragHover(event);
  const targetCell = activeDropCell;
  if (!drag?.sourceCell || !targetCell) return;
  const targetState = targetCell.__nvPanelTabs || ensurePanelTabs(targetCell);
  if (!targetState) return;
  movePanelTab(drag.sourceCell, drag.tabId, targetCell, targetState.dropIndex);
}

function notifyPanelTabMoved(tab, sourceCell, targetCell) {
  const detail = { tab, sourceCell, targetCell, panelType: tab?.panelType || "" };
  tab?.contentElement?.dispatchEvent?.(new CustomEvent("nv-panel-tab-moved", { bubbles: true, detail }));
  window.dispatchEvent(new CustomEvent("nv-panel-tab-moved", { detail }));
  tab?.contentElement?.dispatchEvent?.(new CustomEvent("nv-panel-content-bounds-changed", { bubbles: true, detail }));
  window.dispatchEvent(new CustomEvent("nv-panel-content-bounds-changed", { detail }));
  window.dispatchEvent(new Event("resize"));
}

export function movePanelTab(sourceCell, tabId, targetCell, rawIndex = -1) {
  const sourceState = sourceCell?.__nvPanelTabs;
  const tab = tabById(sourceState, tabId);
  if (!tab) return null;

  const sourceIndex = sourceState.tabs.indexOf(tab);
  if (sourceIndex < 0) return null;

  const targetState = ensurePanelTabs(targetCell);
  if (!targetState?.stack) return null;

  let index = rawIndex < 0 ? targetState.tabs.length : rawIndex;
  if (sourceState === targetState) {
    sourceState.tabs.splice(sourceIndex, 1);
    if (sourceIndex < index) index -= 1;
    index = Math.max(0, Math.min(index, sourceState.tabs.length));
    sourceState.tabs.splice(index, 0, tab);
    renderPanelTabs(sourceCell);
    const activated = activatePanelTab(sourceCell, tab.tabId, { announce: false });
    notifyPanelTabMoved(tab, sourceCell, sourceCell);
    return activated;
  }

  index = Math.max(0, Math.min(index, targetState.tabs.length));
  targetState.tabs.splice(index, 0, tab);
  targetState.stack.appendChild(tab.contentElement);

  sourceState.tabs.splice(sourceIndex, 1);
  if (sourceState.activeTabId === tab.tabId) {
    const nextSourceTab = sourceState.tabs[Math.max(0, sourceIndex - 1)] || sourceState.tabs[sourceIndex] || null;
    sourceState.activeTabId = nextSourceTab?.tabId || null;
  }

  if (!sourceState.tabs.length) emptyPanelTabs(sourceCell);
  else renderPanelTabs(sourceCell);

  const activated = activatePanelTab(targetCell, tab.tabId, { announce: false });
  notifyPanelTabMoved(tab, sourceCell, targetCell);
  return activated;
}

export function panelTabContentIsActive(node) {
  const content = node?.closest?.(".nv-panel-tab-content");
  if (!content) return true;
  const state = content.closest?.(".panel-cell")?.__nvPanelTabs;
  return Boolean(state && state.activeTabId === content.dataset.nvPanelTabId);
}

if (typeof window !== "undefined") {
  window.__nvPanelTabContentIsActive = panelTabContentIsActive;
}
