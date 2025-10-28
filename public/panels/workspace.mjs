// Nodevision/public/panels/workspace.mjs
// Handles workspace, rows, cells, and resizable dividers, with panel script integration.

export function ensureWorkspace() {
  let workspace = document.getElementById("workspace");
  if (!workspace) {
    workspace = document.createElement("div");
    workspace.id = "workspace";
    workspace.style.padding = "8px";
    workspace.style.height = "calc(100vh - 50px)";
    workspace.style.display = "flex";
    workspace.style.flexDirection = "column";
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
      gap: "0px",
      marginBottom: "4px",
      borderBottom: "4px solid #ddd",
      overflow: "hidden",
      flex: "1 1 auto",
    });
    workspace.appendChild(topRow);
  }
  return topRow;
}

export function createCell(row) {
  const cell = document.createElement("div");
  cell.className = "panel-cell";
  Object.assign(cell.style, {
    border: "1px solid #bbb",
    background: "#fafafa",
    overflow: "auto",
    flex: "1 1 0",
    display: "flex",
    flexDirection: "column",
    position: "relative",
  });
  row.appendChild(cell);

  if (row.children.length > 1) {
    const divider = createDivider(row.children[row.children.length - 2], cell);
    row.insertBefore(divider, cell);
  }

  return cell;
}

function createDivider(leftCell, rightCell) {
  const divider = document.createElement("div");
  divider.className = "divider";
  Object.assign(divider.style, {
    width: "8px",
    cursor: "col-resize",
    background: "#aaa",
    zIndex: "10",
  });

  let startX, startLeftWidth, startRightWidth, totalWidth;

  divider.addEventListener("mousedown", (e) => {
    e.preventDefault();
    startX = e.clientX;

    const row = divider.parentElement;
    const leftRect = leftCell.getBoundingClientRect();
    const rightRect = rightCell.getBoundingClientRect();
    const rowRect = row.getBoundingClientRect();

    startLeftWidth = leftRect.width;
    startRightWidth = rightRect.width;
    totalWidth = rowRect.width;

    leftCell.style.transition = "none";
    rightCell.style.transition = "none";

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  });

  function onMouseMove(e) {
    const dx = e.clientX - startX;
    let newLeftWidth = startLeftWidth + dx;
    let newRightWidth = startRightWidth - dx;
    const min = 5;
    if (newLeftWidth < min) newLeftWidth = min;
    if (newRightWidth < min) newRightWidth = min;
    const leftPercent = (newLeftWidth / totalWidth) * 100;
    const rightPercent = (newRightWidth / totalWidth) * 100;
    leftCell.style.flex = `0 0 ${leftPercent}%`;
    rightCell.style.flex = `0 0 ${rightPercent}%`;
  }

  function onMouseUp() {
    leftCell.style.transition = "";
    rightCell.style.transition = "";
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
  }

  return divider;
}

export async function loadDefaultLayout() {
  try {
    const res = await fetch("/UserSettings/DefaultLayout.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const raw = await res.text();
    console.log("Fetched layout file (raw):", raw);

    const json = JSON.parse(raw);
    const layout = json.workspace || json.layout || json;
    console.log("Parsed layout object:", layout);

    return layout;
  } catch (err) {
    console.warn("Failed to load DefaultLayout.json:", err);
    return null;
  }
}

export function renderLayout(node, parent) {
  if (node.type === "row" || node.type === "vertical") {
    const row = document.createElement("div");
    row.className = "panel-row";
    Object.assign(row.style, {
      display: "flex",
      flexDirection: node.type === "vertical" ? "column" : "row",
      borderBottom: "4px solid #ddd",
      overflow: "hidden",
      flex: "1 1 auto",
    });
    parent.appendChild(row);
    node.children?.forEach((child) => renderLayout(child, row));
  } else if (node.type === "cell") {
    const cell = createCell(parent);
    cell.dataset.id = node.id;
    loadPanelIntoCell(cell, node.id, node.content);
  }
}

async function loadPanelIntoCell(cell, id, content) {
  try {
    const modulePath = `/PanelInstances/InfoPanels/${id}.mjs`;
    console.log(`Attempting to import panel script: ${modulePath}`);

    const mod = await import(modulePath);
    if (typeof mod.setupPanel === "function") {
      mod.setupPanel(cell, { content });
    } else {
      console.warn(`Module ${id}.mjs does not export setupPanel().`);
      cell.innerHTML = `<strong>${content || id}</strong><br><em>No setupPanel() found.</em>`;
    }
  } catch (err) {
    console.error(`Failed to load panel for ${id}:`, err);
    cell.innerHTML = `<strong>${content || id}</strong><br><em>Failed to load panel script.</em>`;
  }
}
