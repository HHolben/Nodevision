// Nodevision/ApplicationSystem/public/panels/rowManager.mjs
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
  row.dataset.direction = "row";
  row.dataset.isVertical = "0";
  return row;
}

export function insertRowWithDivider(workspace) {
  const row = createRow();
  if (workspace.children.length > 0) {
    const divider = document.createElement("div");
    divider.className = "row-divider";
    Object.assign(divider.style, {
      height: "10px",
      background: "#ccc",
      cursor: "row-resize",
      flex: "0 0 auto",
      touchAction: "none",
      userSelect: "none",
    });
    workspace.appendChild(divider);
    makeDividerAdjustable(divider, row);
  }
  workspace.appendChild(row);
  return row;
}

function makeDividerAdjustable(divider, rowBelow) {
  let startY, startHeight, prevRow;
  let activePointerId = null;

  divider.style.touchAction = "none";
  divider.style.userSelect = "none";

  divider.addEventListener("pointerdown", (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    if (activePointerId !== null) return;
    startY = e.clientY;
    prevRow = divider.previousElementSibling;
    if (!prevRow || !prevRow.classList.contains("panel-row")) return;
    activePointerId = e.pointerId ?? "mouse";
    startHeight = prevRow.offsetHeight;
    document.body.style.cursor = "row-resize";
    document.body.style.userSelect = "none";
    divider.setPointerCapture?.(e.pointerId);
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
    document.addEventListener("pointercancel", onPointerUp);
    e.preventDefault();
  });

  function onPointerMove(e) {
    if (activePointerId !== (e.pointerId ?? "mouse")) return;
    e.preventDefault();
    const dy = e.clientY - startY;
    prevRow.style.flex = "0 0 " + Math.max(80, startHeight + dy) + "px";
  }

  function onPointerUp(e) {
    if (activePointerId !== null && e?.pointerId !== undefined && activePointerId !== e.pointerId) return;
    activePointerId = null;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    if (e?.pointerId !== undefined) divider.releasePointerCapture?.(e.pointerId);
    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", onPointerUp);
    document.removeEventListener("pointercancel", onPointerUp);
  }
}
