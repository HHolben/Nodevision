// Nodevision/ApplicationSystem/public/Resources/WebResourceBrowserVisibilityDiagnostics.mjs
// Runtime-only geometry diagnostics for Web Resource Browser placement/visibility.

function roundNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

export function rectFor(element) {
  if (!element || typeof element.getBoundingClientRect !== "function") return null;
  const r = element.getBoundingClientRect();
  return {
    left: roundNumber(r.left),
    top: roundNumber(r.top),
    right: roundNumber(r.right),
    bottom: roundNumber(r.bottom),
    width: roundNumber(r.width),
    height: roundNumber(r.height),
  };
}

function viewport() {
  return {
    width: roundNumber(globalThis.window?.innerWidth || globalThis.document?.documentElement?.clientWidth || 0),
    height: roundNumber(globalThis.window?.innerHeight || globalThis.document?.documentElement?.clientHeight || 0),
  };
}

function styleFor(element) {
  if (!element || typeof globalThis.getComputedStyle !== "function") return {};
  const s = globalThis.getComputedStyle(element);
  return {
    display: s.display,
    visibility: s.visibility,
    opacity: s.opacity,
    zIndex: s.zIndex,
    pointerEvents: s.pointerEvents,
    position: s.position,
    transform: s.transform,
    clip: s.clip,
    clipPath: s.clipPath,
    overflow: s.overflow,
    overflowX: s.overflowX,
    overflowY: s.overflowY,
  };
}

function datasetPick(element) {
  const d = element?.dataset || {};
  return {
    id: d.id || "",
    panelId: d.panelId || "",
    panelClass: d.panelClass || "",
    panelSlug: d.panelSlug || "",
    direction: d.direction || "",
    isVertical: d.isVertical || "",
    nvModeLayoutId: d.nvModeLayoutId || "",
    nvWorkspaceCellId: d.nvWorkspaceCellId || "",
    nvInsertMediaOriginCellId: d.nvInsertMediaOriginCellId || "",
    currentFilePath: d.currentFilePath || "",
    webResourceBrowserPanel: d.webResourceBrowserPanel || "",
  };
}

function tagLabel(element) {
  if (!element) return "(none)";
  const id = element.id ? "#" + element.id : "";
  const cls = String(element.className || "").trim();
  return String(element.tagName || "node").toLowerCase() + id + (cls ? "." + cls.replace(/\s+/g, ".") : "");
}

function tabListForCell(cell) {
  return Array.from(cell?.__nvPanelTabs?.tabs || []).map((tab) => ({
    tabId: tab.tabId || "",
    panelType: tab.panelType || tab.panelId || tab.id || "",
    panelClass: tab.panelClass || "",
    resourcePath: tab.resourcePath || tab.panelVars?.filePath || "",
    active: tab.tabId === cell?.__nvPanelTabs?.activeTabId,
  }));
}

function summarizeElement(element) {
  if (!element) return null;
  const rect = rectFor(element);
  return {
    label: tagLabel(element),
    connected: Boolean(element.isConnected),
    bodyContains: Boolean(globalThis.document?.body?.contains?.(element)),
    hidden: Boolean(element.hidden),
    inert: Boolean(element.inert),
    ariaHidden: element.getAttribute?.("aria-hidden") || "",
    dataset: datasetPick(element),
    rect,
    style: styleFor(element),
    tabState: element.classList?.contains?.("panel-cell") ? {
      activeTabId: element.__nvPanelTabs?.activeTabId || "",
      tabs: tabListForCell(element),
    } : null,
  };
}

function nearestWorkspace(element) {
  return element?.closest?.("#workspace, .workspace, [data-nv-workspace]") || globalThis.document?.getElementById?.("workspace") || null;
}

function ancestry(element, stopAt = null) {
  const chain = [];
  let node = element || null;
  const stop = stopAt || nearestWorkspace(element);
  while (node) {
    chain.push(summarizeElement(node));
    if (node === stop || node.id === "workspace") break;
    node = node.parentElement;
  }
  return chain;
}

function directChildRects(element) {
  return Array.from(element?.children || []).map((child, index) => ({
    index,
    ...summarizeElement(child),
  }));
}

function nearlyEqual(a, b, tolerance = 2) {
  return Math.abs(Number(a || 0) - Number(b || 0)) <= tolerance;
}

function exactOverlap(a, b) {
  if (!a || !b) return false;
  return nearlyEqual(a.left, b.left) && nearlyEqual(a.top, b.top) && nearlyEqual(a.width, b.width) && nearlyEqual(a.height, b.height);
}

function overlapRect(a, b) {
  if (!a || !b) return null;
  const left = Math.max(a.left, b.left);
  const top = Math.max(a.top, b.top);
  const right = Math.min(a.right, b.right);
  const bottom = Math.min(a.bottom, b.bottom);
  return {
    left,
    top,
    right,
    bottom,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

function elementFromPointReport(element) {
  const rect = rectFor(element);
  if (!rect || rect.width <= 0 || rect.height <= 0 || typeof globalThis.document?.elementFromPoint !== "function") {
    return { point: null, hit: null, containsHit: false, reason: "no-testable-rect-or-api" };
  }
  const point = {
    x: roundNumber(rect.left + rect.width / 2),
    y: roundNumber(rect.top + rect.height / 2),
  };
  const vp = viewport();
  if (point.x < 0 || point.y < 0 || point.x > vp.width || point.y > vp.height) {
    return { point, hit: null, containsHit: false, reason: "center-outside-viewport" };
  }
  const hit = globalThis.document.elementFromPoint(point.x, point.y);
  return {
    point,
    hit: summarizeElement(hit),
    containsHit: Boolean(element?.contains?.(hit) || hit === element),
    coveringAncestor: hit?.closest?.(".panel-cell, .panel, #workspace") ? summarizeElement(hit.closest(".panel-cell, .panel, #workspace")) : null,
  };
}

function clippingAncestors(element) {
  const elementRect = rectFor(element);
  if (!elementRect) return [];
  const out = [];
  let node = element?.parentElement || null;
  while (node) {
    const style = styleFor(node);
    const clippedOverflow = /(hidden|clip|scroll|auto)/.test(`${style.overflow} ${style.overflowX} ${style.overflowY}`);
    const parentRect = rectFor(node);
    const overlap = overlapRect(elementRect, parentRect);
    const clips = Boolean(clippedOverflow && parentRect && overlap && (overlap.width < elementRect.width - 2 || overlap.height < elementRect.height - 2));
    if (clips || clippedOverflow) {
      out.push({ ancestor: summarizeElement(node), clips, overlap });
    }
    if (node.id === "workspace") break;
    node = node.parentElement;
  }
  return out;
}

function panelTypeForCell(cell) {
  const active = Array.from(cell?.__nvPanelTabs?.tabs || []).find((tab) => tab.tabId === cell?.__nvPanelTabs?.activeTabId);
  return active?.panelType || cell?.dataset?.panelId || cell?.dataset?.id || "";
}

function cellContainsBrowser(cell) {
  if (!cell) return false;
  if (panelTypeForCell(cell) === "WebResourceBrowserPanel") return true;
  if (cell.dataset?.panelId === "WebResourceBrowserPanel" || cell.dataset?.id === "WebResourceBrowserPanel") return true;
  if (Array.from(cell.__nvPanelTabs?.tabs || []).some((tab) => (tab.panelType || tab.panelId || tab.id) === "WebResourceBrowserPanel")) return true;
  return Boolean(cell.querySelector?.("[data-web-resource-browser-panel=\"true\"]"));
}

function browserCellsRaw() {
  return Array.from(globalThis.document?.querySelectorAll?.(".panel-cell") || []).filter(cellContainsBrowser);
}

function allBrowserCells() {
  return browserCellsRaw()
    .map((cell, index) => ({ index, ...summarizeElement(cell), nearestWorkspace: summarizeElement(nearestWorkspace(cell)) }));
}

function closeBrowserTabsViaUi() {
  let closed = 0;
  for (const cell of browserCellsRaw()) {
    const tabs = Array.from(cell.__nvPanelTabs?.tabs || []).filter((tab) => (tab.panelType || tab.panelId || tab.id) === "WebResourceBrowserPanel");
    for (const tab of tabs) {
      const tabId = String(tab.tabId || "");
      const selector = `.nv-panel-tab[data-nv-panel-tab-id="${tabId}"] .nv-panel-tab-close`;
      const closeButton = cell.querySelector?.(selector);
      if (closeButton) {
        closeButton.click();
        closed += 1;
      }
    }
  }
  return { closed, remainingBrowserCells: allBrowserCells() };
}

function layoutTree(root = null) {
  const start = root || globalThis.document?.getElementById?.("workspace") || null;
  function walk(node) {
    if (!node) return null;
    const relevantChildren = Array.from(node.children || []).filter((child) =>
      child.classList?.contains?.("panel-row") ||
      child.classList?.contains?.("panel-cell") ||
      child.classList?.contains?.("layout-divider") ||
      child.classList?.contains?.("divider")
    );
    return {
      label: tagLabel(node),
      dataset: datasetPick(node),
      rect: rectFor(node),
      style: styleFor(node),
      panelType: node.classList?.contains?.("panel-cell") ? panelTypeForCell(node) : "",
      childCount: relevantChildren.length,
      children: relevantChildren.map(walk).filter(Boolean),
    };
  }
  return walk(start);
}

function diagnosticsStore() {
  const w = globalThis.window || globalThis;
  const store = w.__nvWebResourceVisibilityDiagnostics || { entries: [] };
  store.entries ||= [];
  store.latest = store.latest || null;
  store.enumerateBrowserCells = () => allBrowserCells();
  store.closeBrowserTabsViaUi = () => closeBrowserTabsViaUi();
  store.layoutTree = () => layoutTree();
  w.__nvWebResourceVisibilityDiagnostics = store;
  return store;
}

function log(label, detail) {
  try {
    const store = diagnosticsStore();
    const entry = { label, at: new Date().toISOString(), detail };
    store.latest = entry;
    store.entries.push(entry);
    if (store.entries.length > 20) store.entries.splice(0, store.entries.length - 20);
    console.info("[NV-WEB-RESOURCE] " + label, detail);
  } catch {
    // Runtime diagnostics must not change behavior.
  }
}

export function serializeWebResourceLayoutTree(root = null) {
  return layoutTree(root);
}

export function logWebResourcePlacementDiagnostics(label, {
  originCell = null,
  destinationCell = null,
  browserRoot = null,
  workspaceRoot = null,
  destinationParent = null,
  placement = null,
  invocation = null,
  layoutBefore = null,
  splitApi = null,
} = {}) {
  const workspace = workspaceRoot || nearestWorkspace(destinationCell || browserRoot || originCell);
  const destParent = destinationParent || destinationCell?.parentElement || null;
  const originRect = rectFor(originCell);
  const destinationRect = rectFor(destinationCell);
  const browserRect = rectFor(browserRoot);
  const sameWorkspace = Boolean(workspace && originCell && destinationCell && nearestWorkspace(originCell) === nearestWorkspace(destinationCell));
  const destinationRightOfOrigin = Boolean(originRect && destinationRect && destinationRect.left >= originRect.right - 2);
  const overlap = exactOverlap(originRect, destinationRect);

  const detail = {
    viewport: viewport(),
    splitApi,
    invocation: invocation ? {
      intent: invocation.intent || "",
      resourceType: invocation.resourceType || "",
      mediaFamily: invocation.mediaFamily || "",
      originCellId: invocation.originCellId || "",
      originPanelType: invocation.originPanelType || "",
      originEditorPath: invocation.originEditorPath || "",
      targetMode: invocation.targetMode || "",
      returnToken: invocation.returnToken || "",
    } : null,
    placement,
    origin: summarizeElement(originCell),
    destination: summarizeElement(destinationCell),
    browserRoot: summarizeElement(browserRoot),
    workspace: summarizeElement(workspace),
    destinationParent: summarizeElement(destParent),
    comparison: {
      sameWorkspace,
      destinationRightOfOrigin,
      approximateExactOverlap: overlap,
      overlapRect: overlapRect(originRect, destinationRect),
    },
    connectivity: {
      destinationIsConnected: Boolean(destinationCell?.isConnected),
      destinationInBody: Boolean(globalThis.document?.body?.contains?.(destinationCell)),
      browserRootIsConnected: Boolean(browserRoot?.isConnected),
      browserRootInBody: Boolean(globalThis.document?.body?.contains?.(browserRoot)),
    },
    clipping: {
      destination: clippingAncestors(destinationCell),
      browserRoot: clippingAncestors(browserRoot),
    },
    hitTest: {
      destinationCenter: elementFromPointReport(destinationCell),
      browserRootCenter: elementFromPointReport(browserRoot),
    },
    directBrowserChildren: directChildRects(browserRoot),
    originAncestry: ancestry(originCell, workspace),
    destinationAncestry: ancestry(destinationCell, workspace),
    browserRootAncestry: ancestry(browserRoot, workspace),
    browserCells: allBrowserCells(),
    layoutBefore,
    layoutAfter: layoutTree(workspace),
  };

  if (overlap) {
    console.warn("[NV-WEB-RESOURCE] placement layout failure: origin and destination rectangles overlap", detail.comparison);
  }
  log(label, detail);
  return detail;
}

export function scheduleWebResourceVisibilityDiagnostics(label, options = {}) {
  const run = () => logWebResourcePlacementDiagnostics(label, options);
  if (typeof globalThis.requestAnimationFrame === "function") {
    requestAnimationFrame(() => setTimeout(run, 0));
    return;
  }
  setTimeout(run, 0);
}
