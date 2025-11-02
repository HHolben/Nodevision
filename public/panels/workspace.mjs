// Nodevision/public/panels/workspace.mjs
// Handles workspace, rows, cells, and resizable dividers, with dynamic multi-directory panel loading
// Adds activeCell/activePanel tracking and toolbar-based panel replacement

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
    userSelect: "none",
  });

  // 🟢 Handle click to set active panel + cell
  
// Find the workspace container that holds all cells
const workspaceElem = document.getElementById("workspace");

// Use a single delegated listener
workspaceElem.addEventListener("click", (e) => {
  const cell = e.target.closest(".panel-cell");
  if (!cell || !workspaceElem.contains(cell)) return;

  window.activeCell = cell;
  const panelId = cell.dataset.id || "Unknown";
  const panelTitle =
    cell.querySelector("h3")?.textContent ||
    cell.querySelector(".panel-header")?.textContent ||
    panelId;
  window.activePanel = panelTitle;

  console.log(`Active panel: ${window.activePanel}`);
  console.log("Active cell element:", window.activeCell);

  // Highlight active cell
  document.querySelectorAll(".panel-cell").forEach((c) => {
    c.style.outline = "";
  });
  cell.style.outline = "2px solid #0078d7";

  // Notify listeners that the active panel changed
  window.dispatchEvent(
    new CustomEvent("activePanelChanged", {
      detail: { panel: window.activePanel, cell: window.activeCell },
    })
  );
});


  row.appendChild(cell);

  // Add divider between cells
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
    loadPanelIntoCell(cell, node);
  }
}

/**
 * Dynamically load a panel based on its id and/or module path.
 * Supports multiple search directories and layout-specified module paths.
 */
async function loadPanelIntoCell(cell, node) {
  const { id, content, module } = node;
  const possiblePaths = [];

  if (module) {
    possiblePaths.push(module);
  } else {
    possiblePaths.push(
      `/PanelInstances/InfoPanels/${id}.mjs`,
      `/PanelInstances/ToolPanels/${id}.mjs`,
      `/PanelInstances/SidePanels/${id}.mjs`,
      `/PanelInstances/${id}.mjs`,
      `/panels/${id}.mjs`
    );
  }

  let loaded = false;
  for (const modulePath of possiblePaths) {
    try {
      console.log(`Trying to import panel: ${modulePath}`);
      const mod = await import(modulePath);
      if (typeof mod.setupPanel === "function") {
        mod.setupPanel(cell, { content });
        loaded = true;
        break;
      }
    } catch (err) {
      // Try next one silently
    }
  }

  if (!loaded) {
    cell.innerHTML = `<div style="padding:8px;">
      <strong>${content || id}</strong><br>
      <em>Panel script not found.</em>
    </div>`;
    console.warn(`No panel module found for ${id}`);
  }
}

// 🟣 Listen for toolbar events globally — replaces active cell with selected panel
window.addEventListener("toolbarAction", async (e) => {
  const { id } = e.detail;
  if (!window.activeCell) {
    console.warn("No active cell selected to replace with toolbar panel.");
    return;
  }

  const cell = window.activeCell;
  cell.innerHTML = `<div class="panel-header">${id}</div>`;
  await loadPanelIntoCell(cell, { id, content: id });
  console.log(`Replaced active cell content with toolbar panel: ${id}`);
});
