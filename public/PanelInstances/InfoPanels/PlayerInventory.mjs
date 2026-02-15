// Nodevision/public/PanelInstances/InfoPanels/PlayerInventory.mjs
// This is a reusable floating inventory panel shell for GameView and toolbar usage.

export function createFloatingInventoryPanel({ title = "Inventory", onRequestClose = null } = {}) {
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

  function findDockCellAtPoint(clientX, clientY) {
    return document
      .elementsFromPoint(clientX, clientY)
      .find((el) => el.classList?.contains("panel-cell"));
  }

  const panel = document.createElement("div");
  panel.className = "panel floating";
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
  dockBtn.type = "button";
  dockBtn.title = "Dock / Undock";
  dockBtn.textContent = "⇔";

  const maxBtn = document.createElement("button");
  maxBtn.type = "button";
  maxBtn.title = "Maximize / Restore";
  maxBtn.textContent = "⬜";

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.title = "Close Inventory";
  closeBtn.textContent = "✕";
  closeBtn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
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
  let currentDockTarget = null;
  let canSnapToCurrentTarget = false;
  let previousHost = null;
  let previousHostCleanup = null;
  let previousHostDatasetId = "";
  let previousHostDatasetClass = "";

  function clampAndApply(left, top) {
    const rect = panel.getBoundingClientRect();
    const maxLeft = Math.max(0, window.innerWidth - rect.width);
    const maxTop = Math.max(0, window.innerHeight - rect.height);
    panel.style.left = `${Math.max(0, Math.min(left, maxLeft))}px`;
    panel.style.top = `${Math.max(0, Math.min(top, maxTop))}px`;
  }

  function onMouseMove(event) {
    if (!dragging) return;
    clampAndApply(event.clientX - offsetX, event.clientY - offsetY);
    currentDockTarget = findDockCellAtPoint(event.clientX, event.clientY) || null;
    canSnapToCurrentTarget = isOutsideInner80Percent(currentDockTarget, event.clientX, event.clientY);
    clearTargetHighlight();
    if (currentDockTarget && canSnapToCurrentTarget) {
      currentDockTarget.classList.add("undock-snap-target");
    }
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

  function onMouseUp() {
    dragging = false;
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
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

  header.addEventListener("mousedown", (event) => {
    if (dockedCell) return;
    if (event.target === closeBtn) return;
    if (event.target === maxBtn) return;
    if (event.target === dockBtn) return;
    const rect = panel.getBoundingClientRect();
    dragging = true;
    offsetX = event.clientX - rect.left;
    offsetY = event.clientY - rect.top;
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
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
      onMouseUp();
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
