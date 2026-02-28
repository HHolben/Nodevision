// Nodevision/public/panels/panelControls.mjs
// This module declares logic needed for docking, undocking, maximizing, and closing.
import { bringToFront, createOverlayLayer } from "./utils.mjs";
import { ensureWorkspace, insertRowWithDivider } from "./rowManager.mjs";
import { createCell } from "./workspace.mjs";


export function attachControlEvents(panel, dockBtn, maxBtn, closeBtn) {
  // Dock / Undock
  dockBtn.addEventListener("click", (e) => {
    e.stopPropagation();

    const isDocked = panel.classList.contains("docked");
    if (!isDocked) {
      // Dock
      dockPanel(panel);
    } else {
      // Undock
      undockPanel(panel);
    }
  });

  // Maximize / Restore
  maxBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    panel.classList.toggle("maximized");
    if (panel.classList.contains("maximized")) {
      Object.assign(panel.style, {
        position: "fixed",
        top: "0",
        left: "0",
        width: "100vw",
        height: "100vh",
        zIndex: 2000,
      });
    } else {
      Object.assign(panel.style, {
        position: "relative",
        width: "100%",
        height: "100%",
        zIndex: "",
      });
    }
  });

  // Close
  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    panel.remove();
  });
}


export function dockPanel(panel) {
      console.log("dockPanel called for panel:", panel.dataset.instanceId);

  const workspace = ensureWorkspace();

  // Ensure at least one row exists
  let rows = workspace.querySelectorAll(".panel-row");
  if (rows.length === 0) {
    console.log("Creating first row…");
    insertRowWithDivider(workspace); // create first row
    rows = workspace.querySelectorAll(".panel-row");
  }

  // Dock the panel into the first row
  const targetRow = rows[0];
  const newCell = createCell(targetRow);
  newCell.appendChild(panel);
  panel.classList.add("docked");
  panel.classList.remove("floating");
  Object.assign(panel.style, {
    position: "relative",
    width: "100%",
    height: "100%",
    top: "",
    left: "",
  });

  // Create a second row **if it doesn’t exist yet**
  if (workspace.querySelectorAll(".panel-row").length < 2) {
    console.log("Creating second row…");
    insertRowWithDivider(workspace);
  }
}


function undockPanel(panel) {
  const overlay = document.getElementById("overlay") || createOverlayLayer();
  overlay.appendChild(panel);

  panel.classList.remove("docked");
  panel.classList.add("floating");

  Object.assign(panel.style, {
    position: "absolute",
    top: "50px",
    left: "50px",
    width: "400px",
    height: "300px",
  });

  bringToFront(panel);
}
