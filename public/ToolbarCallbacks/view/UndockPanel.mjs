// Nodevision/public/ToolbarCallbacks/view/UndockPanel.mjs
// Undocks the active panel cell content into a floating panel and lets it snap to panel cells.

function clearTargetHighlight() {
  document.querySelectorAll(".undock-snap-target").forEach((el) => {
    el.classList.remove("undock-snap-target");
  });
}

function isOutsideInner80Percent(cell, clientX, clientY) {
  if (!cell) return false;
  const rect = cell.getBoundingClientRect();
  const marginX = rect.width * 0.1;
  const marginY = rect.height * 0.1;
  const innerLeft = rect.left + marginX;
  const innerRight = rect.right - marginX;
  const innerTop = rect.top + marginY;
  const innerBottom = rect.bottom - marginY;
  const insideInnerX = clientX >= innerLeft && clientX <= innerRight;
  const insideInnerY = clientY >= innerTop && clientY <= innerBottom;
  return !(insideInnerX && insideInnerY);
}

function setActiveCell(cell) {
  if (!cell) return;
  window.activeCell = cell;
  const panelId = cell.dataset.id || "Unknown";
  const panelClass = cell.dataset.panelClass || "InfoPanel";
  window.activePanel = panelId;
  window.activePanelClass = panelClass;
  document.querySelectorAll(".panel-cell").forEach((c) => {
    c.style.outline = "";
  });
  cell.style.outline = "2px solid #0078d7";
}

export default function run() {
  const sourceCell = window.activeCell;
  if (!sourceCell || !sourceCell.classList.contains("panel-cell")) {
    alert("Select a panel cell first.");
    return;
  }

  if (window.__undockedPanelState?.floatingEl?.isConnected) {
    alert("Only one undocked panel is supported right now. Snap it before undocking another.");
    return;
  }

  if (!sourceCell.firstChild) {
    alert("The active panel is empty.");
    return;
  }

  const sourceRect = sourceCell.getBoundingClientRect();
  const sourcePanelId = sourceCell.dataset.id || "";
  const sourcePanelClass = sourceCell.dataset.panelClass || "";
  const sourceCleanup = typeof sourceCell.cleanup === "function" ? sourceCell.cleanup : null;

  const floatingEl = document.createElement("div");
  floatingEl.className = "undocked-panel-float";
  floatingEl.style.left = `${Math.max(16, sourceRect.left + 12)}px`;
  floatingEl.style.top = `${Math.max(16, sourceRect.top + 12)}px`;

  const header = document.createElement("div");
  header.className = "undocked-panel-header";
  header.textContent = `Undocked: ${sourcePanelId || "Panel"}`;

  const body = document.createElement("div");
  body.className = "undocked-panel-body";

  floatingEl.appendChild(header);
  floatingEl.appendChild(body);
  document.body.appendChild(floatingEl);

  while (sourceCell.firstChild) {
    body.appendChild(sourceCell.firstChild);
  }

  sourceCell.classList.add("panel-cell-undocked-origin");
  sourceCell.dataset.id = "";
  sourceCell.dataset.panelClass = "";
  sourceCell.cleanup = null;

  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;
  let currentTarget = null;
  let canSnapToCurrentTarget = false;

  const onMouseMove = (e) => {
    if (!dragging) return;
    floatingEl.style.left = `${e.clientX - offsetX}px`;
    floatingEl.style.top = `${e.clientY - offsetY}px`;

    const hit = document
      .elementsFromPoint(e.clientX, e.clientY)
      .find((el) => el.classList?.contains("panel-cell") && !floatingEl.contains(el));

    currentTarget = hit || null;
    canSnapToCurrentTarget = isOutsideInner80Percent(currentTarget, e.clientX, e.clientY);
    clearTargetHighlight();
    if (currentTarget && canSnapToCurrentTarget) {
      currentTarget.classList.add("undock-snap-target");
    }
  };

  const dockToCell = (targetCell) => {
    if (!targetCell) return false;

    if (targetCell !== sourceCell && typeof targetCell.cleanup === "function") {
      try {
        targetCell.cleanup();
      } catch (err) {
        console.warn("Target panel cleanup failed before undocked replace:", err);
      }
    }

    targetCell.cleanup = sourceCleanup || null;
    targetCell.innerHTML = "";
    while (body.firstChild) {
      targetCell.appendChild(body.firstChild);
    }

    targetCell.dataset.id = sourcePanelId;
    targetCell.dataset.panelClass = sourcePanelClass || "InfoPanel";

    sourceCell.classList.remove("panel-cell-undocked-origin");
    if (targetCell !== sourceCell) {
      sourceCell.innerHTML = "";
      sourceCell.dataset.id = "";
      sourceCell.dataset.panelClass = "";
      sourceCell.cleanup = null;
    }

    floatingEl.remove();
    clearTargetHighlight();
    setActiveCell(targetCell);
    window.__undockedPanelState = null;
    return true;
  };

  const onMouseUp = () => {
    dragging = false;
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
    if (currentTarget && canSnapToCurrentTarget) {
      dockToCell(currentTarget);
    } else {
      clearTargetHighlight();
      window.__undockedPanelState = {
        floatingEl,
        sourceCell,
        sourcePanelId,
        sourcePanelClass,
        sourceCleanup,
      };
    }
  };

  function onHeaderDown(e) {
    dragging = true;
    const rect = floatingEl.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }

  header.addEventListener("mousedown", onHeaderDown);
}
