// Nodevision/public/createToolbar.mjs
// Retrieves toolbar JSON files and injects HTML toolbar structure with support for panels and subtoolbars

import { createPanel } from '/panels/panelManager.mjs';
import { dockPanel } from '/panels/panelControls.mjs';

// Track already loaded toolbar JSON files to prevent recursion loops
const loadedToolbars = new Set();

export async function createToolbar(toolbarSelector = "#global-toolbar") {
  const toolbar = document.querySelector(toolbarSelector);
  if (!toolbar) {
    console.error("Toolbar container not found!");
    return;
  }

  console.log("Starting toolbar creation...");
  toolbar.innerHTML = "";

  let defaultToolbar = [];
  try {
    const res = await fetch("/ToolbarJSONfiles/defaultToolbar.json");
    if (res.ok) {
      defaultToolbar = await res.json();
      console.log("Loaded defaultToolbar.json:", defaultToolbar);
    } else {
      console.warn("defaultToolbar.json fetch returned non-OK:", res.status);
    }
  } catch (err) {
    console.error("Failed to load defaultToolbar.json:", err);
  }

  // Initialize recursion tracking
  const processed = new WeakSet();

  // Build main toolbar
  await buildToolbar(toolbar, defaultToolbar, processed, null);

  console.log("Toolbar created successfully.");
}

/**
 * Recursively builds toolbar buttons and their dropdowns
 */
async function buildToolbar(container, items, processed, parentHeading = null) {
  if (!items || !Array.isArray(items)) {
    console.warn("buildToolbar called with invalid items:", items);
    return;
  }

  for (const item of items) {
    console.log(`Processing toolbar item: ${item.heading}`);

    const btnWrapper = document.createElement("div");
    btnWrapper.className = "toolbar-button";
    btnWrapper.style.position = "relative";
    btnWrapper.style.display = "inline-block";
    btnWrapper.style.marginRight = "4px";

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
      gap: "6px"
    });
    btnWrapper.appendChild(btn);

    // Optional icon
    if (item.icon) {
      const icon = document.createElement("img");
      icon.src = item.icon;
      icon.alt = item.heading;
      Object.assign(icon.style, {
        width: "16px",
        height: "16px",
      });
      btn.prepend(icon);
      console.log(`Added icon for ${item.heading}`);
    }

    // === Dropdown setup (either from "children" or external JSON) ===
    let dropdown = null;
    const normalizedHeading = item.heading?.toLowerCase?.() || "";
    const jsonFile = `/ToolbarJSONfiles/${normalizedHeading}Toolbar.json`;

    try {
      if (item.children && Array.isArray(item.children) && item.children.length > 0) {
        dropdown = await createSubToolbar(item.children, processed, item.heading);
      } else if (
        normalizedHeading &&
        normalizedHeading !== parentHeading?.toLowerCase() &&
        !loadedToolbars.has(normalizedHeading)
      ) {
        const res = await fetch(jsonFile);
        if (res.ok) {
          const subItems = await res.json();
          if (Array.isArray(subItems) && subItems.length > 0) {
            loadedToolbars.add(normalizedHeading);
            dropdown = await createSubToolbar(subItems, processed, item.heading);
          }
        }
      } else {
        if (normalizedHeading)
          console.log(`Skipping submenu load for "${normalizedHeading}"`);
      }
    } catch (err) {
      console.warn(`Error fetching submenu for ${item.heading}:`, err);
    }

    // Attach dropdown if available
    if (dropdown) {
      btnWrapper.appendChild(dropdown);

      btnWrapper.addEventListener("mouseenter", () => {
        dropdown.style.display = "block";
      });
      btnWrapper.addEventListener("mouseleave", () => {
        dropdown.style.display = "none";
      });
    }

    // === Click handler for this button ===
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      console.log(`Toolbar button clicked: ${item.heading}`);

      try {
        // (1) Create panel if specified
        if (item.panelTemplateId || item.panelTemplate) {
          const templateId = item.panelTemplateId || item.panelTemplate;
          const instanceVars = item.defaultInstanceVars || {};

          const moduleName =
            item.panelModule ||
            templateId
              .replace(".json", "")
              .replace("Panel", "")
              .replace("panel", "")
              .replace(/^\w/, (c) => c.toUpperCase());

          const panelType = item.panelType || "InfoPanel";

          console.log(
            `Creating panel instance "${moduleName}" (type: ${panelType}) with vars:`,
            instanceVars
          );
          await createPanel(moduleName, panelType, instanceVars);
        }

        // (2) Run script if provided
        if (item.script) {
          console.log(`Importing script: ${item.script}`);
          await import(`/ToolbarJSONfiles/${item.script}`);
        }

        // (3) Trigger callback if defined
        if (item.callbackKey && window.fileCallbacks?.[item.callbackKey]) {
          console.log(`Executing callback: ${item.callbackKey}`);
          window.fileCallbacks[item.callbackKey]();
        }

        // (4) Toggle dropdown manually (click-to-open behavior)
        if (dropdown) {
          dropdown.style.display =
            dropdown.style.display === "block" ? "none" : "block";
        }
      } catch (err) {
        console.error("Error handling toolbar item:", err);
      }
    });

    container.appendChild(btnWrapper);
  }
}

/**
 * Creates a dropdown (sub-toolbar) from a list of items
 */
async function createSubToolbar(items, processed, parentHeading) {
  const dropdown = document.createElement("div");
  dropdown.className = "toolbar-dropdown";
  Object.assign(dropdown.style, {
    position: "absolute",
    top: "100%",
    left: "0",
    backgroundColor: "#fff",
    border: "1px solid #333",
    display: "none",
    minWidth: "180px",
    zIndex: "1000",
    boxShadow: "2px 2px 6px rgba(0,0,0,0.2)",
    padding: "4px",
  });

  await buildToolbar(dropdown, items, processed, parentHeading);
  return dropdown;
}
