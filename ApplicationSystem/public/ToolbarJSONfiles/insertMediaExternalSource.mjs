// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/insertMediaExternalSource.mjs
// Narrow Insert Media helper for handing existing/external source forms to the docked Web Resource Browser.

import {
  WEB_RESOURCE_BROWSER_INTENTS,
  normalizeWebResourceBrowserInvocation,
  originContextIsAvailable,
  resourceReferenceToSourceValue,
  resourceTypeMatchesInvocation,
} from "/Resources/WebResourceBrowserContext.mjs";
import { setStatus as setStatusBar } from "/StatusBar.mjs";
import { ensureAdjacentPanelCell } from "/panels/workspace.mjs";
import {
  logWebResourcePlacementDiagnostics,
  scheduleWebResourceVisibilityDiagnostics,
  serializeWebResourceLayoutTree,
} from "/Resources/WebResourceBrowserVisibilityDiagnostics.mjs";
import {
  describeInsertMediaOriginCell,
  getInsertMediaOriginContext,
  isInsertMediaBrowserCell,
  resolveInsertMediaOriginCell,
  snapshotInsertMediaOriginContext,
} from "./insertMediaPanel.mjs";

function selectedRadioValue(root, name) {
  return Array.from(root?.querySelectorAll?.(`input[name="${name}"]`) || []).find((node) => node.checked)?.value || "";
}

export function setRadioValue(root, name, value) {
  const radios = Array.from(root?.querySelectorAll?.(`input[name="${name}"]`) || []);
  const match = radios.find((node) => node.value === value) || radios[0];
  if (!match) return false;
  match.checked = true;
  match.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

function fieldValue(root, selector) {
  const node = root?.querySelector?.(selector);
  if (!node) return "";
  if (node.type === "checkbox") return Boolean(node.checked);
  return String(node.value ?? "");
}

function setFieldValue(root, selector, value) {
  const node = root?.querySelector?.(selector);
  if (!node) return false;
  if (node.type === "checkbox") node.checked = Boolean(value);
  else node.value = String(value ?? "");
  node.dispatchEvent(new Event("input", { bubbles: true }));
  node.dispatchEvent(new Event("change", { bubbles: true }));
  return true;
}

export function captureNamedInsertMediaState(root, config = {}) {
  const fields = {};
  for (const [key, selector] of Object.entries(config.fields || {})) fields[key] = fieldValue(root, selector);
  const radios = {};
  for (const [key, name] of Object.entries(config.radios || {})) radios[key] = selectedRadioValue(root, name);
  return {
    fields,
    radios,
    fallbacks: config.fallbackList?.getFallbacks?.() || [],
  };
}

export function restoreNamedInsertMediaState(root, state = {}, config = {}) {
  for (const [key, name] of Object.entries(config.radios || {})) {
    if (state.radios && Object.prototype.hasOwnProperty.call(state.radios, key)) setRadioValue(root, name, state.radios[key]);
  }
  for (const [key, selector] of Object.entries(config.fields || {})) {
    if (state.fields && Object.prototype.hasOwnProperty.call(state.fields, key)) setFieldValue(root, selector, state.fields[key]);
  }
  config.fallbackList?.setFallbacks?.(state.fallbacks || []);
}

export function populateExistingSourceFromResource(root, resource, { sourceSelector = "[data-field=\"existingSource\"]", fallbackList = null } = {}) {
  const sourceValue = resourceReferenceToSourceValue(resource);
  const sourceInput = root?.querySelector?.(sourceSelector);
  if (sourceInput) {
    sourceInput.value = sourceValue;
    delete sourceInput.dataset.localFile;
    sourceInput.dispatchEvent(new Event("input", { bubbles: true }));
    sourceInput.dispatchEvent(new Event("change", { bubbles: true }));
  }
  if (fallbackList && Array.isArray(resource?.fallbacks)) fallbackList.setFallbacks(resource.fallbacks);
  return sourceValue;
}

export function createBrowseWebButton(label = "Browse Web...") {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.dataset.action = "browse-web-resource";
  button.style.font = "12px monospace";
  button.style.padding = "6px 10px";
  button.style.border = "1px solid #333";
  button.style.background = "#eee";
  button.style.cursor = "pointer";
  return button;
}

function closestPanel(root) {
  return root?.closest?.(".panel") || null;
}

function connectedPanelCell(candidate) {
  const cell = candidate?.classList?.contains?.("panel-cell")
    ? candidate
    : candidate?.closest?.(".panel-cell");
  return cell?.isConnected ? cell : null;
}

export function originCellFromPanel(panel, root = null, originContext = null) {
  return resolveInsertMediaOriginCell(originContext || getInsertMediaOriginContext(root || panel) || {}) ||
    connectedPanelCell(panel?.__nvDefaultDockCell) ||
    connectedPanelCell(window.HTMLWysiwygTools?.getEditorElement?.()) ||
    connectedPanelCell(root) ||
    connectedPanelCell(panel) ||
    connectedPanelCell(document.querySelector?.(".panel-cell.active-panel")) ||
    connectedPanelCell(window.activeCell) ||
    null;
}

function tabListForCell(cell) {
  return Array.from(cell?.__nvPanelTabs?.tabs || []).map((tab) => tab.panelType || tab.panelId || tab.id || tab.displayName || "");
}

function activeTabForCell(cell) {
  const state = cell?.__nvPanelTabs;
  return state?.tabs?.find?.((tab) => tab.tabId === state.activeTabId) || null;
}

function cellLabel(cell) {
  if (!cell) return "(none)";
  if (!cell.dataset.nvWebResourceDebugCellId) {
    const cells = Array.from(document.querySelectorAll?.(".panel-cell") || []);
    const index = Math.max(0, cells.indexOf(cell));
    cell.dataset.nvWebResourceDebugCellId = "cell-" + String(index + 1);
  }
  const rect = typeof cell.getBoundingClientRect === "function" ? cell.getBoundingClientRect() : null;
  const size = rect ? `${Math.round(rect.width)}x${Math.round(rect.height)}` : "unknown-size";
  return `${cell.dataset.nvWebResourceDebugCellId} id=${cell.dataset.id || cell.dataset.panelId || ""} tabs=[${tabListForCell(cell).join(",")}] active=${activeTabForCell(cell)?.panelType || ""} size=${size} hidden=${cell.hidden ? "yes" : "no"} display=${cell.style?.display || ""}`;
}

function viewportSnapshot() {
  return {
    width: Math.round(window.innerWidth || document.documentElement?.clientWidth || 0),
    height: Math.round(window.innerHeight || document.documentElement?.clientHeight || 0),
  };
}

function placementDescription(cell) {
  return {
    label: cellLabel(cell),
    description: describeInsertMediaOriginCell(cell),
    viewport: viewportSnapshot(),
  };
}

function findExistingBrowserCell(excludeCell = null) {
  const browserCells = Array.from(document.querySelectorAll(".panel-cell")).filter((cell) => {
    if (cell === excludeCell) return false;
    if (cell.dataset?.id === "WebResourceBrowserPanel" || cell.dataset?.panelId === "WebResourceBrowserPanel") return true;
    return tabListForCell(cell).includes("WebResourceBrowserPanel") || Boolean(cell.querySelector?.("[data-web-resource-browser-panel=\"true\"]"));
  });
  return browserCells[0] || null;
}

function browserCellFor(originCell) {
  const existing = findExistingBrowserCell(originCell);
  if (existing) return { cell: existing, didCreate: false, reused: "existing-browser" };
  return ensureAdjacentPanelCell({
    originCell,
    panelId: "WebResourceBrowserPanel",
    panelClass: "InfoPanel",
    edge: "right",
    splitPercent: 68,
    reuseExistingPanel: false,
    reuseAdjacentSibling: true,
  });
}

function logPlacement(label, detail = {}) {
  try {
    console.info("[NV-WEB-RESOURCE] " + label, detail);
  } catch {
    // Diagnostics should never interrupt Insert Media.
  }
}

function reportLaunchFailure(err, options = {}) {
  const detail = err instanceof Error ? err : new Error(String(err || "Unknown error"));
  const message = "Unable to open Web Resource Browser.";
  console.warn("[insertMediaExternalSource] " + message, detail);
  options.onStatus?.((message + " " + (detail.message || "")).trim(), true);
  setStatusBar?.(message, detail.message || "");
  return null;
}

export function attachInsertMediaBrowseWebHandler(button, buildOptions, { setStatus = null, launcher = launchInsertMediaWebResourceBrowser } = {}) {
  if (!button || typeof buildOptions !== "function") return false;
  button.type = "button";
  button.addEventListener("click", async (event) => {
    event.preventDefault?.();
    event.stopPropagation?.();
    setStatus?.("Opening Web Resource Browser...");
    try {
      const result = await launcher(buildOptions());
      if (!result) setStatus?.("Unable to open Web Resource Browser.");
      return result;
    } catch (err) {
      const detail = err instanceof Error ? err : new Error(String(err || "Unknown error"));
      console.warn("[insertMediaExternalSource] Browse Web click failed", detail);
      setStatus?.(("Unable to open Web Resource Browser. " + (detail.message || "")).trim(), true);
      setStatusBar?.("Unable to open Web Resource Browser.", detail.message || "");
      return null;
    }
  });
  return true;
}

export async function launchInsertMediaWebResourceBrowser(options = {}) {
  try {
    const root = options.root;
    const panel = closestPanel(root);
    const capturedOriginContext = options.originContext || getInsertMediaOriginContext(root || panel) || {};
    const originCell = originCellFromPanel(panel, root, capturedOriginContext);
    if (!originCell) throw new Error("Insert Media origin workspace cell is no longer available.");
    if (isInsertMediaBrowserCell(originCell)) {
      throw new Error("Insert Media origin resolved to WebResourceBrowserPanel; refusing recursive browser split.");
    }
    const originSnapshot = snapshotInsertMediaOriginContext(originCell, {
      ...capturedOriginContext,
      originEditorPath: capturedOriginContext.originEditorPath || options.originEditorPath || "",
      targetMode: capturedOriginContext.targetMode || options.targetMode || window.NodevisionState?.currentMode || "",
      mediaFamily: capturedOriginContext.mediaFamily || options.mediaFamily || "",
    });
    originSnapshot.originCell = originCell;
    window.HTMLWysiwygTools?.saveCurrentSelection?.();

    const invocation = normalizeWebResourceBrowserInvocation({
      intent: WEB_RESOURCE_BROWSER_INTENTS.INSERT_MEDIA,
      resourceType: options.resourceType,
      mediaFamily: options.mediaFamily,
      sourceMode: options.sourceMode || "existing",
      originPanelId: panel?.dataset?.instanceId || "",
      originCellId: originSnapshot.originCellId,
      originTabId: originSnapshot.originTabId,
      originPanelType: originSnapshot.originPanelType,
      originPanelClass: originSnapshot.originPanelClass,
      originEditorPath: originSnapshot.originEditorPath || options.originEditorPath || "",
      targetMode: originSnapshot.targetMode || options.targetMode || window.NodevisionState?.currentMode || "",
      insertMediaState: options.insertMediaState || {},
      insertMediaOriginContext: originSnapshot,
    });

    const reopen = async (resource = null) => {
      const availability = originContextIsAvailable(invocation);
      if (!availability.ok) {
        const message = availability.reason || "The original insertion target is no longer available.";
        options.onStatus?.(message, true);
        setStatusBar?.(message);
        return false;
      }
      window.HTMLWysiwygTools?.restoreSavedSelection?.();
      await options.reopenInsertMedia?.({ invocation, resource });
      return true;
    };

    if (typeof window.__nvOpenPanelTab !== "function") {
      throw new Error("Workspace tab opener is unavailable.");
    }

    const layoutBefore = serializeWebResourceLayoutTree(originCell.closest?.("#workspace") || document.getElementById?.("workspace"));
    logPlacement("origin cell", {
      context: invocation.insertMediaOriginContext,
      ...placementDescription(originCell),
    });
    const placement = browserCellFor(originCell);
    const targetCell = placement?.cell || null;
    if (!targetCell?.classList?.contains("panel-cell") || targetCell === originCell) {
      throw new Error("No separate workspace panel cell was available for the Web Resource Browser.");
    }
    logPlacement("destination cell", {
      ...placementDescription(targetCell),
      destinationCreated: Boolean(placement?.didCreate),
      reused: placement?.reused || "",
    });
    logWebResourcePlacementDiagnostics("placement", {
      originCell,
      destinationCell: targetCell,
      workspaceRoot: originCell.closest?.("#workspace") || targetCell.closest?.("#workspace") || document.getElementById?.("workspace"),
      destinationParent: targetCell.parentElement,
      placement: {
        destinationCreated: Boolean(placement?.didCreate),
        reused: placement?.reused || "",
      },
      invocation,
      layoutBefore,
      splitApi: {
        functionName: "ensureAdjacentPanelCell",
        caller: "launchInsertMediaWebResourceBrowser",
        arguments: {
          panelId: "WebResourceBrowserPanel",
          panelClass: "InfoPanel",
          edge: "right",
          splitPercent: 68,
          reuseExistingPanel: false,
          reuseAdjacentSibling: true,
        },
        originalDesign: "workspace helper that reuses an existing non-editor adjacent panel or creates a visible flex split beside the origin cell",
      },
    });
    const tabsBefore = tabListForCell(targetCell);
    const activeBefore = activeTabForCell(targetCell)?.panelType || "";
    logPlacement("tab state before", { tabCountBefore: tabsBefore.length, tabsBefore, activeTabBefore: activeBefore });

    const panelVars = {
      displayName: "Find Resource",
      invocation,
      resourceType: invocation.resourceType,
      lockedResourceType: true,
      closeOnUse: false,
      onResourceSelected: async (resource) => {
        if (!resourceTypeMatchesInvocation(resource, invocation)) {
          const message = (invocation.mediaFamily || "Insert Media") + " needs a " + invocation.resourceType + " resource.";
          options.onStatus?.(message, true);
          setStatusBar?.(message);
          return false;
        }
        return await reopen(resource);
      },
      onCancel: async () => reopen(null),
    };

    const opened = await window.__nvOpenPanelTab(targetCell, "WebResourceBrowserPanel", "InfoPanel", panelVars);
    if (!opened) throw new Error("Workspace rejected the Web Resource Browser tab.");
    const tabsAfter = tabListForCell(targetCell);
    const activeAfter = activeTabForCell(targetCell);
    logPlacement("tab state after", {
      tabCountAfter: tabsAfter.length,
      tabsAfter,
      activeTabAfter: activeAfter?.panelType || "",
      openedTabId: opened?.tabId || "",
      destinationCell: placementDescription(targetCell),
      originCell: placementDescription(originCell),
    });
    const browserRoot = targetCell.querySelector?.("[data-web-resource-browser-panel=\"true\"]") || activeAfter?.contentElement?.querySelector?.("[data-web-resource-browser-panel=\"true\"]") || null;
    scheduleWebResourceVisibilityDiagnostics("post-open visibility", {
      originCell,
      destinationCell: targetCell,
      browserRoot,
      workspaceRoot: originCell.closest?.("#workspace") || targetCell.closest?.("#workspace") || document.getElementById?.("workspace"),
      destinationParent: targetCell.parentElement,
      placement: {
        destinationCreated: Boolean(placement?.didCreate),
        reused: placement?.reused || "",
        tabCountAfter: tabsAfter.length,
        activeTabAfter: activeAfter?.panelType || "",
        openedTabId: opened?.tabId || "",
      },
      invocation,
      layoutBefore,
      splitApi: { functionName: "ensureAdjacentPanelCell", caller: "launchInsertMediaWebResourceBrowser" },
    });
    if (panel?.parentNode) panel.parentNode.removeChild(panel);
    return invocation;
  } catch (err) {
    return reportLaunchFailure(err, options);
  }
}
