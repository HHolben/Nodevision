// Nodevision/public/panels/panelManager.mjs
// Handles creating and managing panels dynamically (backwards-compatible)


export async function createPanel(panelType, instanceVars = {}, panelPath = null) {
  try {
    console.log(`createPanel(): Creating panel for type "${panelType}"`);

    // If panelType is already a DOM element
    if (panelType instanceof HTMLElement) {
      document.querySelector("#panel-container")?.appendChild(panelType);
      return panelType;
    }

    // Create the panel container
    const panel = document.createElement("div");
    panel.classList.add("info-panel");
    panel.dataset.type = panelType;
    panel.style.border = "1px solid #999";
    panel.style.margin = "4px";
    panel.style.padding = "8px";
    panel.style.background = "#fafafa";

    // Dynamic module path
    // Use panelPath if provided; else fallback to old pattern
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

    // Append panel to container
    const container = document.querySelector("#panel-container");
    if (container) container.appendChild(panel);
    else document.body.appendChild(panel);

    console.log(`Panel "${panelType}" created successfully.`);
    return panel;

  } catch (err) {
    console.error("createPanel() failed:", err);
    throw err;
  }
}
