// Nodevision/public/panels/panelFactory.mjs
// This file implements the dom structure needed for panels.
import { styleControlButton } from "./utils.mjs";

export function createPanelDOM(templateName, instanceId) {
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

  // Content
  const content = document.createElement("div");
  content.className = "panel-content";
  Object.assign(content.style, {
    padding: "8px",
    flex: "1",
    overflow: "auto",
  });
  content.textContent = `Content for "${templateName}" — instance ${instanceId}`;

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

  panel.appendChild(header);
  panel.appendChild(content);
  panel.appendChild(resizer);

  return { panel, header, dockBtn, maxBtn, closeBtn, resizer };
}
