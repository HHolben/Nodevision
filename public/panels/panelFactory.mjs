// Nodevision/public/panels/panelFactory.mjs
// Builds the DOM structure for panels and loads behavior/variables from panelDefinitions.json

import { styleControlButton } from "./utils.mjs";

/**
 * Load panel definitions from JSON
 */
export async function loadPanelDefinitions() {
  const response = await fetch("/panels/panelDefinitions.json");
  if (!response.ok) throw new Error("Failed to load panel definitions");
  return await response.json();
}

/**
 * Create a panel DOM element based on its template definition
 */
export async function createPanelDOM(templateName, instanceId, extraVars = {}) {
  const panelDefs = await loadPanelDefinitions();
  const template = panelDefs.templates[templateName];

  if (!template) {
    console.warn(`Panel template "${templateName}" not found in panelDefinitions.json`);
  }

  // --- Panel container ---
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
    background: template?.appearance?.background || "#fff",
    border: "1px solid #ccc",
  });

  // --- Header ---
  const header = document.createElement("div");
  header.className = "panel-header";
  Object.assign(header.style, {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "6px 8px",
    background: template?.appearance?.headerBackground || "#333",
    color: template?.appearance?.headerColor || "#fff",
    cursor: "grab",
    userSelect: "none",
  });

  const titleSpan = document.createElement("span");
  titleSpan.textContent = template?.displayName
    ? `${template.displayName} (${instanceId})`
    : `${templateName} (${instanceId})`;
  titleSpan.style.fontSize = "13px";

  // --- Header controls ---
  const controls = document.createElement("div");
  controls.className = "panel-controls";
  controls.style.display = "flex";
  controls.style.gap = "6px";

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

  // --- Content area ---
  const content = document.createElement("div");
  content.className = "panel-content";
  Object.assign(content.style, {
    padding: "8px",
    flex: "1",
    overflow: "auto",
  });

  // Define default text before behavior module loads
  content.textContent = `Loading content for "${templateName}" — instance ${instanceId}`;

  // --- Resizer ---
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

  // Append elements
  panel.appendChild(header);
  panel.appendChild(content);
  panel.appendChild(resizer);

  // --- Apply variables and behavior ---
  const mergedVars = { ...(template?.variables || {}), ...extraVars };
  if (template?.behavior?.module) {
    try {
      const behaviorModule = await import(template.behavior.module);
      if (behaviorModule && behaviorModule.initializePanel) {
        behaviorModule.initializePanel(panel, mergedVars);
      }
    } catch (err) {
      console.error(`Error loading behavior module for ${templateName}:`, err);
    }
  }

  return { panel, header, dockBtn, maxBtn, closeBtn, resizer, content };
}
