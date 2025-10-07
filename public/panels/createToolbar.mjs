// Nodevision/public/createToolbar.mjs
// This file retrieves the toolbar JSON files and injects the HTML toolbar with its contents
import { createPanel } from '/panels/panelManager.mjs';
import { dockPanel } from '/panels/panelControls.mjs';

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

    // === Dropdown menu setup ===
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
      zIndex: "1000"
    });

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

          // === Submenu click handler ===
          subBtn.addEventListener("click", async (e) => {
            e.stopPropagation();
            e.preventDefault();
            console.log(`Sub-toolbar button clicked: ${item.heading}`);

            try {
              // (1) Create panel if defined
              if (item.panelTemplateId || item.panelTemplate) {
                const templateId = item.panelTemplateId || item.panelTemplate;
                const instanceVars = item.defaultInstanceVars || {};
                console.log(`Creating panel (${templateId}) with vars:`, instanceVars);
                await createPanel(templateId, instanceVars);
              }

              // (2) Run script if provided
              if (item.script) {
                console.log(`Importing script: ${item.script}`);
                await import(`/ToolbarJSONfiles/${item.script}`);
              }

              // (3) Trigger callback if defined
              if (item.callbackKey && window.fileCallbacks && typeof window.fileCallbacks[item.callbackKey] === "function") {
                console.log(`Executing callback: ${item.callbackKey}`);
                window.fileCallbacks[item.callbackKey]();
              }
            } catch (err) {
              console.error("Error handling toolbar submenu item:", err);
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

    // === Top-level button handler ===
    btn.addEventListener("click", async () => {
      try {
        if (top.panelTemplateId || top.panelTemplate) {
          const templateId = top.panelTemplateId || top.panelTemplate;
          const instanceVars = top.defaultInstanceVars || {};
          console.log(`Creating top-level panel: ${templateId}`, instanceVars);
          await createPanel(templateId, instanceVars);
        } else if (top.callbackKey && window.fileCallbacks?.[top.callbackKey]) {
          window.fileCallbacks[top.callbackKey]();
        } else {
          console.log(`No panel or callback for ${top.heading}`);
        }
      } catch (err) {
        console.error(`Error creating panel for ${top.heading}:`, err);
      }
    });

    toolbar.appendChild(btnWrapper);
  }

  console.log("Toolbar created successfully.");
}
