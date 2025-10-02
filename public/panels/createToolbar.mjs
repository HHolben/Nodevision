// Nodevision/public/createToolbar.mjs
// This file retrieves the toolbar JSON files and injects the HTML toolbar with its contents
// Nodevision/public/createToolbar.mjs
import { createPanel } from '/panels/panelManager.mjs';
import { dockPanel } from '/panels/panelControls.mjs';  // << add this

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

  for (const top of defaultToolbar) {
    console.log("Processing top-level toolbar item:", top.heading);

    const btnWrapper = document.createElement("div");
    btnWrapper.className = "toolbar-button";
    btnWrapper.style.position = "relative";

    const btn = document.createElement("button");
    btn.textContent = top.heading;
    btn.style.margin = "2px";
    btn.style.padding = "4px 8px";
    btn.style.border = "1px solid #333";
    btn.style.backgroundColor = "#eee";
    btnWrapper.appendChild(btn);

    if (top.icon) {
      const icon = document.createElement("img");
      icon.src = top.icon;
      icon.alt = top.heading;
      icon.style.width = "16px";
      icon.style.height = "16px";
      btn.prepend(icon);
      console.log(`Added icon for ${top.heading}`);
    }

    // Create dropdown container
    const dropdown = document.createElement("div");
    dropdown.className = "toolbar-dropdown";
    dropdown.style.position = "absolute";
    dropdown.style.top = "100%";
    dropdown.style.left = "0";
    dropdown.style.backgroundColor = "#fff";
    dropdown.style.border = "1px solid #333";
    dropdown.style.display = "none";
    dropdown.style.minWidth = "180px";
    dropdown.style.zIndex = "1000";

    let submenuAttached = false;
    const jsonFile = `/ToolbarJSONfiles/${top.heading.toLowerCase()}Toolbar.json`;

    try {
      const res = await fetch(jsonFile);
      if (res.ok) {
        const items = await res.json();
        console.log(`Loaded submenu JSON for ${top.heading}:`, items);

        items.forEach(item => {
          const subBtn = document.createElement("button");
          subBtn.style.display = "flex";
          subBtn.style.alignItems = "center";
          subBtn.style.gap = "4px";
          subBtn.style.width = "100%";
          subBtn.style.border = "none";
          subBtn.style.background = "none";
          subBtn.style.padding = "4px 8px";
          subBtn.style.textAlign = "left";
          subBtn.style.cursor = "pointer";

          if (item.icon) {
            const icon = document.createElement("img");
            icon.src = item.icon;
            icon.alt = item.heading;
            icon.style.width = "16px";
            icon.style.height = "16px";
            subBtn.appendChild(icon);
          }

          const text = document.createElement("span");
          text.textContent = item.heading;
          subBtn.appendChild(text);

          // Submenu click handler
          subBtn.addEventListener("click", async (e) => {
            e.stopPropagation();
            e.preventDefault();
            console.log(`Sub-toolbar button clicked: ${item.heading}`);

            if (item.panelTemplate) {
              console.log(`Creating panel for submenu item: ${item.heading}`);
              createPanel(item.panelTemplate);
            }

            if (item.script) {
              try {
                await import(`./ToolbarJSONfiles/${item.script}`);
              } catch (err) {
                console.error(err);
              }
            }
          });

          dropdown.appendChild(subBtn);
        });

        if (items.length > 0) {
          btnWrapper.appendChild(dropdown);
          btnWrapper.addEventListener("mouseenter", () => dropdown.style.display = "block");
          btnWrapper.addEventListener("mouseleave", () => dropdown.style.display = "none");
          submenuAttached = true;
        }
      } else {
        console.log(`No submenu JSON found for ${top.heading}: ${res.status}`);
      }
    } catch (err) {
      console.warn(`Error fetching submenu for ${top.heading}:`, err);
    }

    // Top-level button click handler
    if (top.panelTemplate) {
      btn.addEventListener("click", () => {
        console.log(`Clicked top-level panel button: ${top.heading}`);
        createPanel(top.panelTemplate);
      });
    } else if (!submenuAttached && top.callbackKey) {
      btn.addEventListener("click", () => {
        console.log(`Callback triggered: ${top.callbackKey}`);
      });
    }

    toolbar.appendChild(btnWrapper);
  }

  // === FILE MANAGER PANEL HANDLER ===
window.fileManagerPanelCount = window.fileManagerPanelCount || 0;

function openNewFileManagerPanel(initialPath = '') {
  window.fileManagerPanelCount += 1;
  const panelId = `fileViewPanel_${window.fileManagerPanelCount}`;
  
  if (window.fileCallbacks && typeof window.fileCallbacks.openFileManager === 'function') {
    window.fileCallbacks.openFileManager(panelId, initialPath);
  }
}

// Example: attach to File -> Files menu item
const fileMenuFilesItem = document.querySelector("[data-menu='Files']"); // or use your ID
if (fileMenuFilesItem) {
  fileMenuFilesItem.addEventListener('click', () => {
    openNewFileManagerPanel(''); // '' = Notebook root
  });
}


  console.log("Toolbar created successfully.");
}
