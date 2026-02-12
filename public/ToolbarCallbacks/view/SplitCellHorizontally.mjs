// Nodevision/public/ToolbarCallbacks/view/SplitCellHorizontally.mjs
// Splits the active panel cell into side-by-side panel cells using workspace layout conventions.

function createLayoutDivider(leftCell, rightCell, isVertical = false) {
  const divider = document.createElement("div");
  divider.className = "layout-divider";
  divider._leftCell = leftCell;
  divider._rightCell = rightCell;

  Object.assign(divider.style, {
    flexShrink: "0",
    flexGrow: "0",
    background: "#666",
    zIndex: "100",
    transition: "background 0.2s",
    ...(isVertical
      ? {
          height: "6px",
          minHeight: "6px",
          maxHeight: "6px",
          cursor: "row-resize",
          width: "100%",
        }
      : {
          width: "6px",
          minWidth: "6px",
          maxWidth: "6px",
          cursor: "col-resize",
          height: "100%",
        }),
  });

  divider.addEventListener("mouseenter", () => {
    divider.style.background = "#0078d7";
  });
  divider.addEventListener("mouseleave", () => {
    divider.style.background = "#666";
  });

  let startPos = 0;
  let startLeftSize = 0;
  let startRightSize = 0;
  let totalSize = 0;

  divider.addEventListener("mousedown", (e) => {
    e.preventDefault();
    const leftEl = divider._leftCell;
    const rightEl = divider._rightCell;
    if (!leftEl || !rightEl) return;

    const container = divider.parentElement;
    const leftRect = leftEl.getBoundingClientRect();
    const rightRect = rightEl.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    if (isVertical) {
      startPos = e.clientY;
      startLeftSize = leftRect.height;
      startRightSize = rightRect.height;
      totalSize = containerRect.height;
    } else {
      startPos = e.clientX;
      startLeftSize = leftRect.width;
      startRightSize = rightRect.width;
      totalSize = containerRect.width;
    }

    const onMouseMove = (moveEvent) => {
      const leftTarget = divider._leftCell;
      const rightTarget = divider._rightCell;
      if (!leftTarget || !rightTarget) return;

      const currentPos = isVertical ? moveEvent.clientY : moveEvent.clientX;
      const delta = currentPos - startPos;

      let newLeftSize = startLeftSize + delta;
      let newRightSize = startRightSize - delta;
      const min = 50;
      if (newLeftSize < min) newLeftSize = min;
      if (newRightSize < min) newRightSize = min;

      const leftPercent = (newLeftSize / totalSize) * 100;
      const rightPercent = (newRightSize / totalSize) * 100;
      leftTarget.style.flex = `0 0 ${leftPercent}%`;
      rightTarget.style.flex = `0 0 ${rightPercent}%`;
    };

    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  });

  return divider;
}

function makePanelCell(flexValue = "1 1 0") {
  const cell = document.createElement("div");
  cell.className = "panel-cell";
  Object.assign(cell.style, {
    border: "1px solid #bbb",
    background: "#fafafa",
    overflow: "auto",
    flex: flexValue,
    display: "flex",
    flexDirection: "column",
    position: "relative",
    minHeight: "0",
    minWidth: "0",
  });
  return cell;
}

export function splitCellHorizontally() {
  const cell = window.activeCell;
  if (!cell) {
    console.warn("No active cell to split.");
    alert("Please click on a cell first.");
    return;
  }

  const num = parseInt(prompt("Enter number of horizontal splits:", "2"), 10);
  if (isNaN(num) || num < 1) {
    alert("Invalid number.");
    return;
  }

  const parent = cell.parentElement;
  if (!parent) return;

  const originalFlex = cell.style.flex || "1 1 0";
  const originalContent = cell.innerHTML;
  const inheritedId = cell.dataset.id || "";
  const inheritedPanelClass = cell.dataset.panelClass || "";

  const splitContainer = document.createElement("div");
  splitContainer.className = "panel-row";
  Object.assign(splitContainer.style, {
    display: "flex",
    flexDirection: "row",
    overflow: "hidden",
    flex: originalFlex,
    alignItems: "stretch",
    minHeight: "0",
    minWidth: "0",
  });

  const referenceNode = cell.nextSibling;
  parent.removeChild(cell);

  let firstCell = null;
  for (let i = 0; i < num; i++) {
    const newCell = makePanelCell(`1 1 ${100 / num}%`);
    if (i === 0) {
      newCell.innerHTML = originalContent;
      if (inheritedId) newCell.dataset.id = inheritedId;
      if (inheritedPanelClass) newCell.dataset.panelClass = inheritedPanelClass;
      firstCell = newCell;
    }

    splitContainer.appendChild(newCell);

    if (i > 0) {
      const left = splitContainer.children[splitContainer.children.length - 3];
      const right = splitContainer.children[splitContainer.children.length - 1];
      const divider = createLayoutDivider(left, right, false);
      splitContainer.insertBefore(divider, right);
    }
  }

  parent.insertBefore(splitContainer, referenceNode);
  if (firstCell) {
    window.activeCell = firstCell;
  }
}

// Default export for toolbar system
export default function run() {
  splitCellHorizontally();
}
