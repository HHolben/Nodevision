// Nodevision/public/ToolbarCallbacks/view/closePanel.mjs
// Closes the panel from the workspace corresponding to the active panel.

export function closeActivePanel() {
  const cell = window.activeCell;
  if (!cell) {
    console.warn("No active cell to close.");
    return;
  }

  const row = cell.parentElement;
  if (!row || !row.classList.contains("panel-row")) {
    console.warn("Active cell is not in a valid panel row.");
    return;
  }

  // Remove the divider adjacent to this cell if it exists
  const prevSibling = cell.previousElementSibling;
  const nextSibling = cell.nextElementSibling;

  // If previous sibling is a divider, remove it
  if (prevSibling && prevSibling.classList.contains("divider")) {
    prevSibling.remove();
  }
  // Otherwise, if next sibling is a divider, remove it
  else if (nextSibling && nextSibling.classList.contains("divider")) {
    nextSibling.remove();
  }

  // Remove the active cell itself
  cell.remove();

  // Reset globals
  console.log(`Closed panel: ${window.activePanel}`);
  window.activeCell = null;
  window.activePanel = null;

  // Optional: Clean up empty rows
  if (row.children.length === 0) {
    row.remove();
  }

  // Dispatch event for listeners
  window.dispatchEvent(new CustomEvent("activePanelClosed"));
}

// Default export for toolbar systems that import generically
export default function run() {
  closeActivePanel();
}
