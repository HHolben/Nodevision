// Nodevision/ApplicationSystem/public/panels/panelTabDrag.mjs
// This module wires compact pointer dragging for Nodevision panel tabs. It keeps drag previews lightweight and delegates tab movement to the shared tab manager API supplied by the workspace panel layer.

let activeDrag = null;

function clientAxisValue(event, orientation) {
  return orientation === "left" || orientation === "right" ? event.clientY : event.clientX;
}

function tabMidpoint(tabEl, orientation) {
  const rect = tabEl.getBoundingClientRect();
  return orientation === "left" || orientation === "right"
    ? rect.top + rect.height / 2
    : rect.left + rect.width / 2;
}

function dropIndexFromPoint(tabList, event, orientation) {
  const tabs = Array.from(tabList.querySelectorAll(".nv-panel-tab"));
  const axis = clientAxisValue(event, orientation);
  for (let index = 0; index < tabs.length; index += 1) {
    if (axis < tabMidpoint(tabs[index], orientation)) return index;
  }
  return tabs.length;
}

function dragPreview(label) {
  const node = document.createElement("div");
  node.className = "nv-panel-tab-drag-preview";
  node.textContent = label;
  document.body.appendChild(node);
  return node;
}

function setPreviewPosition(preview, event) {
  if (!preview) return;
  preview.style.left = `${event.clientX + 10}px`;
  preview.style.top = `${event.clientY + 10}px`;
}

export function installPanelTabDrag(tabEl, cell, tab, api) {
  if (!tabEl || !cell || !tab || !api) return;
  let startX = 0;
  let startY = 0;
  let pointerId = null;
  let dragging = false;
  let pointerActive = false;
  let preview = null;

  function startDragging(event) {
    if (dragging) return;
    dragging = true;
    activeDrag = { sourceCell: cell, tabId: tab.tabId };
    preview = dragPreview(tab.displayName || tab.panelType);
    document.body?.classList?.add("nv-panel-tab-dragging");
    tabEl.setPointerCapture?.(event.pointerId);
    tabEl.classList.add("nv-panel-tab--dragging");
  }

  function samePointer(event) {
    return pointerId === null || event.pointerId === pointerId;
  }

  function onMove(event) {
    if (!pointerActive || !samePointer(event)) return;
    if (!dragging) {
      const moved = Math.hypot(event.clientX - startX, event.clientY - startY);
      if (moved < 6) return;
      startDragging(event);
    }
    setPreviewPosition(preview, event);
    api.updateDragHover(event);
    event.preventDefault();
  }

  function cleanupGesture(event) {
    const completedDrag = dragging;
    document.removeEventListener("pointermove", onMove, true);
    document.removeEventListener("pointerup", finish, true);
    document.removeEventListener("pointercancel", finish, true);
    if (pointerId !== null) {
      try { tabEl.releasePointerCapture?.(pointerId); } catch { }
    }
    activeDrag = null;
    dragging = false;
    pointerActive = false;
    pointerId = null;
    startX = 0;
    startY = 0;
    preview?.remove();
    preview = null;
    tabEl.classList.remove("nv-panel-tab--dragging", "nv-panel-tab--pressed");
    document.body?.classList?.remove("nv-panel-tab-dragging");
    if (completedDrag) {
      tabEl.__nvPanelTabSuppressClick = true;
      setTimeout(() => { tabEl.__nvPanelTabSuppressClick = false; }, 0);
    }
    api.clearDragHover();
  }

  function finish(event) {
    if (!pointerActive || !samePointer(event)) return;
    if (dragging && activeDrag) {
      api.finishDrag(activeDrag, event);
    }
    cleanupGesture(event);
  }

  tabEl.addEventListener("pointerdown", (event) => {
    if (event.button !== undefined && event.button !== 0) return;
    if (event.target?.closest?.(".nv-panel-tab-close")) return;
    startX = event.clientX;
    startY = event.clientY;
    pointerId = event.pointerId ?? null;
    dragging = false;
    pointerActive = true;
    tabEl.classList.add("nv-panel-tab--pressed");
    tabEl.setPointerCapture?.(event.pointerId);
    document.addEventListener("pointermove", onMove, true);
    document.addEventListener("pointerup", finish, true);
    document.addEventListener("pointercancel", finish, true);
  });

  tabEl.addEventListener("click", (event) => {
    if (!tabEl.__nvPanelTabSuppressClick) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    tabEl.__nvPanelTabSuppressClick = false;
  }, true);

  tabEl.addEventListener("dragstart", (event) => event.preventDefault());
}

export function resolveTabDropIndex(tabList, event) {
  if (!tabList || !event) return -1;
  const orientation = tabList.closest(".panel-cell")?.dataset?.nvTabOrientation || "top";
  return dropIndexFromPoint(tabList, event, orientation);
}
