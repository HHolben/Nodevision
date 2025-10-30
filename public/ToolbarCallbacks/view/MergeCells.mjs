// Nodevision/public/ToolbarCallbacks/view/MergeCells.mjs
// Merges all cells in the same container (row or column) as the active cell into one unified cell,
// removing dividers and preserving the ID/panel type of the first cell.

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
    (el) => el.classList && el.classList.contains("cell")
  );

  if (cells.length <= 1) {
    alert("No other cells to merge with.");
    return;
  }

  // Get ID and panel type from the first cell
  const firstCell = cells[0];
  const inheritedId = firstCell.dataset.id || "MergedPanel";
  const inheritedPanel = firstCell.dataset.panel || firstCell.id || "MergedPanel";

  // Combine inner content of all cells
  let mergedContent = "";
  for (const cell of cells) {
    mergedContent += cell.innerHTML + "\n";
  }

  // Remove all cells and dividers from the container
  Array.from(container.children).forEach((child) => {
    if (
      child.classList?.contains("cell") ||
      child.classList?.contains("divider")
    ) {
      container.removeChild(child);
    }
  });

  // Create the merged cell
  const newCell = document.createElement("div");
  newCell.className = "cell";
  newCell.dataset.id = inheritedId;
  newCell.dataset.panel = inheritedPanel;
  Object.assign(newCell.style, {
    flex: "1 1 auto",
    border: "1px solid var(--border-color, #444)",
    overflow: "auto",
  });
  newCell.innerHTML = mergedContent;

  // Rebind click-to-activate behavior
  newCell.addEventListener("click", (e) => {
    e.stopPropagation();
    window.activeCell = newCell;
    document.querySelectorAll(".cell").forEach((c) =>
      c.classList.remove("active")
    );
    newCell.classList.add("active");
    console.log(`Active cell set to merged panel: ${newCell.dataset.id}`);
  });

  // Add merged cell to container
  container.appendChild(newCell);

  // Update global active cell
  window.activeCell = newCell;

  console.log(
    `✅ Merged ${cells.length} cells into one with ID "${inheritedId}" and panel type "${inheritedPanel}".`
  );
}

// Default export for toolbar integration
export default function run() {
  mergeCells();
}
