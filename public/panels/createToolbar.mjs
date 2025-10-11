// Nodevision/public/createToolbar.mjs
// Fully prebuilt, instant toolbar and dropdowns

import { createPanel } from '/panels/panelManager.mjs';
import { dockPanel } from '/panels/panelControls.mjs';

let subToolbarContainer = null;
const toolbarDataCache = {}; // Preloaded JSON
const prebuiltDropdowns = {}; // Store prebuilt dropdown divs

export async function createToolbar(toolbarSelector = "#global-toolbar") {
  const toolbar = document.querySelector(toolbarSelector);
  subToolbarContainer = document.querySelector("#sub-toolbar");

  if (!toolbar) {
    console.error("Toolbar container not found!");
    return;
  }

  toolbar.innerHTML = "";
  if (subToolbarContainer) subToolbarContainer.innerHTML = "";

  // 1️⃣ Preload all toolbar JSON
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
      if (res.ok) {
        toolbarDataCache[file.split("/").pop()] = await res.json();
      }
    } catch (err) {
      console.warn("Failed to preload toolbar JSON:", file, err);
    }
  }));

  // 2️⃣ Prebuild all dropdowns
  for (const key in toolbarDataCache) {
    const items = toolbarDataCache[key];
    if (!Array.isArray(items)) continue;

    items.forEach(item => {
      const dropdown = buildDropdownFromItem(item);
      if (dropdown) prebuiltDropdowns[item.heading] = dropdown;
    });
  }

  // 3️⃣ Build main toolbar
  const defaultToolbar = toolbarDataCache["defaultToolbar.json"] || [];
  buildToolbar(toolbar, defaultToolbar);
}

// Build toolbar recursively (used for main and sub-toolbar)
function buildToolbar(container, items, parentHeading = null) {
  for (const item of items) {
    if (item.parentHeading && !parentHeading) continue;

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
    });
    btnWrapper.appendChild(btn);

    if (item.icon) {
      const icon = document.createElement("img");
      icon.src = item.icon;
      icon.alt = item.heading;
      Object.assign(icon.style, { width: "16px", height: "16px" });
      btn.prepend(icon);
    }

    // Attach prebuilt dropdown if exists
    const dropdown = prebuiltDropdowns[item.heading];
    if (dropdown) {
      btnWrapper.appendChild(dropdown);
      let hoverTimeout;
      btnWrapper.addEventListener("mouseenter", () => {
        clearTimeout(hoverTimeout);
        dropdown.style.display = "block";
      });
      btnWrapper.addEventListener("mouseleave", () => {
        hoverTimeout = setTimeout(() => (dropdown.style.display = "none"), 250);
      });
    }

    // Main click logic
    btn.addEventListener("click", (e) => {
      e.stopPropagation();

      // Panel creation
      if (item.panelTemplateId || item.panelTemplate) {
        const templateId = item.panelTemplateId || item.panelTemplate;
        const instanceVars = item.defaultInstanceVars || {};
        const moduleName =
          item.panelModule ||
          templateId.replace(".json", "").replace("Panel", "").replace("panel", "").replace(/^\w/, (c) => c.toUpperCase());
        const panelType = item.panelType || "InfoPanel";
        createPanel(moduleName, panelType, instanceVars);
      }

      // Import script
      if (item.script) import(`/ToolbarJSONfiles/${item.script}`);

      // Callback
      if (item.callbackKey && window.fileCallbacks?.[item.callbackKey]) {
        window.fileCallbacks[item.callbackKey]();
      }

      // Sub-toolbar
      if (subToolbarContainer) showSubToolbar(item.heading);

      // Toggle dropdown
      if (dropdown) {
        dropdown.style.display = dropdown.style.display === "block" ? "none" : "block";
      }
    });

    container.appendChild(btnWrapper);
  }
}

// Build dropdown div from toolbar item (returns prebuilt div or null)
function buildDropdownFromItem(item) {
  const normalizedHeading = item.heading?.toLowerCase();
  if (!normalizedHeading) return null;

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

// Show sub-toolbar for a panel
function showSubToolbar(panelHeading) {
  const items = toolbarDataCache["fileToolbar.json"] || [];
  const panelItems = items.filter(i => i.parentHeading === panelHeading);

  if (!panelItems.length) {
    subToolbarContainer.innerHTML = "";
    subToolbarContainer.style.display = "none";
    return;
  }

  subToolbarContainer.innerHTML = "";
  buildToolbar(subToolbarContainer, panelItems, panelHeading);
  subToolbarContainer.style.display = "flex";
  subToolbarContainer.style.borderTop = "1px solid #333";
  subToolbarContainer.style.padding = "4px";
  subToolbarContainer.style.backgroundColor = "#f5f5f5";
}
