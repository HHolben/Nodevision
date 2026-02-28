// Nodevision/public/panels/panelManager.mjs
// Handles creating and managing panels dynamically (backwards-compatible)

export async function createPanel(panelType, instanceVars = {}, panelPath = null, targetElem = null) {
  try {
    console.log(`createPanel(): Creating panel for type "${panelType}"`);

    // If panelType is already a DOM element
    if (panelType instanceof HTMLElement) {
      (targetElem || document.querySelector("#panel-container") || document.body)
        .appendChild(panelType);
      return panelType;
    }

    // Create the panel container
    const panel = document.createElement("div");
    panel.classList.add("info-panel");
    panel.dataset.type = panelType;
    Object.assign(panel.style, {
      border: "1px solid #999",
      margin: "4px",
      padding: "8px",
      background: "#fafafa",
      flex: "1",
      display: "flex",
      flexDirection: "column",
    });

    // Dynamic module path
    const modulePath = panelPath || `../PanelInstances/InfoPanels/${panelType}.mjs`;
    console.log(`Loading panel module from: ${modulePath}`);

    try {
      const panelModule = await import(modulePath);

      if (typeof panelModule.setupPanel === "function") {
        // Pass the panel DOM element and vars to the module
        await panelModule.setupPanel(panel, instanceVars);
      } else {
        panel.innerHTML = `<b>${panelType}</b> (no setupPanel() function found)`;
        console.warn(`Module ${panelType} loaded, but no setupPanel() found.`);
      }

    } catch (importErr) {
      console.warn(`Failed to import panel module at ${modulePath}:`, importErr);
      panel.innerHTML = `Panel type: ${panelType}<br>No JS module found.`;
    }

    // 🟩 Determine where to place this panel
    const container =
      targetElem ||
      document.querySelector("#panel-container") ||
      document.body;

    // 🟨 If replacing an active cell, clear it first
    if (container.classList.contains("panel-cell")) {
      container.innerHTML = "";
      Object.assign(panel.style, {
        width: "100%",
        height: "100%",
        minHeight: "0",
        margin: "0",
      });
      container.appendChild(panel);
    } else {
      container.appendChild(panel);
    }

    console.log(`Panel "${panelType}" created successfully.`);
    return panel;

  } catch (err) {
    console.error("createPanel() failed:", err);
    throw err;
  }
}
