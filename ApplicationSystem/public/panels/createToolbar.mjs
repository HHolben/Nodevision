// Nodevision/ApplicationSystem/public/panels/createToolbar.mjs
// This file defines browser-side create Toolbar logic for the Nodevision UI. It renders interface components and handles user interactions.

import { createPanel } from '/panels/panelManager.mjs';
import { dockPanel } from '/panels/panelControls.mjs';
import { loadCallback } from "/callbackLoader.mjs";
import { setStatus } from "./../StatusBar.mjs";



let currentSubToolbarHeading = null;
let subToolbarContainer = null;
const toolbarDataCache = {}; // Preloaded JSON
const prebuiltDropdowns = {}; // Store prebuilt dropdown divs
const toolbarScriptModuleCache = new Map();
const TOOLBAR_HIGHLIGHT_SOUND_URLS = [
  "/soundEffects/Tic.wav",
  "/soundEffects/Tic.mp3"
];
let lastToolbarHighlightSoundAt = 0;

function playToolbarHighlightSound() {
  const now = Date.now();
  if (now - lastToolbarHighlightSoundAt < 55) return;
  lastToolbarHighlightSoundAt = now;

  const tryUrl = (url) => {
    if (!url) return Promise.resolve(false);
    const audio = new Audio(url);
    audio.preload = "auto";
    audio.volume = 0.95;
    try {
      const playPromise = audio.play();
      if (playPromise && typeof playPromise.then === "function") {
        return playPromise.then(() => true).catch(() => false);
      }
      return Promise.resolve(true);
    } catch {
      return Promise.resolve(false);
    }
  };

  tryUrl(TOOLBAR_HIGHLIGHT_SOUND_URLS[0]).then((ok) => {
    if (ok) return;
    return tryUrl(TOOLBAR_HIGHLIGHT_SOUND_URLS[1]);
  }).catch(() => {});
}

window.NodevisionState = window.NodevisionState || {
  activePanelType: null,
  fileIsDirty: false,
  selectedFile: null,
  currentMode: "Default",
  virtualWorldMode: "survival",
  activeActionHandler: null,
};

function normalizeToolbarFilePath(value) {
  let cleaned = String(value || "").trim();
  if (!cleaned) return "";

  try {
    const parsed = new URL(cleaned, window.location.origin);
    cleaned = parsed.pathname || cleaned;
  } catch {
    // Keep path-like values that are not valid URLs.
  }

  cleaned = cleaned
    .replace(/\\/g, "/")
    .replace(/[?#].*$/, "")
    .replace(/^https?:\/\/[^/]+/i, "")
    .replace(/^\/+/, "");

  if (cleaned.toLowerCase().startsWith("notebook/")) {
    cleaned = cleaned.slice("Notebook/".length);
  }

  return cleaned.trim();
}

function resolveToolbarActiveFilePath(state = window.NodevisionState || {}) {
  const candidates = [
    state.activeEditorFilePath,
    window.currentActiveFilePath,
    window.selectedFilePath,
    state.selectedFile,
    window.ActiveNode,
    window.filePath,
  ];

  for (const candidate of candidates) {
    const normalized = normalizeToolbarFilePath(candidate);
    if (normalized) return normalized;
  }

  return "";
}

function isToolbarActiveFileIno(state = window.NodevisionState || {}) {
  return resolveToolbarActiveFilePath(state).toLowerCase().endsWith(".ino");
}

function isToolbarActiveFileHtml(state = window.NodevisionState || {}) {
  return new Set(["html", "htm", "xhtml"]).has((resolveToolbarActiveFilePath(state).split(".").pop() || "").toLowerCase());
}

function isToolbarActiveFileDirectory(state = window.NodevisionState || {}) {
  const activePath = normalizeToolbarFilePath(resolveToolbarActiveFilePath(state));
  if (!activePath) return false;
  const fileManagerItems = document.querySelectorAll("#file-list a.file, #file-list a.folder");
  for (const item of fileManagerItems) {
    if (normalizeToolbarFilePath(item?.dataset?.fullPath) === activePath && item?.dataset?.isDirectory === "true") return true;
  }
  return false;
}

function canToolbarActiveFileConvertToEpub(state = window.NodevisionState || {}) {
  return isToolbarActiveFileHtml(state) || isToolbarActiveFileDirectory(state);
}

if (!window.__nvShowSubToolbarEventBound) {
  window.addEventListener("nv-show-subtoolbar", (evt) => {
    const detail = evt?.detail || {};
    const heading = detail.heading || "";
    if (!heading) return;
    showSubToolbar(heading, {
      force: Boolean(detail.force),
      toggle: detail.toggle !== false,
    });
  });
  window.__nvShowSubToolbarEventBound = true;
}

function setActivePanelContextFromHeader(headerEl) {
  if (!headerEl) return;

  const panel = headerEl.closest(".panel");
  const legacyUndocked = headerEl.closest(".undocked-panel-float");
  const owningCell = (
    panel?.closest(".panel-cell") ||
    headerEl.closest(".panel-cell") ||
    panel?.__nvDefaultDockCell ||
    null
  );

  if (panel) {
    window.__nvActivePanelElement = panel;
    window.__nvActiveLegacyUndockedPanel = null;
    window.activePanel = panel.dataset.instanceName || panel.dataset.instanceId || "Panel";
    window.activePanelClass = panel.dataset.panelClass || "GenericPanel";
  } else {
    window.__nvActivePanelElement = null;
    window.__nvActiveLegacyUndockedPanel = legacyUndocked || null;
    if (legacyUndocked) {
      window.activePanel = "UndockedPanel";
      window.activePanelClass = "FloatingPanel";
      window.NodevisionState.activePanelType = "FloatingPanel";
    }
  }

  window.NodevisionState = window.NodevisionState || {};
  if (window.activePanelClass) {
    window.NodevisionState.activePanelType = window.activePanelClass;
  }

  if (owningCell && owningCell.classList?.contains("panel-cell")) {
    window.activeCell = owningCell;
    const panelIdFromCell = owningCell.dataset.id || window.activePanel || "Unknown";
    const panelClassFromCell = owningCell.dataset.panelClass || window.activePanelClass || "InfoPanel";
    window.activePanel = panelIdFromCell;
    window.activePanelClass = panelClassFromCell;
    window.NodevisionState.activePanelType = panelClassFromCell;

    if (window.highlightActiveCell) {
      window.highlightActiveCell(owningCell);
    } else {
      document.querySelectorAll(".panel-cell").forEach((c) => {
        c.style.outline = "";
      });
      owningCell.style.outline = "2px solid #0078d7";
    }

    window.dispatchEvent(new CustomEvent("activePanelChanged", {
      detail: {
        panel: panelIdFromCell,
        cell: owningCell,
        panelClass: panelClassFromCell,
      },
    }));
  } else {
    window.activeCell = null;
  }
}

if (!window.__nvPanelHeaderLayoutBound) {
  document.addEventListener("click", (evt) => {
    const header = evt.target?.closest?.(".panel-header, .undocked-panel-header");
    if (!header) return;

    if (evt.target?.closest?.("button, a, input, select, textarea")) return;

    // Standard .panel headers manage their own click/drag suppression.
    if (header.closest(".panel")) return;

    setActivePanelContextFromHeader(header);
    showSubToolbar("Layout Controls", { force: false, toggle: false });
  }, true);
  window.__nvPanelHeaderLayoutBound = true;
}


// === Helper: Check toolbar item conditions ===
function checkToolbarConditions(item, state) {
  // === Handle 'modes' property ===
  if (item.modes) {
    const allowedModes = Array.isArray(item.modes) ? item.modes : [item.modes];
    if (!allowedModes.includes(state.currentMode)) {
      return false;
    }
  }

  // === Handle 'conditions' property as before ===
  if (!item.conditions) return true;

  if (item.conditions.activePanelType) {
    const allowed = Array.isArray(item.conditions.activePanelType)
      ? item.conditions.activePanelType
      : [item.conditions.activePanelType];
    if (!allowed.includes(state.activePanelType)) return false;
  }

  if (item.conditions.fileIsDirty !== undefined) {
    if (item.conditions.fileIsDirty !== state.fileIsDirty) return false;
  }

  if (item.conditions.requiresFile && !state.selectedFile) return false;

  if (item.conditions.activeFileIsIno !== undefined) {
    if (isToolbarActiveFileIno(state) !== item.conditions.activeFileIsIno) return false;
  }

  if (item.conditions.activeFileIsHtml !== undefined) {
    if (isToolbarActiveFileHtml(state) !== item.conditions.activeFileIsHtml) return false;
  }

  if (item.conditions.activeFileCanConvertToEpub !== undefined) {
    if (canToolbarActiveFileConvertToEpub(state) !== item.conditions.activeFileCanConvertToEpub) return false;
  }

  // Generic condition support: any additional condition key maps to NodevisionState key.
  // Allows domain-specific toolbar gating (e.g., midiHasSelection, midiSelectedType).
  const reserved = new Set(["activePanelType", "fileIsDirty", "requiresFile", "activeFileIsIno", "activeFileIsHtml", "activeFileCanConvertToEpub"]);
  for (const [key, expected] of Object.entries(item.conditions)) {
    if (reserved.has(key)) continue;
    const actual = state[key];
    if (Array.isArray(expected)) {
      if (!expected.includes(actual)) return false;
    } else if (actual !== expected) {
      return false;
    }
  }

  return true;
}


function toolbarChildrenForHeading(heading) {
  const normalized = String(heading || "").trim();
  if (!normalized) return [];
  const matches = [];
  for (const key in toolbarDataCache) {
    const set = toolbarDataCache[key];
    if (!Array.isArray(set)) continue;
    matches.push(...set.filter((item) => item.parentHeading === normalized));
  }
  return matches;
}

function resolveToolbarContextHandler(item) {
  let contextName = String(item?.routeToContext || "").trim();
  const conditions = item?.conditions || {};
  if (!contextName && (
    Object.prototype.hasOwnProperty.call(conditions, "glbCanInsertBone") ||
    Object.prototype.hasOwnProperty.call(conditions, "glbCanInsertPrimitive") ||
    Object.prototype.hasOwnProperty.call(conditions, "glbCanEditMesh")
  )) {
    contextName = "GLBEditorContext";
  }
  if (!contextName) return null;
  const context = window[contextName];
  if (!context) return null;
  if (typeof context.handleToolbarAction === "function") return context.handleToolbarAction.bind(context);
  if (typeof context.handleAction === "function") return context.handleAction.bind(context);
  return null;
}

function runToolbarItemCallback(item) {
  if (!item?.callbackKey) return;
  const contextHandler = resolveToolbarContextHandler(item);
  if (typeof contextHandler === "function") {
    const handled = contextHandler(item.callbackKey, item);
    if (handled !== false) return;
  }
  if (item.routeToActivePanel) {
    const handler = window.NodevisionState?.activeActionHandler;
    if (typeof handler === "function") {
      const handled = handler(item.callbackKey, item);
      if (handled !== false) return;
    }
  }
  if (item.ToolbarCategory) handleToolbarClick(item.ToolbarCategory, item.callbackKey);
}

function dropdownsAreRelated(a, b) {
  return !!(a && b && (a === b || a.contains?.(b) || b.contains?.(a)));
}

function hideUnrelatedDropdowns(activeDropdown) {
  Object.values(prebuiltDropdowns).forEach((dropdown) => {
    if (!dropdownsAreRelated(dropdown, activeDropdown)) dropdown.style.display = "none";
  });
}

// === Dynamic callback loader ===
async function handleToolbarClick(category, key) {
  const callback = await loadCallback(category.toLowerCase(), key);
  callback();
}

function resolveToolbarScriptPath(scriptPath) {
  if (!scriptPath || typeof scriptPath !== "string") return null;
  if (scriptPath.startsWith("/")) return scriptPath;
  const clean = scriptPath.replace(/^\.\//, "");
  return `/ToolbarJSONfiles/${clean}`;
}

async function attachToolbarScript(item, hostElement) {
  const modulePath = resolveToolbarScriptPath(item?.script);
  if (!modulePath) return;

  try {
    let mod = toolbarScriptModuleCache.get(modulePath);
    if (!mod) {
      mod = await import(modulePath);
      toolbarScriptModuleCache.set(modulePath, mod);
    }

    if (mod && typeof mod.initToolbarWidget === "function") {
      mod.initToolbarWidget(hostElement, item);
    }
  } catch (err) {
    console.warn("Failed to load toolbar script:", modulePath, err);
  }
}

function createToolbarIconElement(item, { allowFallback = true } = {}) {
  const makeFallback = () => {
    if (!allowFallback) return null;
    const fallback = document.createElement("span");
    fallback.setAttribute("aria-hidden", "true");
    fallback.className = "nv-toolbar-icon-fallback";
    const fallbackLabel = String(item?.shortLabel || item?.label || "").trim();
    if (fallbackLabel) {
      fallback.textContent = fallbackLabel.slice(0, 3);
      fallback.title = item?.heading || fallbackLabel;
    }
    return fallback;
  };

  if (item?.icon) {
    const icon = document.createElement("img");
    icon.src = item.icon;
    icon.alt = item.heading || "toolbar icon";
    icon.className = "nv-toolbar-icon";
    icon.addEventListener("error", () => {
      const fallback = makeFallback();
      if (fallback) icon.replaceWith(fallback);
    }, { once: true });
    return icon;
  }

  return makeFallback();
}

function rebuildPrebuiltDropdowns() {
  // Clear old cached dropdown DOM so conditions are reevaluated
  for (const key of Object.keys(prebuiltDropdowns)) {
    delete prebuiltDropdowns[key];
  }

  for (const key in toolbarDataCache) {
    const items = toolbarDataCache[key];
    if (!Array.isArray(items)) continue;
    items.forEach(item => {
      const dropdown = buildDropdownFromItem(item);
      if (dropdown && !prebuiltDropdowns[item.heading]) {
        prebuiltDropdowns[item.heading] = dropdown;
      }
    });
  }
}

let globalToolbarResizeObserver = null;
let globalToolbarResizeListenerInstalled = false;

function updateGlobalToolbarHeightVar() {
  const toolbar = document.querySelector("#global-toolbar");
  if (!toolbar) return;
  const height = Math.ceil(toolbar.getBoundingClientRect().height || toolbar.offsetHeight || 0);
  if (height > 0) {
    document.documentElement.style.setProperty("--nv-global-toolbar-height", `${height}px`);
  }
}

function ensureGlobalToolbarHeightObserver() {
  const toolbar = document.querySelector("#global-toolbar");
  if (!toolbar || typeof ResizeObserver === "undefined") {
    updateGlobalToolbarHeightVar();
    return;
  }

  if (globalToolbarResizeObserver) {
    globalToolbarResizeObserver.disconnect();
  }

  globalToolbarResizeObserver = new ResizeObserver(() => updateGlobalToolbarHeightVar());
  globalToolbarResizeObserver.observe(toolbar);
  updateGlobalToolbarHeightVar();

  if (!globalToolbarResizeListenerInstalled) {
    globalToolbarResizeListenerInstalled = true;
    window.addEventListener("resize", updateGlobalToolbarHeightVar, { passive: true });
  }
}

/**
 * Creates the global toolbar, loading toolbars from JSON files.
 * Each toolbar item may have a "mode" property specifying when it appears.
 * @param {string} toolbarSelector 
 * @param {string} currentMode - optional mode filter ("code", "graphical", etc.)
 */
export async function createToolbar(toolbarSelector = "#global-toolbar", currentMode = "default") {
  const toolbar = document.querySelector(toolbarSelector);
  subToolbarContainer = document.querySelector("#sub-toolbar");

  if (!toolbar) return console.error("Toolbar container not found!");
  toolbar.innerHTML = "";
  if (subToolbarContainer) subToolbarContainer.innerHTML = "";

  // ✅ Preload toolbar JSON files
  const jsonFiles = [
    "/ToolbarJSONfiles/defaultToolbar.json",
    "/ToolbarJSONfiles/fileToolbar.json",
    "/ToolbarJSONfiles/editToolbar.json",
    "/ToolbarJSONfiles/stylesToolbar.json",
    "/ToolbarJSONfiles/insertToolbar.json",
    "/ToolbarJSONfiles/settingsToolbar.json",
    "/ToolbarJSONfiles/viewToolbar.json",
    "/ToolbarJSONfiles/terminalToolbar.json",
    "/ToolbarJSONfiles/searchToolbar.json",
    "/ToolbarJSONfiles/userToolbar.json",
    "/ToolbarJSONfiles/drawToolbar.json",

  ];

  await Promise.all(jsonFiles.map(async (file) => {
    try {
      const res = await fetch(file);
      if (res.ok) toolbarDataCache[file.split("/").pop()] = await res.json();
    } catch (err) {
      console.warn("Failed to preload toolbar JSON:", file, err);
    }
  }));

  // ✅ Prebuild dropdowns for each heading
  rebuildPrebuiltDropdowns();

  // Prefer current Nodevision mode over the default argument when available.
  const effectiveMode =
    currentMode === "default" && window.NodevisionState?.currentMode
      ? window.NodevisionState.currentMode
      : currentMode;

  // ✅ Apply mode filtering before building toolbar
  const defaultToolbar = toolbarDataCache["defaultToolbar.json"] || [];
  const filteredToolbar = defaultToolbar.filter(item => {
    // Only include items that match currentMode (or have no mode)
// Support both "mode" and "modes"
if (item.modes) {
  const allowed = Array.isArray(item.modes) ? item.modes : [item.modes];
  return allowed.includes(effectiveMode);
}
if (item.mode) return item.mode === effectiveMode;
return true;
  });

  // Build main toolbar from filtered items
  buildToolbar(toolbar, filteredToolbar);
  ensureGlobalToolbarHeightObserver();

  setStatus("Toolbar ready", `Mode: ${effectiveMode}`);

  console.log(`🧭 Toolbar built for mode: ${effectiveMode}`);
}


// === Build toolbar buttons (main or sub-toolbar) ===
function buildToolbar(container, items, parentHeading = null) {
  const state = window.NodevisionState;
  const isDropdownContainer = container?.dataset?.toolbarDropdown === "true";

  items.forEach(item => {
    if (item.parentHeading && !parentHeading) return;
    const enabled = checkToolbarConditions(item, state);
    if (!enabled) return;

    // Inline custom content widget (e.g., search bar)
    if (item.content) {
      const contentWrapper = document.createElement("div");
      contentWrapper.className = "toolbar-inline-widget";
      contentWrapper.dataset.heading = item.heading || "";
      contentWrapper.innerHTML = item.content;
      container.appendChild(contentWrapper);
      attachToolbarScript(item, contentWrapper);
      return;
    }

    const btnWrapper = document.createElement("div");
    btnWrapper.className = isDropdownContainer
      ? "toolbar-button toolbar-button--dropdown-item"
      : "toolbar-button toolbar-button--main-item";
    btnWrapper.dataset.heading = item.heading;

    const btn = document.createElement("button");
    btn.className = isDropdownContainer ? "toolbar-dropdown-button" : "toolbar-main-button";
    btn.textContent = item.heading;

    // Main toolbar is text-only. Dropdown entries are icon + text.
    if (isDropdownContainer) {
      const iconEl = createToolbarIconElement(item, { allowFallback: true });
      if (iconEl) btn.prepend(iconEl);
    }

    btnWrapper.appendChild(btn);
    btn.addEventListener("mouseenter", playToolbarHighlightSound);

    // Dropdown handling
    const dropdown = prebuiltDropdowns[item.heading];
    if (dropdown) {
      btnWrapper.appendChild(dropdown);
      let hoverTimeout;
      btnWrapper.addEventListener("mouseenter", () => {
        clearTimeout(hoverTimeout);
        playToolbarHighlightSound();
        hideUnrelatedDropdowns(dropdown);
        dropdown.style.display = "block";
      });
      btnWrapper.addEventListener("mouseleave", () => {
        hoverTimeout = setTimeout(() => (dropdown.style.display = "none"), 250);
      });
    }

    // Click
    btn.addEventListener("click", e => {
      e.stopPropagation();

      // Close other dropdowns
      hideUnrelatedDropdowns(dropdown);

// === Panel handling ===
if (item.panelTemplateId || item.panelTemplate) {
  const templateId = item.panelTemplateId || item.panelTemplate;
  const panelType = item.panelType || "ViewPanels"; // Default for top-level panels

  const event = new CustomEvent("toolbarAction", {
    detail: {
      id: templateId,
      type: panelType,
      replaceActive: item.replaceActive === true
    }
  });
  window.dispatchEvent(event);
}


      // Script import
      if (item.script) attachToolbarScript(item, btnWrapper);

      runToolbarItemCallback(item);

      // Sub-toolbar
      // Priority rule:
      // If this item HAS a dropdown, do NOT open a sub-toolbar.
      // Some actions (like Draw -> Color) render their own custom sub-toolbar.
      if (dropdown) {
        dropdown.style.display = "block";
      } else if (item.preventAutoSubToolbar !== true) {
        if (subToolbarContainer) showSubToolbar(item.heading);
      }

    });

    container.appendChild(btnWrapper);
  });
}

// === Build dropdown from toolbar item ===
function buildDropdownFromItem(item) {
  if (!item.heading) return null;
  if (item.preventDropdown === true) return null;
  const state = window.NodevisionState || {};
  const normalizedHeading = item.heading.toLowerCase();
  const jsonName = normalizedHeading + "Toolbar.json";
  const fileItems = toolbarDataCache[jsonName] || [];
  const nestedChildren = fileItems.length ? [] : toolbarChildrenForHeading(item.heading);
  const subItems = fileItems.length ? fileItems : nestedChildren;

  const directChildren = subItems.filter((i) => i.parentHeading === item.heading);
  const rootItems = subItems.filter((i) => !i.parentHeading);
  const filterByState = (items) => items.filter((subItem) => checkToolbarConditions(subItem, state));

  // Toolbar files can mix root-level menu entries with direct children of the
  // main toolbar heading. Preserve JSON order so legacy sections such as
  // Insert Text and Media stay visible beside newer direct Insert tools.
  const hasRootItems = rootItems.length > 0;
  const hasDirectChildren = directChildren.length > 0;
  let candidateTopItems = [];

  if (hasRootItems && hasDirectChildren) {
    candidateTopItems = subItems.filter((subItem) => {
      return !subItem.parentHeading || subItem.parentHeading === item.heading;
    });
  } else if (hasDirectChildren) {
    candidateTopItems = directChildren;
  } else {
    candidateTopItems = rootItems;
  }

  let topItems = filterByState(candidateTopItems);
  if (!topItems.length && hasDirectChildren) {
    topItems = filterByState(rootItems);
  }

  // MIDI Insert menu should only show MIDI-scoped actions.
  if (state.currentMode === "MIDIediting" && item.heading === "Insert") {
    topItems = topItems.filter((subItem) => {
      const modes = Array.isArray(subItem?.modes) ? subItem.modes : (subItem?.modes ? [subItem.modes] : []);
      return modes.includes("MIDIediting");
    });
  }

  if (state.currentMode === "ArduinoBlockEditing" && item.heading === "Insert") {
    topItems = topItems.filter((subItem) => {
      const modes = Array.isArray(subItem?.modes) ? subItem.modes : (subItem?.modes ? [subItem.modes] : []);
      return modes.includes("ArduinoBlockEditing");
    });
  }

  if (!topItems.length) return null;

  const dropdown = document.createElement("div");
  dropdown.className = "toolbar-dropdown-panel";
  dropdown.dataset.toolbarDropdown = "true";

  buildToolbar(dropdown, topItems, item.heading);

  return dropdown;
}




// === Build sub-toolbar ===
function buildSubToolbar(items, container = subToolbarContainer) {
  if (!container) return;
  const state = window.NodevisionState || {};

  // Clear + FORCE visibility (fixes "disappearing" bug)
  container.innerHTML = "";
  Object.assign(container.style, {
    display: "flex",
  });

  items.forEach(item => {
    if (!checkToolbarConditions(item, state)) return;

    const hasWidgetContent = typeof item?.content === "string" && item.content.trim() !== "";
    if (hasWidgetContent || item.script) {
      const host = document.createElement("div");
      host.className = "nv-subtoolbar-widget";
      host.classList.add("nv-subtoolbar-widget--compact-script");
      if (hasWidgetContent) {
        host.innerHTML = item.content;
      }
      if (item.script) {
        attachToolbarScript(item, host);
      }
      container.appendChild(host);
      return;
    }

    const btn = document.createElement("button");
    btn.className = "nv-subtoolbar-icon-btn";
    btn.title = item.heading || "";
    btn.setAttribute("aria-label", item.heading || "toolbar action");

    // Sub-toolbar is icon-only.
    const iconEl = createToolbarIconElement(item, { allowFallback: true });
    if (iconEl) btn.appendChild(iconEl);
    btn.addEventListener("mouseenter", playToolbarHighlightSound);

    btn.addEventListener("click", e => {
      e.stopPropagation();

      if (item.panelTemplateId || item.panelTemplate) {
        const templateId = item.panelTemplateId || item.panelTemplate;
        const moduleName = templateId
          .replace(".json", "")
          .replace("Panel", "")
          .replace("panel", "")
          .replace(/^\w/, c => c.toUpperCase());

        const panelType = item.panelType || "InfoPanel";
        createPanel(moduleName, panelType, item.defaultInstanceVars || {});
      }

      runToolbarItemCallback(item);
    });

    container.appendChild(btn);
  });
}


// === Show sub-toolbar ===
function showSubToolbar(panelHeading, options = {}) {
  if (!subToolbarContainer) return;
  const { force = false, toggle = true } = options || {};
  const state = window.NodevisionState || {};

  if (
    !force &&
    currentSubToolbarHeading === panelHeading &&
    subToolbarContainer.style.display !== "none" &&
    subToolbarContainer.childElementCount > 0
  ) {
    return;
  }

  if (toggle && !force && currentSubToolbarHeading === panelHeading) {
    subToolbarContainer.style.display = "none";
    subToolbarContainer.innerHTML = "";
    currentSubToolbarHeading = null;
    return;
  }

  // Find all matching sub-items
  let items = [];
  for (const key in toolbarDataCache) {
    const set = toolbarDataCache[key];
    if (!Array.isArray(set)) continue;
    const matches = set.filter(i => i.parentHeading === panelHeading);
    if (matches.length) items.push(...matches);
  }
  items = items.filter((item) => checkToolbarConditions(item, state));

  if (!items.length) {
    subToolbarContainer.style.display = "none";
    currentSubToolbarHeading = null;
    return;
  }

  buildSubToolbar(items);
  currentSubToolbarHeading = panelHeading;
}

export function showToolbarSubToolbar(panelHeading, options = {}) {
  showSubToolbar(panelHeading, options);
}

// === Update toolbar state dynamically ===
export function updateToolbarState(newState = {}) {
  console.log("Updating Toolbar state")
  // Merge new state into the global NodevisionState
  Object.assign(window.NodevisionState, newState);

  // Determine the current mode (fallback to "default")
  const currentMode = window.NodevisionState?.currentMode || "default";
setStatus("Mode", currentMode);


  const toolbar = document.querySelector("#global-toolbar");
  if (!toolbar) return;

  const defaultToolbar = toolbarDataCache["defaultToolbar.json"] || [];
  if (!Array.isArray(defaultToolbar) || defaultToolbar.length === 0) {
    console.warn("Toolbar JSON cache not ready; skipping toolbar rebuild.");
    return;
  }

  toolbar.innerHTML = "";

  rebuildPrebuiltDropdowns();

  // ✅ Filter based on mode
  const filteredToolbar = defaultToolbar.filter(item => {
if (item.modes) {
  const allowed = Array.isArray(item.modes) ? item.modes : [item.modes];
  return allowed.includes(currentMode);
}
if (item.mode) return item.mode === currentMode;
return true;
  });

  // Rebuild toolbar using filtered items
  buildToolbar(toolbar, filteredToolbar);
  ensureGlobalToolbarHeightObserver();

  console.log(`🔁 Toolbar updated for mode: ${currentMode}`);
}
