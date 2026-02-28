// Nodevision/public/ToolbarCallbacks/view/MergeCells.mjs
// Merges panel cells in the same split container and preserves workspace panel semantics.

export function mergeCells() {
  const active = window.activeCell;
  if (!active) {
    alert("Please click on a cell first.");
    return;
  }

  const container = active.parentElement;
  if (!container) return;

  // Collect all sibling cells
  const cells = Array.from(container.children).filter(
    (el) => el.classList && el.classList.contains("panel-cell")
  );

  if (cells.length <= 1) {
    alert("No other cells to merge with.");
    return;
  }

  // Get ID and panel type from the first cell
  const firstCell = cells[0];
  const inheritedId = firstCell.dataset.id || "MergedPanel";
  const inheritedPanelClass = firstCell.dataset.panelClass || "InfoPanel";

  // Combine inner content of all cells
  let mergedContent = "";
  for (const cell of cells) {
    if (cell.innerHTML) {
      mergedContent += cell.innerHTML;
    }
  }

  // Remove all cells and dividers from the container
  Array.from(container.children).forEach((child) => {
    if (
      child.classList?.contains("panel-cell") ||
      child.classList?.contains("layout-divider") ||
      child.classList?.contains("divider")
    ) {
      container.removeChild(child);
    }
  });

  // Create the merged cell
  const newCell = document.createElement("div");
  newCell.className = "panel-cell";
  newCell.dataset.id = inheritedId;
  newCell.dataset.panelClass = inheritedPanelClass;
  Object.assign(newCell.style, {
    flex: "1 1 0",
    border: "1px solid #bbb",
    background: "#fafafa",
    display: "flex",
    flexDirection: "column",
    position: "relative",
    overflow: "auto",
    minHeight: "0",
    minWidth: "0",
  });
  newCell.innerHTML = mergedContent;

  // Add merged cell to container
  container.appendChild(newCell);

  // Update global active cell
  window.activeCell = newCell;

  console.log(
    `✅ Merged ${cells.length} cells into one with ID "${inheritedId}" and panel class "${inheritedPanelClass}".`
  );
}

// Default export for toolbar integration
export default function run() {
  mergeCells();
}
