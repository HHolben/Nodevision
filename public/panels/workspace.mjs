// Nodevision/public/panels/workspace.mjs
// Handles workspace, rows, cells, and resizable dividers.

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
      gap: "0px", // gap disabled for manual dividers
      marginBottom: "4px",
      borderBottom: "4px solid #ddd",
      overflow: "hidden",
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
    width: "5px",
    cursor: "col-resize",
    background: "#ccc",
    zIndex: "10",
  });

  let startX;
  let startLeftWidth;
  let startRightWidth;
  let totalWidth;

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

    // Temporarily disable transitions for smooth real-time drag
    leftCell.style.transition = "none";
    rightCell.style.transition = "none";

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  });

  function onMouseMove(e) {
    const dx = e.clientX - startX;
    let newLeftWidth = startLeftWidth + dx;
    let newRightWidth = startRightWidth - dx;

    // Clamp widths but allow near-zero squish
    const min = 5;
    if (newLeftWidth < min) newLeftWidth = min;
    if (newRightWidth < min) newRightWidth = min;

    // Convert to % so they fill container naturally
    const leftPercent = (newLeftWidth / totalWidth) * 100;
    const rightPercent = (newRightWidth / totalWidth) * 100;

    leftCell.style.flex = `0 0 ${leftPercent}%`;
    rightCell.style.flex = `0 0 ${rightPercent}%`;
  }

  function onMouseUp() {
    // Re-enable transitions
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
    const layout =
      json.workspace || json.layout || json; // normalize structure
    console.log("Parsed layout object:", layout);

    return layout; // ✅ this line is crucial
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
    });
    parent.appendChild(row);
    node.children?.forEach((child) => renderLayout(child, row));
  } else if (node.type === "cell") {
    const cell = createCell(parent);
    cell.dataset.id = node.id;
    loadPanelIntoCell(cell, node.content);
  }
}


function loadPanelIntoCell(cell, content) {
  if (!content) {
    cell.innerHTML = "<em>Empty panel</em>";
    return;
  }
  const header = document.createElement("div");
  header.textContent = content;
  header.style.cssText = "background:#ddd;padding:4px;text-align:center;font-weight:bold;";
  cell.appendChild(header);
}
