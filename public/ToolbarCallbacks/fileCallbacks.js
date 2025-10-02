// Nodevision/public/panels/panelFactory.mjs
// Purpose: Central panel creation and content management for Nodevision

import { styleControlButton } from "./utils.mjs";

/**
 * Fetches directory contents from the server and passes them to a callback.
 */
export async function fetchDirectoryContents(path, callback, errorElem, loadingElem) {
  try {
    if (loadingElem) loadingElem.style.display = "block";
    const response = await fetch(`/Notebook/${path}`);
    if (!response.ok) throw new Error(`Failed to fetch directory: ${response.status}`);
    const data = await response.json();
    callback(data);
  } catch (err) {
    console.error(err);
    if (errorElem) errorElem.textContent = err.message;
  } finally {
    if (loadingElem) loadingElem.style.display = "none";
  }
}

/**
 * Displays a list of files in a given container element.
 */
function displayFiles(files, container, panelState) {
  if (!container) return;
  container.innerHTML = "";

  files.forEach(file => {
    const row = document.createElement("div");
    row.textContent = file.name;
    row.className = file.type === "directory" ? "directory" : "file";
    row.style.cursor = "pointer";

    if (file.type === "directory") {
      row.style.fontWeight = "bold";
      row.addEventListener("click", () => {
        panelState.currentDirectory = `${panelState.currentDirectory}/${file.name}`;
        renderDirectory(panelState, container);
      });
    } else {
      row.addEventListener("click", () => {
        panelState.selectedFile = `${panelState.currentDirectory}/${file.name}`;
        console.log("Selected file:", panelState.selectedFile);
        if (typeof window.updateInfoPanel === "function") {
          window.updateInfoPanel(panelState.selectedFile);
        }
      });
    }

    container.appendChild(row);
  });
}

/**
 * Renders the directory listing in a panel.
 */
export async function renderDirectory(panelState, container) {
  container.innerHTML = `<div class="loading">Loading files...</div>`;
  try {
    await fetchDirectoryContents(
      panelState.currentDirectory || "",
      files => displayFiles(files, container, panelState),
      container,
      container
    );
  } catch (err) {
    container.innerHTML = `<div class="error">Failed to load directory: ${err.message}</div>`;
  }
}

/**
 * Builds panel content based on type.
 */
export function buildPanelContent(type, container) {
  container.innerHTML = ""; // clear first

  if (type === "fileView") {
    // ✅ Minimal test content
    const p = document.createElement("p");
    p.textContent = "test successful";
    container.appendChild(p);
  } else {
    const p = document.createElement("p");
    p.textContent = `Default content for "${type}"`;
    container.appendChild(p);
  }
}


/**
 * Creates the full DOM structure for a panel.
 */
export function createPanelDOM(templateName, instanceId, initialPath = "") {
  const panel = document.createElement("div");
  panel.className = "panel docked";
  panel.dataset.template = templateName;
  panel.dataset.instanceId = instanceId;

  Object.assign(panel.style, {
    position: "relative",
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    boxSizing: "border-box",
    background: "#fff",
    border: "1px solid #ccc",
  });

  // Header
  const header = document.createElement("div");
  header.className = "panel-header";
  Object.assign(header.style, {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "6px 8px",
    background: "#333",
    color: "#fff",
    cursor: "grab",
    userSelect: "none",
  });

  const titleSpan = document.createElement("span");
  titleSpan.textContent = `${templateName} (${instanceId})`;
  titleSpan.style.fontSize = "13px";

  const controls = document.createElement("div");
  controls.className = "panel-controls";
  controls.style.display = "flex";
  controls.style.gap = "6px";

  // Control buttons
  const dockBtn = document.createElement("button");
  dockBtn.className = "dock-btn";
  dockBtn.title = "Dock / Undock";
  dockBtn.textContent = "⇔";
  styleControlButton(dockBtn);

  const maxBtn = document.createElement("button");
  maxBtn.className = "max-btn";
  maxBtn.title = "Maximize / Restore";
  maxBtn.textContent = "⬜";
  styleControlButton(maxBtn);

  const closeBtn = document.createElement("button");
  closeBtn.className = "close-btn";
  closeBtn.title = "Close";
  closeBtn.textContent = "✕";
  styleControlButton(closeBtn);

  controls.appendChild(dockBtn);
  controls.appendChild(maxBtn);
  controls.appendChild(closeBtn);

  header.appendChild(titleSpan);
  header.appendChild(controls);

  // Content area
  const content = document.createElement("div");
  content.className = "panel-content";
  Object.assign(content.style, {
    padding: "8px",
    flex: "1",
    overflow: "auto",
  });

  // Build content
  buildPanelContent(templateName, content, initialPath);

  // Resizer
  const resizer = document.createElement("div");
  resizer.className = "resize-handle";
  Object.assign(resizer.style, {
    width: "12px",
    height: "12px",
    position: "absolute",
    right: "2px",
    bottom: "2px",
    cursor: "se-resize",
    background: "#777",
    display: "none",
  });

  // Assemble
  panel.appendChild(header);
  panel.appendChild(content);
  panel.appendChild(resizer);

  return { panel, header, dockBtn, maxBtn, closeBtn, resizer, content };
}

/**
 * Opens a file manager panel instance.
 */
export function openFileManager(panelId, initialPath = "") {
  let panel = document.getElementById(panelId);
  if (!panel) {
    const { panel: domPanel } = createPanelDOM("fileView", panelId, initialPath);
    domPanel.id = panelId;
    document.body.appendChild(domPanel);
    panel = domPanel;
  } else {
    // Refresh existing panel
    const content = panel.querySelector(".panel-content");
    buildPanelContent("fileView", content, initialPath);
  }
}
