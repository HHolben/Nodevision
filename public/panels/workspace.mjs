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

export async function loadDefaultLayout() {
  const response = await fetch("/UserSettings/DefaultLayout.json");
  if (!response.ok) throw new Error("Could not load layout");
  const layout = await response.json();
  const workspace = ensureWorkspace();
  renderLayout(layout.workspace, workspace);
}

function renderLayout(node, parent) {
  if (node.type === "row" || node.type === "vertical") {
    const row = document.createElement("div");
    row.className = "panel-row";
    Object.assign(row.style, {
      display: "flex",
      flexDirection: node.type === "vertical" ? "column" : "row",
      flexBasis: node.size || "auto",
      gap: "8px",
      borderBottom: "4px solid #ddd",
      overflow: "auto"
    });
    parent.appendChild(row);
    node.children?.forEach(child => renderLayout(child, row));
  } else if (node.type === "cell") {
    const cell = createCell(parent);
    cell.dataset.id = node.id;
    // Later you can load panel content dynamically here:
    loadPanelIntoCell(cell, node.content);
  }
}

