// Nodevision/public/ToolbarCallbacks/view/fullscreenPanel.mjs
// Toggles fullscreen for the active panel.

export function toggleFullscreenPanel() {
  if (window.__nvActiveLegacyUndockedPanel?.isConnected) {
    return;
  }

  const activePanel = window.__nvActivePanelElement;
  if (activePanel?.isConnected && activePanel.classList?.contains("panel")) {
    const maxBtn = activePanel.querySelector(".panel-max-btn");
    if (maxBtn && typeof maxBtn.click === "function") {
      maxBtn.click();
      return;
    }
  }

  const cell = window.activeCell;
  if (!cell) {
    console.warn("No active cell to fullscreen.");
    return;
  }

  const workspace = document.getElementById("workspace");
  if (!workspace) return;

  // Track original layout state on the cell
  if (!cell.dataset.originalStyles) {
    cell.dataset.originalStyles = JSON.stringify({
      flex: cell.style.flex,
      width: cell.style.width,
      height: cell.style.height,
      position: cell.style.position,
      zIndex: cell.style.zIndex,
    });
  }

  const isFullscreen = cell.classList.contains("fullscreen-panel");

  if (!isFullscreen) {
    // Hide all other rows and cells
    Array.from(workspace.children).forEach((row) => {
      if (!row.contains(cell)) {
        row.style.display = "none";
      } else {
        Array.from(row.children).forEach((c) => {
          if (c !== cell && !c.classList.contains("divider")) {
            c.style.display = "none";
          }
        });
      }
    });

    // Expand cell to fullscreen
    Object.assign(cell.style, {
      flex: "1 1 100%",
      width: "100%",
      height: "100%",
      position: "absolute",
      top: "0",
      left: "0",
      zIndex: "9999",
    });
    cell.classList.add("fullscreen-panel");
  } else {
    // Restore original layout
    const original = JSON.parse(cell.dataset.originalStyles);
    Object.assign(cell.style, original);

    // Show all rows and cells
    Array.from(workspace.children).forEach((row) => {
      row.style.display = "";
      Array.from(row.children).forEach((c) => {
        c.style.display = "";
      });
    });

    cell.classList.remove("fullscreen-panel");
  }
}

// Default export for generic toolbar import
export default function run() {
  toggleFullscreenPanel();
}
