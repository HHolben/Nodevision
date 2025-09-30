// Nodevision/public/panelManager.mjs
// Panel manager: create/dock/undock/move/maximize/close, and drag-to-dock behavior.

let panelCounter = 0;

/**
 * createPanel(templateName)
 * - creates a new instance (multiple allowed)
 * - docks by default into a new right-most cell of top row
 */
export function createPanel(templateName = "Panel") {
  // find or create workspace
  let workspace = document.getElementById("workspace");
  if (!workspace) {
    console.warn("Workspace not found — creating #workspace.");
    workspace = document.createElement("div");
    workspace.id = "workspace";
    // minimal style so rows show: you can override in your CSS file
    workspace.style.padding = "8px";
    document.body.appendChild(workspace);
  }

  // ensure top row
  let topRow = workspace.querySelector(".panel-row");
  if (!topRow) {
    topRow = document.createElement("div");
    topRow.className = "panel-row";
    // flex row so cells line up
    topRow.style.display = "flex";
    topRow.style.gap = "8px";
    topRow.style.marginBottom = "8px";
    workspace.appendChild(topRow);
  }

  // create a brand-new cell at the rightmost position (append)
  const cell = document.createElement("div");
  cell.className = "panel-cell";
  Object.assign(cell.style, {
    minWidth: "200px",
    minHeight: "150px",
    border: "1px dashed #bbb",
    position: "relative",
    background: "#fafafa",
    overflow: "hidden",
    flex: "0 0 300px", // default width for a new cell; adjust as needed
  });
  topRow.appendChild(cell);

  // unique instance id
  const instanceId = `panel-${panelCounter++}`;

  // build panel DOM
  const panel = document.createElement("div");
  panel.className = "panel docked";
  panel.dataset.template = templateName;
  panel.dataset.instanceId = instanceId;
  // docked panels should fill cell
  Object.assign(panel.style, {
    position: "relative",
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column",
    boxSizing: "border-box",
    background: "#fff",
    border: "1px solid #ccc",
  });

  // Header (title + controls)
  const header = document.createElement("div");
  header.className = "panel-header";
  Object.assign(header.style, {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "6px 8px",
    background: "#333",
    color: "#fff",
    cursor: "grab",
    userSelect: "none",
  });

  const titleSpan = document.createElement("span");
  titleSpan.textContent = `${templateName} (${panelCounter})`;
  titleSpan.style.fontSize = "13px";

  const controls = document.createElement("div");
  controls.className = "panel-controls";
  controls.style.display = "flex";
  controls.style.gap = "6px";

  const dockBtn = document.createElement("button");
  dockBtn.className = "dock-btn";
  dockBtn.title = "Dock / Undock";
  dockBtn.textContent = "⇔";
  styleControlButton(dockBtn);

  const maxBtn = document.createElement("button");
  maxBtn.className = "max-btn";
  maxBtn.title = "Maximize / Restore";
  maxBtn.textContent = "⬜";
  styleControlButton(maxBtn);

  const closeBtn = document.createElement("button");
  closeBtn.className = "close-btn";
  closeBtn.title = "Close";
  closeBtn.textContent = "✕";
  styleControlButton(closeBtn);

  controls.appendChild(dockBtn);
  controls.appendChild(maxBtn);
  controls.appendChild(closeBtn);

  header.appendChild(titleSpan);
  header.appendChild(controls);

  // Content area
  const content = document.createElement("div");
  content.className = "panel-content";
  Object.assign(content.style, {
    padding: "8px",
    flex: "1",
    overflow: "auto",
  });
  content.textContent = `Content for "${templateName}" — instance ${panelCounter}`;

  // Resize handle (bottom-right)
  const resizer = document.createElement("div");
  resizer.className = "resize-handle";
  Object.assign(resizer.style, {
    width: "12px",
    height: "12px",
    position: "absolute",
    right: "2px",
    bottom: "2px",
    cursor: "se-resize",
    background: "#777",
    display: "none", // shown only for floating panels
  });

  // assemble panel
  panel.appendChild(header);
  panel.appendChild(content);
  panel.appendChild(resizer);
  cell.appendChild(panel); // append into newly created rightmost cell (docked by default)

  // make floating overlay available
  ensureOverlayExists();

  // state helpers
  function makeFloatingFromDock(cellFrom) {
    // preserve previous cell
    panel.dataset._prevCellIndex = Array.from(cellFrom.parentElement.children).indexOf(cellFrom);
    // move to overlay
    const overlay = document.getElementById("overlay");
    overlay.appendChild(panel);
    panel.classList.remove("docked");
    panel.classList.add("floating");
    Object.assign(panel.style, {
      position: "absolute",
      width: panel.style.width || "400px",
      height: panel.style.height || "300px",
      top: (cellFrom.getBoundingClientRect().top + 10) + "px",
      left: (cellFrom.getBoundingClientRect().right + 10) + "px",
    });
    resizer.style.display = "block";
    header.style.cursor = "grab";
  }

  function dockIntoCell(targetCell) {
    targetCell.appendChild(panel);
    panel.classList.remove("floating");
    panel.classList.add("docked");
    panel.style.position = "relative";
    panel.style.top = "0";
    panel.style.left = "0";
    panel.style.width = "100%";
    panel.style.height = "100%";
    resizer.style.display = "none";
  }

  // Dock/undock click
  dockBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const wasDocked = panel.classList.contains("docked");
    if (wasDocked) {
      // undock -> floating overlay
      const overlay = document.getElementById("overlay");
      overlay.appendChild(panel);
      panel.classList.remove("docked");
      panel.classList.add("floating");
      // position where the cell was
      panel.style.position = "absolute";
      const r = panel.getBoundingClientRect();
      panel.style.top = (r.top + 20) + "px";
      panel.style.left = (r.left + 20) + "px";
      panel.style.width = "400px";
      panel.style.height = "300px";
      resizer.style.display = "block";
      bringToFront(panel);
    } else {
      // dock -> append to rightmost cell of top row
      const target = getTopRowRightmostCellCreateIfMissing();
      dockIntoCell(target);
    }
  });

  // Maximize / restore
  maxBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (!panel.classList.contains("maximized")) {
      panel.dataset._prevStyles = JSON.stringify({
        position: panel.style.position || "",
        top: panel.style.top || "",
        left: panel.style.left || "",
        width: panel.style.width || "",
        height: panel.style.height || "",
      });
      Object.assign(panel.style, {
        position: "fixed",
        top: "0",
        left: "0",
        width: "100vw",
        height: "100vh",
      });
      panel.classList.add("maximized");
      bringToFront(panel);
    } else {
      const prev = panel.dataset._prevStyles ? JSON.parse(panel.dataset._prevStyles) : null;
      if (prev) Object.assign(panel.style, prev);
      panel.classList.remove("maximized");
    }
  });

  // Close
  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    panel.remove();
  });

  // Dragging logic (header): works for both docked and floating
  header.addEventListener("mousedown", (e) => {
    // ignore clicks on buttons inside header
    if (e.target.closest("button")) return;

    e.preventDefault();
    // prepare for dragging
    let startX = e.clientX;
    let startY = e.clientY;
    let origRect = panel.getBoundingClientRect();
    let draggingFromDock = panel.classList.contains("docked");
    let originalCell = null;

    if (draggingFromDock) {
      // remember original cell and convert to floating for dragging
      originalCell = panel.parentElement;
      makeFloatingFromDock(originalCell);
      origRect = panel.getBoundingClientRect();
    } else {
      // bring to front for floating
      bringToFront(panel);
      origRect = panel.getBoundingClientRect();
    }

    const offsetX = startX - origRect.left;
    const offsetY = startY - origRect.top;

    function onMouseMove(ev) {
      ev.preventDefault();
      const x = ev.clientX - offsetX;
      const y = ev.clientY - offsetY;
      panel.style.left = x + "px";
      panel.style.top = y + "px";
    }

    function onMouseUp(ev) {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);

      // on drop, if over a panel-cell (and NOT over toolbar), dock into that cell, otherwise remain floating
      const dropCell = getCellUnderPoint(ev.clientX, ev.clientY);
      const overToolbar = isOverToolbar(ev.clientX, ev.clientY);
      if (dropCell && !overToolbar) {
        // dock into that cell
        dockIntoCell(dropCell);
      } else {
        // remain floating (already is)
        // if we started docked and dropped nowhere, we keep floating (i.e., undocked)
        // ensure resize handle visible
        panel.classList.remove("docked");
        panel.classList.add("floating");
        resizer.style.display = "block";
      }
    }

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  });

  // Simple resizing for floating panels
  resizer.addEventListener("mousedown", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (panel.classList.contains("docked")) return; // only floating
    const startX = e.clientX;
    const startY = e.clientY;
    const startW = panel.offsetWidth;
    const startH = panel.offsetHeight;

    function onMove(ev) {
      panel.style.width = Math.max(100, startW + (ev.clientX - startX)) + "px";
      panel.style.height = Math.max(80, startH + (ev.clientY - startY)) + "px";
    }
    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  });

  // DONE: return panel instance
  return panel;
}

/* -------------------- Helper functions -------------------- */

function styleControlButton(btn) {
  btn.style.border = "none";
  btn.style.background = "#555";
  btn.style.color = "#fff";
  btn.style.padding = "4px";
  btn.style.cursor = "pointer";
  btn.style.borderRadius = "3px";
}

function ensureOverlayExists() {
  let overlay = document.getElementById("overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "overlay";
    Object.assign(overlay.style, {
      position: "fixed",
      top: "0",
      left: "0",
      width: "100%",
      height: "100%",
      pointerEvents: "none", // let panels be pointer-events auto individually
      zIndex: 999,
    });
    document.body.appendChild(overlay);
  }
  return overlay;
}

// return top-row rightmost cell; create row/cell if missing
function getTopRowRightmostCellCreateIfMissing() {
  const workspace = document.getElementById("workspace");
  if (!workspace) return null;
  let topRow = workspace.querySelector(".panel-row");
  if (!topRow) {
    topRow = document.createElement("div");
    topRow.className = "panel-row";
    Object.assign(topRow.style, { display: "flex", gap: "8px", marginBottom: "8px" });
    workspace.appendChild(topRow);
  }
  // create a new cell to the right (so each new panel goes to the right of previous)
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
  topRow.appendChild(cell);
  return cell;
}

// find cell element under pointer (returns .panel-cell or null)
function getCellUnderPoint(x, y) {
  const elems = document.elementsFromPoint(x, y);
  for (const el of elems) {
    if (el.classList && el.classList.contains("panel-cell")) return el;
  }
  return null;
}

// toolbar detection: returns true if point is over toolbar(s)
function isOverToolbar(x, y) {
  const elems = document.elementsFromPoint(x, y);
  for (const el of elems) {
    if (el.id === "global-toolbar" || el.id === "sub-toolbar" || el.classList?.contains("toolbar")) return true;
  }
  return false;
}

// find top row's rightmost existing cell (no-create)
function findTopRowRightmostCell() {
  const workspace = document.getElementById("workspace");
  if (!workspace) return null;
  const topRow = workspace.querySelector(".panel-row");
  if (!topRow) return null;
  const cells = topRow.querySelectorAll(".panel-cell");
  if (!cells || cells.length === 0) return null;
  return cells[cells.length - 1];
}

// bring a panel to front (simple z-index stacking)
function bringToFront(panel) {
  const panels = Array.from(document.querySelectorAll(".panel"));
  const max = panels.reduce((m, p) => {
    const z = parseInt(p.style.zIndex) || 1000;
    return Math.max(m, z);
  }, 1000);
  panel.style.zIndex = (max + 1).toString();
}
