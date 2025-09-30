// Nodevision/public/panels/workspace.mjs
//This module declares functions needed to insert rows and cells.
export function ensureWorkspace() {
  let workspace = document.getElementById("workspace");
  if (!workspace) {
    workspace = document.createElement("div");
    workspace.id = "workspace";
    workspace.style.padding = "8px";
    document.body.appendChild(workspace);
  }
  return workspace;
}

export function ensureTopRow(workspace) {
  let topRow = workspace.querySelector(".panel-row");
  if (!topRow) {
    topRow = document.createElement("div");
    topRow.className = "panel-row";
    Object.assign(topRow.style, {
      display: "flex",
      gap: "8px",
      marginBottom: "4px",
      borderBottom: "4px solid #ddd",
      resize: "vertical",
      overflow: "auto"
    });
    workspace.appendChild(topRow);
  }
  return topRow;
}

export function createCell(row) {
  const cell = document.createElement("div");
  cell.className = "panel-cell";
  Object.assign(cell.style, {
    minWidth: "200px",
    minHeight: "150px",
    border: "1px dashed #bbb",
    position: "relative",
    background: "#fafafa",
    overflow: "hidden",
    flex: "0 0 300px",
  });
  row.appendChild(cell);
  return cell;
}
