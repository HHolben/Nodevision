//Nodevision/public/createToolbar.mjs
//This file retrieves the toolbar json files and injects the html toolbar with its contents
export async function createToolbar(toolbarSelector = "#global-toolbar") {
  const toolbar = document.querySelector(toolbarSelector);
  if (!toolbar) {
    console.error("Toolbar container not found!");
    return;
  }

  toolbar.innerHTML = "";

  // Load the top-level defaultToolbar
  let defaultToolbar = [];
  try {
    const res = await fetch("/ToolbarJSONfiles/defaultToolbar.json");
    if (res.ok) {
      defaultToolbar = await res.json();
    }
  } catch (err) {
    console.error("Failed to load defaultToolbar.json:", err);
  }

  for (const top of defaultToolbar) {
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

    // Attach icon if present
    if (top.icon) {
      const icon = document.createElement("img");
      icon.src = top.icon;
      icon.alt = top.heading;
      icon.style.width = "16px";
      icon.style.height = "16px";
      btn.prepend(icon);
    }

    // Try to load a submenu JSON file for this heading
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

    const jsonFile = `/ToolbarJSONfiles/${top.heading.toLowerCase()}Toolbar.json`;
    let submenuAttached = false;

    try {
      const res = await fetch(jsonFile);
      if (res.ok) {
        const items = await res.json();
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

          if (item.script) {
            subBtn.addEventListener("click", async () => {
              console.log(`Clicked: ${item.heading}`);
              try { await import(`./ToolbarJSONfiles/${item.script}`); }
              catch(e){ console.error(e); }
            });
          }

          dropdown.appendChild(subBtn);
        });

        if (items.length > 0) {
          btnWrapper.appendChild(dropdown);
          btnWrapper.addEventListener("mouseenter", () => dropdown.style.display = "block");
          btnWrapper.addEventListener("mouseleave", () => dropdown.style.display = "none");
          submenuAttached = true;
        }
      }
    } catch (err) {
      console.warn(`No submenu JSON found for ${top.heading}`, err);
    }

    // If no submenu, attach callbackKey directly
    if (!submenuAttached && top.callbackKey) {
      btn.addEventListener("click", () => {
        console.log(`Callback triggered: ${top.callbackKey}`);
        // TODO: implement callback map if needed
      });
    }

    toolbar.appendChild(btnWrapper);
  }

  console.log("Toolbar created with dropdowns where available, buttons otherwise");
}
