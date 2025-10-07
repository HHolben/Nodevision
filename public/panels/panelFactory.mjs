// Nodevision/public/panels/panelFactory.mjs
// Creates DOM structures for different panel types (e.g., InfoPanel, CodeEditor, GraphPanel)

export function createPanelDOM(templateName, instanceId, panelType = "GenericPanel", panelVars = {}) {
  console.log(`createPanelDOM() called with templateName="${templateName}", panelType="${panelType}"`);

  // Create the panel container
  const panel = document.createElement("div");
  panel.classList.add("panel");
  panel.id = instanceId;

  // === Create header ===
  const header = document.createElement("div");
  header.classList.add("panel-header");
  header.textContent = templateName;

  // Control buttons
  const dockBtn = document.createElement("button");
  dockBtn.textContent = "⤓";
  dockBtn.classList.add("panel-dock-btn");

  const maxBtn = document.createElement("button");
  maxBtn.textContent = "⬜";
  maxBtn.classList.add("panel-max-btn");

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "✖";
  closeBtn.classList.add("panel-close-btn");

  header.appendChild(dockBtn);
  header.appendChild(maxBtn);
  header.appendChild(closeBtn);

  // === Create content area ===
  const content = document.createElement("div");
  content.classList.add("panel-content");

  // Different panel types can have different initial content
  switch (panelType) {
    case "InfoPanel":
      content.innerHTML = `
        <div class="info-panel">
          <h3>Information Panel</h3>
          <pre>${JSON.stringify(panelVars, null, 2)}</pre>
        </div>`;
      break;

    case "CodeEditor":
      content.innerHTML = `
        <textarea class="code-editor" spellcheck="false">// Start typing code...</textarea>`;
      break;

    case "FileView":
      content.innerHTML = `
        <div class="file-view">
          <p>Loading files from: ${panelVars.currentDirectory || "unknown directory"}</p>
        </div>`;
      break;

    case "GraphPanel":
      content.innerHTML = `
        <div class="graph-panel">
          <p>Graph visualization will appear here.</p>
        </div>`;
      break;

    default:
      content.innerHTML = `
        <div class="generic-panel">
          <p>Panel type: ${panelType}</p>
          <pre>${JSON.stringify(panelVars, null, 2)}</pre>
        </div>`;
  }

  // === Add resizer ===
  const resizer = document.createElement("div");
  resizer.classList.add("panel-resizer");

  // === Assemble the panel ===
  panel.appendChild(header);
  panel.appendChild(content);
  panel.appendChild(resizer);

  return { panel, header, dockBtn, maxBtn, closeBtn, resizer };
}
