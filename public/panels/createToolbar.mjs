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

window.NodevisionState = window.NodevisionState || {
  activePanelType: null,
  fileIsDirty: false,
  selectedFile: null,
  currentMode: "Default",
  activeActionHandler: null,
};


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

  return true;
}


// === Dynamic callback loader ===
async function handleToolbarClick(category, key) {
  const callback = await loadCallback(category.toLowerCase(), key);
  callback();
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

  // ✅ Apply mode filtering before building toolbar
  const defaultToolbar = toolbarDataCache["defaultToolbar.json"] || [];
  const filteredToolbar = defaultToolbar.filter(item => {
    // Only include items that match currentMode (or have no mode)
// Support both "mode" and "modes"
if (item.modes) {
  const allowed = Array.isArray(item.modes) ? item.modes : [item.modes];
  return allowed.includes(currentMode);
}
if (item.mode) return item.mode === currentMode;
return true;
  });

  // Build main toolbar from filtered items
  buildToolbar(toolbar, filteredToolbar);

setStatus("Toolbar ready", `Mode: ${currentMode}`);

  console.log(`🧭 Toolbar built for mode: ${currentMode}`);
}


// === Build toolbar buttons (main or sub-toolbar) ===
function buildToolbar(container, items, parentHeading = null) {
  const state = window.NodevisionState;

  items.forEach(item => {
    if (item.parentHeading && !parentHeading) return;

    const btnWrapper = document.createElement("div");
    btnWrapper.className = "toolbar-button";
    btnWrapper.dataset.heading = item.heading;
    Object.assign(btnWrapper.style, { position: "relative", display: "inline-block", marginRight: "4px" });

    const btn = document.createElement("button");
    btn.textContent = item.heading;
    Object.assign(btn.style, {
      margin: "2px",
      padding: "4px 8px",
      border: "1px solid #333",
      backgroundColor: "#eee",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      gap: "6px",
      opacity: "1.0",
    });

    // Icon
    if (item.icon) {
      const icon = document.createElement("img");
      icon.src = item.icon;
      icon.alt = item.heading;
      Object.assign(icon.style, { width: "16px", height: "16px" });
      btn.prepend(icon);
    }

    btnWrapper.appendChild(btn);

    // State conditions
    const enabled = checkToolbarConditions(item, state);
    if (!enabled) {
      btn.disabled = true;
      btn.style.opacity = "0.5";
      btn.style.cursor = "not-allowed";
    }

    // Dropdown handling
    const dropdown = prebuiltDropdowns[item.heading];
    if (dropdown) {
      btnWrapper.appendChild(dropdown);
      let hoverTimeout;
      btnWrapper.addEventListener("mouseenter", () => {
        if (!enabled) return;
        clearTimeout(hoverTimeout);
        Object.values(prebuiltDropdowns).forEach(dd => { if (dd !== dropdown) dd.style.display = "none"; });
        dropdown.style.display = "block";
      });
      btnWrapper.addEventListener("mouseleave", () => {
        hoverTimeout = setTimeout(() => (dropdown.style.display = "none"), 250);
      });
    }

    // Click
    btn.addEventListener("click", e => {
      if (!enabled) return;
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
      if (item.script) import(`/ToolbarJSONfiles/${item.script}`);

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
// If this item HAS a dropdown, do NOT open a sub-toolbar
if (dropdown) {
  dropdown.style.display = "block";
} else {
  // Otherwise allow sub-toolbar
  if (subToolbarContainer) showSubToolbar(item.heading);
}

    });

    container.appendChild(btnWrapper);
  });
}

// === Build dropdown from toolbar item ===
function buildDropdownFromItem(item) {
  if (!item.heading) return null;
  const normalizedHeading = item.heading.toLowerCase();
  const jsonName = `${normalizedHeading}Toolbar.json`;
  const subItems = toolbarDataCache[jsonName] || [];
  const topItems = subItems.filter(i => !i.parentHeading);
  if (!topItems.length) return null;


  const dropdown = document.createElement("div");

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

  buildToolbar(dropdown, topItems);

  // Wait a tick to ensure DOM exists, then set full width for dropdown items
  setTimeout(() => {
    // Find button by data attribute instead of :contains (which is jQuery, not CSS)
    const parentBtnWrapper = document.querySelector(`.toolbar-button[data-heading="${item.heading}"] button`) || null;
    const parentWidth = parentBtnWrapper ? parentBtnWrapper.offsetWidth : dropdown.offsetWidth;

    Array.from(dropdown.children).forEach(child => {
      if (child.tagName === "BUTTON") {
        child.style.width = parentWidth + "px";  // match parent button width
      }
    });
  }, 0);

  return dropdown;
}




// === Build sub-toolbar ===
function buildSubToolbar(items, container = subToolbarContainer) {
  if (!container) return;

  // Clear + FORCE visibility (fixes "disappearing" bug)
  container.innerHTML = "";
  Object.assign(container.style, {
    display: "flex",
    position: "relative", // creates stacking context
    zIndex: "10",         // lower than dropdowns (which should be 1000+)
    backgroundColor: "#f5f5f5",
  });

  items.forEach(item => {
    const btn = document.createElement("button");
    btn.textContent = item.heading;

    Object.assign(btn.style, {
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      gap: "6px",
      padding: "4px 8px",
    });

    if (item.icon) {
      const icon = document.createElement("img");
      icon.src = item.icon;
      icon.alt = item.heading;
      Object.assign(icon.style, { width: "16px", height: "16px" });
      btn.prepend(icon);
    }

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
function showSubToolbar(panelHeading) {
  if (!subToolbarContainer) return;

  if (currentSubToolbarHeading === panelHeading) {
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

  if (!items.length) {
    subToolbarContainer.style.display = "none";
    currentSubToolbarHeading = null;
    return;
  }

  buildSubToolbar(items);
  currentSubToolbarHeading = panelHeading;
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
