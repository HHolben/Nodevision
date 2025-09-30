// Nodevision/public/panels/rowManager.mjs
//This script handles the insertion of adjustable horizontal dividers.

export function ensureWorkspace() {
  let workspace = document.getElementById("workspace");
  if (!workspace) {
    workspace = document.createElement("div");
    workspace.id = "workspace";
    workspace.style.display = "flex";
    workspace.style.flexDirection = "column";
    workspace.style.height = "100%";
    document.body.appendChild(workspace);
  }
  return workspace;
}

export function createRow() {
  const row = document.createElement("div");
  row.className = "panel-row";
  Object.assign(row.style, {
    display: "flex",
    gap: "8px",
    flex: "1 1 auto",
    minHeight: "150px",
    position: "relative",
  });
  return row;
}

export function insertRowWithDivider(workspace) {
  const row = createRow();
  if (workspace.children.length > 0) {
    const divider = document.createElement("div");
    divider.className = "row-divider";
    Object.assign(divider.style, {
      height: "5px",
      background: "#ccc",
      cursor: "row-resize",
      flex: "0 0 auto",
    });
    workspace.appendChild(divider);
    makeDividerAdjustable(divider, row);
  }
  workspace.appendChild(row);
  return row;
}

function makeDividerAdjustable(divider, rowBelow) {
  let startY, startHeight, prevRow;

  divider.addEventListener("mousedown", (e) => {
    startY = e.clientY;
    prevRow = divider.previousElementSibling;
    if (!prevRow || !prevRow.classList.contains("panel-row")) return;
    startHeight = prevRow.offsetHeight;
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    e.preventDefault();
  });

  function onMouseMove(e) {
    const dy = e.clientY - startY;
    prevRow.style.flex = "0 0 " + Math.max(80, startHeight + dy) + "px";
  }

  function onMouseUp() {
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  }
}
