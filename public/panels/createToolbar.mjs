// Nodevision/public/createToolbar.mjs
// Builds main toolbar and dynamic sub-toolbar (e.g., file operations when File Manager is opened)

import { createPanel } from '/panels/panelManager.mjs';
import { dockPanel } from '/panels/panelControls.mjs';

const loadedToolbars = new Set();
let subToolbarContainer = null;

export async function createToolbar(toolbarSelector = "#global-toolbar") {
  const toolbar = document.querySelector(toolbarSelector);
  subToolbarContainer = document.querySelector("#sub-toolbar");

  if (!toolbar) {
    console.error("Toolbar container not found!");
    return;
  }

  console.log("Starting toolbar creation...");
  toolbar.innerHTML = "";
  if (subToolbarContainer) subToolbarContainer.innerHTML = "";

  let defaultToolbar = [];
  try {
    const res = await fetch("/ToolbarJSONfiles/defaultToolbar.json");
    if (res.ok) {
      defaultToolbar = await res.json();
      console.log("Loaded defaultToolbar.json:", defaultToolbar);
    }
  } catch (err) {
    console.error("Failed to load defaultToolbar.json:", err);
  }

  await buildToolbar(toolbar, defaultToolbar);
  console.log("Toolbar created successfully.");
}

/**
 * Builds toolbar and dropdowns recursively
 */
async function buildToolbar(container, items, parentHeading = null) {
  for (const item of items) {
    // Skip items that have parentHeading (they belong in a sub-toolbar)
    if (item.parentHeading && !parentHeading) continue;

    const btnWrapper = document.createElement("div");
    btnWrapper.className = "toolbar-button";
    Object.assign(btnWrapper.style, {
      position: "relative",
      display: "inline-block",
      marginRight: "4px",
    });

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

    // Add icon if specified
    if (item.icon) {
      const icon = document.createElement("img");
      icon.src = item.icon;
      icon.alt = item.heading;
      Object.assign(icon.style, { width: "16px", height: "16px" });
      btn.prepend(icon);
    }

    // Load submenu from JSON if available
    const normalizedHeading = item.heading?.toLowerCase() || "";
    const jsonFile = `/ToolbarJSONfiles/${normalizedHeading}Toolbar.json`;

    let dropdown = null;
    try {
      if (item.children && Array.isArray(item.children)) {
        dropdown = await createSubToolbar(item.children, item.heading);
      } else if (!loadedToolbars.has(normalizedHeading)) {
        const res = await fetch(jsonFile);
        if (res.ok) {
          const subItems = await res.json();
          if (Array.isArray(subItems) && subItems.length > 0) {
            // Only include top-level items in dropdown (ignore parentHeading items)
            const topItems = subItems.filter(i => !i.parentHeading);
            if (topItems.length) {
              loadedToolbars.add(normalizedHeading);
              dropdown = await createSubToolbar(topItems, item.heading);
            }
          }
        }
      }
    } catch (err) {
      console.warn(`Error fetching submenu for ${item.heading}:`, err);
    }

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
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      console.log(`Toolbar button clicked: ${item.heading}`);

      try {
        // (1) Create panel
        if (item.panelTemplateId || item.panelTemplate) {
          const templateId = item.panelTemplateId || item.panelTemplate;
          const instanceVars = item.defaultInstanceVars || {};
          const moduleName =
            item.panelModule ||
            templateId.replace(".json", "").replace("Panel", "").replace("panel", "").replace(/^\w/, (c) => c.toUpperCase());
          const panelType = item.panelType || "InfoPanel";
          await createPanel(moduleName, panelType, instanceVars);
        }

        // (2) Import script
        if (item.script) {
          await import(`/ToolbarJSONfiles/${item.script}`);
        }

        // (3) Trigger callback
        if (item.callbackKey && window.fileCallbacks?.[item.callbackKey]) {
          window.fileCallbacks[item.callbackKey]();
        }

        // (4) Activate sub-toolbar for panel (like File Manager)
        if (subToolbarContainer) {
          await createSubToolbarForPanel(item.heading);
        }

        // (5) Toggle dropdown if present
        if (dropdown) {
          dropdown.style.display = dropdown.style.display === "block" ? "none" : "block";
        }
      } catch (err) {
        console.error("Error handling toolbar item:", err);
      }
    });

    container.appendChild(btnWrapper);
  }
}

/**
 * Creates dropdown submenus
 */
async function createSubToolbar(items, parentHeading) {
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

  await buildToolbar(dropdown, items, parentHeading);
  return dropdown;
}


/**
 * Populates the #sub-toolbar for a given panel
 */
async function createSubToolbarForPanel(panelHeading) {
  try {
    const res = await fetch("/ToolbarJSONfiles/fileToolbar.json"); // Load all File items
    if (!res.ok) return;

    const items = await res.json();

    // Only include items whose parentHeading matches the panel
    const panelItems = items.filter(i => i.parentHeading === panelHeading);

    if (!panelItems.length) {
      subToolbarContainer.innerHTML = "";
      subToolbarContainer.style.display = "none";
      return;
    }

    subToolbarContainer.innerHTML = "";

    // Pass panelHeading so buildToolbar knows these are sub-toolbar items
    await buildToolbar(subToolbarContainer, panelItems, panelHeading);

    subToolbarContainer.style.display = "flex";
    subToolbarContainer.style.borderTop = "1px solid #333";
    subToolbarContainer.style.padding = "4px";
    subToolbarContainer.style.backgroundColor = "#f5f5f5";
  } catch (err) {
    console.error("Error creating sub-toolbar:", err);
  }
}

