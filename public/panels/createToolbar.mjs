// Nodevision/public/panels/createToolbar.mjs
// Fully prebuilt, instant toolbar and dropdowns

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

    document.querySelectorAll(".panel-cell").forEach((c) => {
      c.style.outline = "";
    });
    owningCell.style.outline = "2px solid #0078d7";

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

  // Generic condition support: any additional condition key maps to NodevisionState key.
  // Allows domain-specific toolbar gating (e.g., midiHasSelection, midiSelectedType).
  const reserved = new Set(["activePanelType", "fileIsDirty", "requiresFile"]);
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
    "/ToolbarJSONfiles/insertToolbar.json",
    "/ToolbarJSONfiles/settingsToolbar.json",
    "/ToolbarJSONfiles/viewToolbar.json",
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
      Object.assign(contentWrapper.style, {
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        marginRight: "6px",
      });
      contentWrapper.innerHTML = item.content;
      container.appendChild(contentWrapper);
      attachToolbarScript(item, contentWrapper);
      return;
    }

    const btnWrapper = document.createElement("div");
    btnWrapper.className = "toolbar-button";
    btnWrapper.dataset.heading = item.heading;
    Object.assign(
      btnWrapper.style,
      isDropdownContainer
        ? { position: "relative", display: "block", width: "100%", marginRight: "0" }
        : { position: "relative", display: "inline-block", marginRight: "4px" }
    );

    const btn = document.createElement("button");
    btn.textContent = item.heading;
    Object.assign(
      btn.style,
      isDropdownContainer
        ? {
            margin: "0",
            width: "100%",
            padding: "8px 12px",
            border: "0",
            borderRadius: "0",
            backgroundColor: "transparent",
            cursor: "pointer",
            display: "flex",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: "6px",
            opacity: "1.0",
            boxSizing: "border-box",
            whiteSpace: "normal",
            overflowWrap: "anywhere",
            wordBreak: "break-word",
            lineHeight: "1.25",
            height: "auto",
            textAlign: "left",
          }
        : {
            margin: "2px",
            padding: "4px 8px",
            border: "1px solid #333",
            backgroundColor: "#eee",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "6px",
            opacity: "1.0",
          }
    );

    // Icon
    if (item.icon) {
      const icon = document.createElement("img");
      icon.src = item.icon;
      icon.alt = item.heading;
      Object.assign(icon.style, { width: "16px", height: "16px" });
      btn.prepend(icon);
    }

    btnWrapper.appendChild(btn);
    btn.addEventListener("mouseenter", playToolbarHighlightSound);

    if (isDropdownContainer) {
      const baseColor = "transparent";
      const hoverColor = "#ff8c00";
      const activeColor = "#00c040";
      btn.addEventListener("mouseenter", () => {
        btn.style.backgroundColor = hoverColor;
      });
      btn.addEventListener("mouseleave", () => {
        btn.style.backgroundColor = baseColor;
      });
      btn.addEventListener("mousedown", () => {
        btn.style.backgroundColor = activeColor;
      });
      btn.addEventListener("mouseup", () => {
        btn.style.backgroundColor = hoverColor;
      });
    }

    // Dropdown handling
    const dropdown = prebuiltDropdowns[item.heading];
    if (dropdown) {
      btnWrapper.appendChild(dropdown);
      let hoverTimeout;
      btnWrapper.addEventListener("mouseenter", () => {
        clearTimeout(hoverTimeout);
        playToolbarHighlightSound();
        Object.values(prebuiltDropdowns).forEach(dd => { if (dd !== dropdown) dd.style.display = "none"; });
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
      Object.values(prebuiltDropdowns).forEach(dd => { if (dd !== dropdown) dd.style.display = "none"; });

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

      // Route to active panel handler if specified
      if (item.routeToActivePanel && item.callbackKey) {
        const handler = window.NodevisionState.activeActionHandler;
        if (typeof handler === 'function') {
          handler(item.callbackKey);
        } else if (item.ToolbarCategory) {
          handleToolbarClick(item.ToolbarCategory, item.callbackKey);
        }
      } else if (item.callbackKey && item.ToolbarCategory) {
        handleToolbarClick(item.ToolbarCategory, item.callbackKey);
      }

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
  const state = window.NodevisionState || {};
  const normalizedHeading = item.heading.toLowerCase();
  const jsonName = `${normalizedHeading}Toolbar.json`;
  const subItems = toolbarDataCache[jsonName] || [];

  const directChildren = subItems.filter((i) => i.parentHeading === item.heading);
  const rootItems = subItems.filter((i) => !i.parentHeading);
  const filterByState = (items) => items.filter((subItem) => checkToolbarConditions(subItem, state));

  // Prefer explicit children for this heading, but if none are valid in the
  // current mode/state, fall back to top-level items in that toolbar file.
  let topItems = directChildren.length ? filterByState(directChildren) : filterByState(rootItems);
  if (!topItems.length && directChildren.length) {
    topItems = filterByState(rootItems);
  }

  // MIDI Insert menu should only show MIDI-scoped actions.
  if (state.currentMode === "MIDIediting" && item.heading === "Insert") {
    topItems = topItems.filter((subItem) => {
      const modes = Array.isArray(subItem?.modes) ? subItem.modes : (subItem?.modes ? [subItem.modes] : []);
      return modes.includes("MIDIediting");
    });
  }

  if (!topItems.length) return null;

  const dropdown = document.createElement("div");
  dropdown.dataset.toolbarDropdown = "true";

Object.assign(dropdown.style, {
  position: "absolute",
  top: "100%",
  left: "0",
  zIndex: "1000",      // 🔥 this is the key
  background: "#f5f5f5",
  border: "1px solid #333",
  display: "none",
  minWidth: "100%",
});

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
    position: "relative", // creates stacking context
    zIndex: "10",         // lower than dropdowns (which should be 1000+)
    backgroundColor: "#f5f5f5",
  });

  items.forEach(item => {
    if (!checkToolbarConditions(item, state)) return;
    const btn = document.createElement("button");
    btn.title = item.heading || "";
    const hasIcon = Boolean(item.icon);
    if (!hasIcon) {
      btn.textContent = item.heading;
    }

    Object.assign(btn.style, {
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: hasIcon ? "0" : "6px",
      padding: "4px 8px",
    });

    if (hasIcon) {
      const icon = document.createElement("img");
      icon.src = item.icon;
      icon.alt = item.heading;
      Object.assign(icon.style, { width: "16px", height: "16px" });
      btn.appendChild(icon);
    }
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

      if (item.routeToActivePanel && item.callbackKey) {
        const handler = window.NodevisionState.activeActionHandler;
        if (typeof handler === "function") {
          handler(item.callbackKey);
        } else if (item.ToolbarCategory) {
          handleToolbarClick(item.ToolbarCategory, item.callbackKey);
        }
      } else if (item.callbackKey && item.ToolbarCategory) {
        handleToolbarClick(item.ToolbarCategory, item.callbackKey);
      }
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

  toolbar.innerHTML = "";

  // Get cached toolbar data
  const defaultToolbar = toolbarDataCache["defaultToolbar.json"] || [];
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

  console.log(`🔁 Toolbar updated for mode: ${currentMode}`);
}
