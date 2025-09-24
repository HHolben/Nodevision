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

    // Only add dropdown for "File"
    if (top.heading === "File") {
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

      try {
        const res = await fetch("/ToolbarJSONfiles/fileToolbar.json");
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
        }
      } catch (err) {
        console.error("Failed to load fileToolbar.json:", err);
      }

      btnWrapper.appendChild(dropdown);
      btnWrapper.addEventListener("mouseenter", () => dropdown.style.display = "block");
      btnWrapper.addEventListener("mouseleave", () => dropdown.style.display = "none");
    }

    toolbar.appendChild(btnWrapper);
  }

  console.log("Toolbar created with File dropdown and other buttons");
}
