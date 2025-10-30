// Nodevision/public/ToolbarCallbacks/view/SplitCellVertically.mjs
// Prompts the user for a number, then divides the active cell into that
// number of vertically stacked cells.

export function splitCellVertically() {
  const cell = window.activeCell;
  if (!cell) {
    console.warn("No active cell to split.");
    alert("Please click on a cell first.");
    return;
  }

  const num = parseInt(prompt("Enter number of vertical splits:", "2"), 10);
  if (isNaN(num) || num < 1) {
    alert("Invalid number.");
    return;
  }

  const parentContainer = cell.parentElement;
  if (!parentContainer) return;

  // Store the original content
  const originalContent = cell.innerHTML;

  // Remove the original cell
  parentContainer.removeChild(cell);

  // Create a new column container
  const newColumn = document.createElement("div");
  newColumn.className = "column";
  newColumn.style.display = "flex";
  newColumn.style.flexDirection = "column";
  newColumn.style.flex = "1 1 auto";
  newColumn.style.height = "100%";
  newColumn.style.width = "100%";

  // Create the specified number of vertical cells
  for (let i = 0; i < num; i++) {
    const newCell = document.createElement("div");
    newCell.className = "cell";
    newCell.style.flex = `1 1 ${100 / num}%`;
    newCell.style.border = "1px solid var(--border-color, #444)";
    newCell.style.overflow = "auto";

    // First cell inherits the original content
    if (i === 0) newCell.innerHTML = originalContent;

    // Allow selecting this new cell
    newCell.addEventListener("click", (e) => {
      e.stopPropagation();
      window.activeCell = newCell;
      document.querySelectorAll(".cell").forEach(c => c.classList.remove("active"));
      newCell.classList.add("active");
    });

    newColumn.appendChild(newCell);

    // Optional divider between stacked cells
    if (i < num - 1) {
      const divider = document.createElement("div");
      divider.className = "divider";
      divider.style.height = "4px";
      divider.style.cursor = "row-resize";
      divider.style.background = "var(--divider-color, #222)";
      newColumn.appendChild(divider);
    }
  }

  // Insert the new column where the old cell was
  parentContainer.appendChild(newColumn);

  // Update activeCell to the first new one
  window.activeCell = newColumn.querySelector(".cell");
}

// Default export for toolbar system
export default function run() {
  splitCellVertically();
}
