// Nodevision/public/ToolbarCallbacks/view/UndockPanel.mjs
// Undocks the active panel cell content into a floating panel and lets it snap to panel cells.

function clearTargetHighlight(target = null) {
  if (target?.classList) {
    target.classList.remove("undock-snap-target");
    return;
  }
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
  if (window.__nvActiveLegacyUndockedPanel?.isConnected) {
    return;
  }

  const activePanel = window.__nvActivePanelElement;
  if (activePanel?.isConnected && activePanel.classList?.contains("panel")) {
    const dockBtn = activePanel.querySelector(".panel-dock-btn");
    if (dockBtn && typeof dockBtn.click === "function") {
      dockBtn.click();
      return;
    }
  }

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

  const sourcePanel = sourceCell.firstElementChild;
  if (sourcePanel?.classList?.contains("panel")) {
    const dockBtn = sourcePanel.querySelector(".panel-dock-btn");
    if (dockBtn && typeof dockBtn.click === "function") {
      dockBtn.click();
      return;
    }
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
  let activePointerId = null;
  let hasWindowDragListeners = false;
  let latestPointerX = 0;
  let latestPointerY = 0;
  let snapRafId = 0;
  let highlightedTarget = null;
  let currentTarget = null;
  let canSnapToCurrentTarget = false;

  function updateSnapTarget(clientX, clientY) {
    const hit = document
      .elementsFromPoint(clientX, clientY)
      .find((el) => el.classList?.contains("panel-cell") && !floatingEl.contains(el));

    currentTarget = hit || null;
    canSnapToCurrentTarget = isOutsideInner80Percent(currentTarget, clientX, clientY);
    const nextHighlighted = (currentTarget && canSnapToCurrentTarget) ? currentTarget : null;
    if (nextHighlighted !== highlightedTarget) {
      clearTargetHighlight(highlightedTarget);
      if (nextHighlighted) {
        nextHighlighted.classList.add("undock-snap-target");
      }
      highlightedTarget = nextHighlighted;
    }
  }

  function scheduleSnapUpdate(clientX, clientY) {
    latestPointerX = clientX;
    latestPointerY = clientY;
    if (snapRafId) return;
    snapRafId = window.requestAnimationFrame(() => {
      snapRafId = 0;
      updateSnapTarget(latestPointerX, latestPointerY);
    });
  }

  const onPointerMove = (e) => {
    if (!dragging || e.pointerId !== activePointerId) return;
    latestPointerX = e.clientX;
    latestPointerY = e.clientY;
    floatingEl.style.left = `${e.clientX - offsetX}px`;
    floatingEl.style.top = `${e.clientY - offsetY}px`;
    scheduleSnapUpdate(e.clientX, e.clientY);
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
    clearTargetHighlight(highlightedTarget);
    highlightedTarget = null;
    setActiveCell(targetCell);
    window.__undockedPanelState = null;
    return true;
  };

  const onPointerUp = (e) => {
    if (!dragging || e.pointerId !== activePointerId) return;
    dragging = false;
    floatingEl.style.userSelect = "";
    floatingEl.style.willChange = "";
    try {
      header.releasePointerCapture?.(e.pointerId);
    } catch (_) {
      // No-op: window listeners continue to receive drag lifecycle events.
    }
    activePointerId = null;
    if (snapRafId) {
      window.cancelAnimationFrame(snapRafId);
      snapRafId = 0;
    }
    updateSnapTarget(e.clientX, e.clientY);
    removeWindowDragListeners();
    if (currentTarget && canSnapToCurrentTarget) {
      dockToCell(currentTarget);
    } else {
      clearTargetHighlight(highlightedTarget);
      highlightedTarget = null;
      window.__undockedPanelState = {
        floatingEl,
        sourceCell,
        sourcePanelId,
        sourcePanelClass,
        sourceCleanup,
      };
    }
  };

  const onWindowBlur = () => {
    if (!dragging) return;
    dragging = false;
    floatingEl.style.userSelect = "";
    floatingEl.style.willChange = "";
    activePointerId = null;
    if (snapRafId) {
      window.cancelAnimationFrame(snapRafId);
      snapRafId = 0;
    }
    clearTargetHighlight(highlightedTarget);
    highlightedTarget = null;
    window.__undockedPanelState = {
      floatingEl,
      sourceCell,
      sourcePanelId,
      sourcePanelClass,
      sourceCleanup,
    };
    removeWindowDragListeners();
  };

  function addWindowDragListeners() {
    if (hasWindowDragListeners) return;
    window.addEventListener("pointermove", onPointerMove, true);
    window.addEventListener("pointerup", onPointerUp, true);
    window.addEventListener("pointercancel", onPointerUp, true);
    window.addEventListener("blur", onWindowBlur);
    hasWindowDragListeners = true;
  }

  function removeWindowDragListeners() {
    if (!hasWindowDragListeners) return;
    window.removeEventListener("pointermove", onPointerMove, true);
    window.removeEventListener("pointerup", onPointerUp, true);
    window.removeEventListener("pointercancel", onPointerUp, true);
    window.removeEventListener("blur", onWindowBlur);
    hasWindowDragListeners = false;
  }

  function onHeaderDown(e) {
    dragging = true;
    activePointerId = e.pointerId;
    latestPointerX = e.clientX;
    latestPointerY = e.clientY;
    const rect = floatingEl.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    floatingEl.style.userSelect = "none";
    floatingEl.style.willChange = "left, top";
    addWindowDragListeners();
    try {
      header.setPointerCapture?.(e.pointerId);
    } catch (_) {
      // No-op: window listeners keep dragging behavior stable.
    }
    e.preventDefault();
  }

  header.style.touchAction = "none";
  header.addEventListener("pointerdown", onHeaderDown);
}
