// Nodevision/public/PanelInstances/InfoPanels/PlayerInventory.mjs
// This is a reusable floating inventory panel shell for GameView and toolbar usage.

export function createFloatingInventoryPanel({ title = "Inventory", onRequestClose = null } = {}) {
  let highlightedSnapTarget = null;

  function clearTargetHighlight() {
    if (highlightedSnapTarget?.classList) {
      highlightedSnapTarget.classList.remove("undock-snap-target");
    }
    highlightedSnapTarget = null;
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

  function findDockCellAtPoint(clientX, clientY) {
    return document
      .elementsFromPoint(clientX, clientY)
      .find((el) => el.classList?.contains("panel-cell"));
  }

  const panel = document.createElement("div");
  panel.className = "panel floating";
  panel.__nvOnClose = () => {
    if (typeof onRequestClose === "function") onRequestClose();
  };
  Object.assign(panel.style, {
    position: "fixed",
    left: "24px",
    top: "24px",
    width: "min(560px, 78vw)",
    minWidth: "340px",
    maxWidth: "640px",
    maxHeight: "70vh",
    zIndex: "22020",
    margin: "0",
    display: "flex",
    flexDirection: "column",
    minHeight: "220px"
  });

  const header = document.createElement("div");
  header.className = "panel-header";
  Object.assign(header.style, {
    cursor: "move",
    userSelect: "none",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between"
  });

  const titleEl = document.createElement("span");
  titleEl.className = "panel-title";
  titleEl.textContent = title;
  header.appendChild(titleEl);

  const controls = document.createElement("div");
  controls.className = "panel-controls";
  const dockBtn = document.createElement("button");
  dockBtn.className = "panel-dock-btn";
  dockBtn.type = "button";
  dockBtn.title = "Dock / Undock";
  dockBtn.textContent = "⇔";

  const maxBtn = document.createElement("button");
  maxBtn.className = "panel-max-btn";
  maxBtn.type = "button";
  maxBtn.title = "Maximize / Restore";
  maxBtn.textContent = "⬜";

  const closeBtn = document.createElement("button");
  closeBtn.className = "panel-close-btn";
  closeBtn.type = "button";
  closeBtn.title = "Close Inventory";
  closeBtn.textContent = "✕";
  closeBtn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    removeWindowDragListeners();
    if (typeof onRequestClose === "function") onRequestClose();
  });
  controls.appendChild(dockBtn);
  controls.appendChild(maxBtn);
  controls.appendChild(closeBtn);
  header.appendChild(controls);

  const content = document.createElement("div");
  content.className = "panel-content";
  Object.assign(content.style, {
    background: "rgba(10, 14, 20, 0.92)",
    color: "#eaf7ff",
    padding: "10px",
    overflow: "auto",
    flex: "1 1 auto",
    minHeight: "0"
  });

  panel.appendChild(header);
  panel.appendChild(content);
  document.body.appendChild(panel);

  let dragging = false;
  let offsetX = 0;
  let offsetY = 0;
  let maximized = false;
  let prevBox = null;
  let dockedCell = null;
  let movedWhileDragging = false;
  let activePointerId = null;
  let hasWindowDragListeners = false;
  let dragStartClientX = 0;
  let dragStartClientY = 0;
  let dragPanelWidth = 0;
  let dragPanelHeight = 0;
  let latestPointerX = 0;
  let latestPointerY = 0;
  let snapRafId = 0;
  let currentDockTarget = null;
  let canSnapToCurrentTarget = false;
  let previousHost = null;
  let previousHostCleanup = null;
  let previousHostDatasetId = "";
  let previousHostDatasetClass = "";

  function openLayoutControlsSubToolbar() {
    window.__nvActivePanelElement = panel;
    window.__nvActiveLegacyUndockedPanel = null;
    window.activePanel = "PlayerInventory";
    window.activePanelClass = "InfoPanel";
    window.NodevisionState = window.NodevisionState || {};
    window.NodevisionState.activePanelType = "InfoPanel";

    if (dockedCell && dockedCell.classList?.contains("panel-cell")) {
      window.activeCell = dockedCell;
      document.querySelectorAll(".panel-cell").forEach((c) => {
        c.style.outline = "";
      });
      dockedCell.style.outline = "2px solid #0078d7";
      window.dispatchEvent(new CustomEvent("activePanelChanged", {
        detail: {
          panel: "PlayerInventory",
          cell: dockedCell,
          panelClass: "InfoPanel",
        },
      }));
    }

    window.dispatchEvent(new CustomEvent("nv-show-subtoolbar", {
      detail: {
        heading: "Layout Controls",
        force: false,
        toggle: false,
      },
    }));
  }

  function clampAndApply(left, top) {
    const width = dragPanelWidth || panel.getBoundingClientRect().width;
    const height = dragPanelHeight || panel.getBoundingClientRect().height;
    const maxLeft = Math.max(0, window.innerWidth - width);
    const maxTop = Math.max(0, window.innerHeight - height);
    panel.style.left = `${Math.max(0, Math.min(left, maxLeft))}px`;
    panel.style.top = `${Math.max(0, Math.min(top, maxTop))}px`;
  }

  function updateSnapTarget(clientX, clientY) {
    currentDockTarget = findDockCellAtPoint(clientX, clientY) || null;
    canSnapToCurrentTarget = isOutsideInner80Percent(currentDockTarget, clientX, clientY);
    const nextHighlighted = (currentDockTarget && canSnapToCurrentTarget) ? currentDockTarget : null;
    if (nextHighlighted !== highlightedSnapTarget) {
      clearTargetHighlight();
      if (nextHighlighted) {
        nextHighlighted.classList.add("undock-snap-target");
        highlightedSnapTarget = nextHighlighted;
      }
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

  function dockToCell(targetCell) {
    if (!targetCell) return false;

    previousHost = targetCell;
    previousHostCleanup = typeof targetCell.cleanup === "function" ? targetCell.cleanup : null;
    previousHostDatasetId = targetCell.dataset?.id || "";
    previousHostDatasetClass = targetCell.dataset?.panelClass || "";

    if (typeof targetCell.cleanup === "function") {
      try {
        targetCell.cleanup();
      } catch (err) {
        console.warn("Inventory dock target cleanup failed:", err);
      }
    }

    targetCell.cleanup = null;
    targetCell.innerHTML = "";
    targetCell.appendChild(panel);
    targetCell.dataset.id = "PlayerInventory";
    targetCell.dataset.panelClass = "InfoPanel";

    panel.classList.remove("floating");
    panel.classList.add("docked");
    Object.assign(panel.style, {
      position: "relative",
      left: "0px",
      top: "0px",
      width: "100%",
      maxWidth: "",
      height: "100%",
      maxHeight: "",
      zIndex: ""
    });
    dockedCell = targetCell;
    clearTargetHighlight();
    return true;
  }

  function undockToFloating() {
    if (!dockedCell) return;
    if (panel.parentNode === dockedCell) {
      dockedCell.removeChild(panel);
    }
    if (previousHost === dockedCell) {
      dockedCell.innerHTML = "";
      if (previousHostDatasetId) dockedCell.dataset.id = previousHostDatasetId;
      else dockedCell.dataset.id = "";
      if (previousHostDatasetClass) dockedCell.dataset.panelClass = previousHostDatasetClass;
      else dockedCell.dataset.panelClass = "";
      dockedCell.cleanup = previousHostCleanup || null;
    }

    document.body.appendChild(panel);
    panel.classList.add("floating");
    panel.classList.remove("docked");
    Object.assign(panel.style, {
      position: "fixed",
      left: "24px",
      top: "24px",
      width: "min(560px, 78vw)",
      maxWidth: "640px",
      height: "",
      maxHeight: "70vh",
      zIndex: "22020"
    });
    dockedCell = null;
    previousHost = null;
    previousHostCleanup = null;
    previousHostDatasetId = "";
    previousHostDatasetClass = "";
  }

  function finishDrag(clientX, clientY) {
    if (!dragging) return;
    dragging = false;
    panel.style.userSelect = "";
    panel.style.willChange = "";

    if (snapRafId) {
      window.cancelAnimationFrame(snapRafId);
      snapRafId = 0;
    }

    updateSnapTarget(clientX, clientY);
    if (currentDockTarget && canSnapToCurrentTarget) {
      dockToCell(currentDockTarget);
    }
    currentDockTarget = null;
    canSnapToCurrentTarget = false;
    clearTargetHighlight();
  }

  maxBtn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (!maximized) {
      prevBox = {
        left: panel.style.left,
        top: panel.style.top,
        width: panel.style.width,
        height: panel.style.height,
        maxWidth: panel.style.maxWidth
      };
      panel.style.left = "0px";
      panel.style.top = "0px";
      panel.style.width = "100vw";
      panel.style.height = "100vh";
      panel.style.maxWidth = "100vw";
      maximized = true;
      return;
    }
    panel.style.left = prevBox?.left || "24px";
    panel.style.top = prevBox?.top || "24px";
    panel.style.width = prevBox?.width || "min(560px, 78vw)";
    panel.style.height = prevBox?.height || "";
    panel.style.maxWidth = prevBox?.maxWidth || "640px";
    maximized = false;
  });

  header.style.touchAction = "none";

  const onPointerMove = (event) => {
    if (!dragging || event.pointerId !== activePointerId) return;
    if (!movedWhileDragging) {
      const dx = Math.abs(event.clientX - dragStartClientX);
      const dy = Math.abs(event.clientY - dragStartClientY);
      if (dx > 2 || dy > 2) movedWhileDragging = true;
    }
    clampAndApply(event.clientX - offsetX, event.clientY - offsetY);
    scheduleSnapUpdate(event.clientX, event.clientY);
  };

  const onPointerEnd = (event) => {
    if (!dragging || event.pointerId !== activePointerId) return;
    try {
      header.releasePointerCapture?.(event.pointerId);
    } catch (_) {
      // No-op: window-level listeners already handle end-of-drag cleanup.
    }
    activePointerId = null;
    finishDrag(event.clientX, event.clientY);
    removeWindowDragListeners();
  };

  const onWindowBlur = () => {
    if (!dragging) return;
    activePointerId = null;
    finishDrag(latestPointerX, latestPointerY);
    removeWindowDragListeners();
  };

  function addWindowDragListeners() {
    if (hasWindowDragListeners) return;
    window.addEventListener("pointermove", onPointerMove, true);
    window.addEventListener("pointerup", onPointerEnd, true);
    window.addEventListener("pointercancel", onPointerEnd, true);
    window.addEventListener("blur", onWindowBlur);
    hasWindowDragListeners = true;
  }

  function removeWindowDragListeners() {
    if (!hasWindowDragListeners) return;
    window.removeEventListener("pointermove", onPointerMove, true);
    window.removeEventListener("pointerup", onPointerEnd, true);
    window.removeEventListener("pointercancel", onPointerEnd, true);
    window.removeEventListener("blur", onWindowBlur);
    hasWindowDragListeners = false;
  }

  header.addEventListener("pointerdown", (event) => {
    if (event.target?.closest?.("button, a, input, select, textarea")) return;
    if (dockedCell) return;

    const rect = panel.getBoundingClientRect();
    activePointerId = event.pointerId;
    dragStartClientX = event.clientX;
    dragStartClientY = event.clientY;
    latestPointerX = event.clientX;
    latestPointerY = event.clientY;
    dragPanelWidth = rect.width;
    dragPanelHeight = rect.height;
    dragging = true;
    movedWhileDragging = false;
    offsetX = event.clientX - rect.left;
    offsetY = event.clientY - rect.top;
    panel.style.userSelect = "none";
    panel.style.willChange = "left, top";
    addWindowDragListeners();
    try {
      header.setPointerCapture?.(event.pointerId);
    } catch (_) {
      // No-op: window-level listeners already keep dragging active.
    }
    event.preventDefault();
  });

  header.addEventListener("click", () => {
    if (movedWhileDragging) {
      movedWhileDragging = false;
      return;
    }
    openLayoutControlsSubToolbar();
  });

  dockBtn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (dockedCell) {
      undockToFloating();
      return;
    }
    const target = window.activeCell || document.querySelector(".panel-cell");
    if (target) {
      dockToCell(target);
    }
  });

  return {
    panel,
    content,
    isDocked() {
      return !!dockedCell;
    },
    dock(targetCell = null) {
      const target = targetCell || window.activeCell || document.querySelector(".panel-cell");
      if (!target) return false;
      return dockToCell(target);
    },
    undock() {
      undockToFloating();
    },
    setVisible(nextVisible) {
      panel.style.display = nextVisible ? "flex" : "none";
      if (nextVisible && !dockedCell) {
        panel.classList.add("floating");
      }
    },
    dispose() {
      finishDrag(latestPointerX, latestPointerY);
      removeWindowDragListeners();
      clearTargetHighlight();
      panel.remove();
    }
  };
}

// Optional setupPanel export so this can also be loaded as a standard InfoPanel.
export function setupPanel(panelElem) {
  panelElem.innerHTML = `
    <div style="padding:10px;font:13px monospace;color:#333;">
      PlayerInventory InfoPanel shell loaded. GameView populates this panel dynamically.
    </div>
  `;
}
