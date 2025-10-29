// Nodevision/public/ToolbarCallbacks/view/SplitCellHorizontally.mjs
// Prompts user for a number then divides the current cell into that number of cells spaced horizontally.

export default function SplitCellHorizontally() {
  const activeCell = window.activeCell;
  if (!activeCell) {
    alert("No active cell selected.");
    return;
  }

  const numCells = parseInt(prompt("Enter the number of horizontal splits:", "2"), 10);
  if (isNaN(numCells) || numCells < 2) {
    alert("Please enter a valid number (2 or greater).");
    return;
  }

  const parent = activeCell.parentElement;
  const container = document.createElement("div");
  container.classList.add("workspace-row");
  container.style.display = "flex";
  container.style.flexDirection = "row";
  container.style.width = "100%";
  container.style.height = "100%";

  // Replace the original cell with a new row container
  parent.replaceChild(container, activeCell);

  for (let i = 0; i < numCells; i++) {
    const newCell = document.createElement("div");
    newCell.classList.add("workspace-cell");
    newCell.style.flex = "1";
    newCell.style.border = "1px solid var(--divider-color)";
    newCell.style.overflow = "hidden";

    // Add click behavior to set active cell
    newCell.addEventListener("click", (e) => {
      e.stopPropagation();
      if (window.activeCell) window.activeCell.classList.remove("active-cell");
      window.activeCell = newCell;
      newCell.classList.add("active-cell");
    });

    container.appendChild(newCell);
  }

  // Optionally mark the first new cell as active
  const firstCell = container.firstElementChild;
  firstCell.classList.add("active-cell");
  window.activeCell = firstCell;
}
