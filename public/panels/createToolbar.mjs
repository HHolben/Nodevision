// Nodevision/public/createToolbar.mjs
// Fully prebuilt, instant toolbar and dropdowns

import { createPanel } from '/panels/panelManager.mjs';
import { dockPanel } from '/panels/panelControls.mjs';
import { loadCallback } from "/callbackLoader.mjs";

let currentSubToolbarHeading = null;
let subToolbarContainer = null;
const toolbarDataCache = {}; // Preloaded JSON
const prebuiltDropdowns = {}; // Store prebuilt dropdown divs

// === Global Nodevision State ===
window.NodevisionState = window.NodevisionState || {
  activePanelType: null,
  fileIsDirty: false,
  selectedFile: null,
};

// === Helper: Check toolbar item conditions ===
function checkToolbarConditions(item, state) {
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

// === Main export: create toolbar ===
export async function createToolbar(toolbarSelector = "#global-toolbar") {
  const toolbar = document.querySelector(toolbarSelector);
  subToolbarContainer = document.querySelector("#sub-toolbar");

  if (!toolbar) return console.error("Toolbar container not found!");
  toolbar.innerHTML = "";
  if (subToolbarContainer) subToolbarContainer.innerHTML = "";

  // Preload toolbar JSON
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

  // Prebuild dropdowns
  for (const key in toolbarDataCache) {
    const items = toolbarDataCache[key];
    if (!Array.isArray(items)) continue;
    items.forEach(item => {
      const dropdown = buildDropdownFromItem(item);
      if (dropdown) prebuiltDropdowns[item.heading] = dropdown;
    });
  }

  // Build main toolbar
  const defaultToolbar = toolbarDataCache["defaultToolbar.json"] || [];
  buildToolbar(toolbar, defaultToolbar);
}

// === Build toolbar buttons (main or sub-toolbar) ===
function buildToolbar(container, items, parentHeading = null) {
  const state = window.NodevisionState;

  items.forEach(item => {
    if (item.parentHeading && !parentHeading) return;

    const btnWrapper = document.createElement("div");
    btnWrapper.className = "toolbar-button";
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

      // Panel
      if (item.panelTemplateId || item.panelTemplate) {
        const templateId = item.panelTemplateId || item.panelTemplate;
        const moduleName = (item.panelModule ||
          templateId.replace(".json", "").replace("Panel", "").replace("panel", "").replace(/^\w/, c => c.toUpperCase()));
        const panelType = item.panelType || "InfoPanel";
        createPanel(moduleName, panelType, item.defaultInstanceVars || {});
      }

      // Script import
      if (item.script) import(`/ToolbarJSONfiles/${item.script}`);

      // Callback
      if (item.callbackKey && item.ToolbarCategory) handleToolbarClick(item.ToolbarCategory, item.callbackKey);

      // Sub-toolbar
      if (subToolbarContainer) showSubToolbar(item.heading);

      // Show dropdown if exists
      if (dropdown) dropdown.style.display = "block";
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
    backgroundColor: "#fff",
    border: "1px solid #333",
    display: "none",
    minWidth: "180px",
    zIndex: "9999",
    boxShadow: "2px 2px 6px rgba(0,0,0,0.2)",
    padding: "4px",
  });

  buildToolbar(dropdown, topItems);
  return dropdown;
}

// === Build sub-toolbar ===
function buildSubToolbar(items, container = subToolbarContainer) {
  if (!container) return;
  container.innerHTML = "";

  items.forEach(item => {
    const btn = document.createElement("button");
    btn.textContent = item.heading;
    Object.assign(btn.style, {
      margin: "2px",
      padding: "4px 8px",
      border: "1px solid #333",
      backgroundColor: "#ddd",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      gap: "6px",
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
        const moduleName = templateId.replace(".json", "").replace("Panel", "").replace("panel", "").replace(/^\w/, c => c.toUpperCase());
        const panelType = item.panelType || "InfoPanel";
        createPanel(moduleName, panelType, item.defaultInstanceVars || {});
      }
      if (item.callbackKey && item.ToolbarCategory) handleToolbarClick(item.ToolbarCategory, item.callbackKey);
    });

    container.appendChild(btn);
  });

  Object.assign(container.style, {
    display: "flex",
    borderTop: "1px solid #333",
    padding: "4px",
    backgroundColor: "#f5f5f5",
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
  Object.assign(window.NodevisionState, newState);
  const toolbar = document.querySelector("#global-toolbar");
  if (toolbar) {
    toolbar.innerHTML = "";
    const defaultToolbar = toolbarDataCache["defaultToolbar.json"] || [];
    buildToolbar(toolbar, defaultToolbar);
  }
}
