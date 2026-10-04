// Nodevision/ApplicationSystem/public/panels/panelFactoryParts/CreateSetActiveContextFromPanelHandler.mjs
// This module implements create Set Active Context From Panel Handler behavior for the panelFactory feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

// Create Set Active Context From Panel Handler operations.
export function createSetActiveContextFromPanelHandler(owner) {
  return function () {
    const owningCell = owner.panelState.panel.closest(".panel-cell") || owner.panelState.panel.__nvDefaultDockCell || owner.panelState.lastDockCell || null;
    window.__nvActivePanelElement = owner.panelState.panel;
    window.activePanel = owner.panelState.panel.dataset.instanceName || owner.panelState.panel.dataset.instanceId || "Panel";
    window.activePanelClass = owner.panelState.panel.dataset.panelClass || "GenericPanel";
    window.NodevisionState = window.NodevisionState || {};
    window.NodevisionState.activePanelType = window.activePanelClass;
    if (owningCell && owningCell.classList?.contains("panel-cell")) {
      window.activeCell = owningCell;
      if (window.highlightActiveCell) {
        window.highlightActiveCell(owningCell);
      } else {
        document.querySelectorAll(".panel-cell").forEach(c => {
          c.style.outline = "";
        });
        owningCell.style.outline = "2px solid #0078d7";
      }
      window.dispatchEvent(new CustomEvent("activePanelChanged", {
        detail: {
          panel: window.activePanel,
          cell: owningCell,
          panelClass: window.activePanelClass
        }
      }));
    }
  };
}

export function createAddEventListenerClickHandler(owner) {
  return () => {
    if (owner.panelState.isOverlay) {
      owner.panelState.exitOverlay("maximized");
      return;
    }
    if (!owner.panelState.isMaximized) {
      owner.panelState.prevStyles = {
        width: owner.panelState.panel.style.width,
        height: owner.panelState.panel.style.height,
        top: owner.panelState.panel.style.top,
        left: owner.panelState.panel.style.left,
        position: owner.panelState.panel.style.position,
        zIndex: owner.panelState.panel.style.zIndex
      };
      owner.panelState.panel.classList.add("maximized");
      Object.assign(owner.panelState.panel.style, {
        position: "fixed",
        top: "0",
        left: "0",
        width: "100vw",
        height: "100vh",
        zIndex: "9999"
      });
      owner.panelState.isMaximized = true;
    } else {
      owner.panelState.panel.classList.remove("maximized");
      Object.assign(owner.panelState.panel.style, owner.panelState.prevStyles);
      owner.panelState.isMaximized = false;
    }
  };
}

export function createAddEventListenerPointerdownHandler(owner) {
  return e => {
    if (e.target?.closest?.("button, a, input, select, textarea")) return;
    if (owner.panelState.isDocked || owner.panelState.isMaximized || owner.panelState.isOverlay) return;
    const rect = owner.panelState.panel.getBoundingClientRect();
    owner.panelState.dragging = true;
    owner.panelState.movedWhileDragging = false;
    owner.panelState.activePointerId = e.pointerId;
    owner.panelState.dragStartClientX = e.clientX;
    owner.panelState.dragStartClientY = e.clientY;
    owner.panelState.latestPointerX = e.clientX;
    owner.panelState.latestPointerY = e.clientY;
    owner.panelState.offsetX = e.clientX - rect.left;
    owner.panelState.offsetY = e.clientY - rect.top;
    owner.panelState.panel.style.userSelect = "none";
    owner.panelState.panel.style.willChange = "left, top";
    owner.panelState.bringToFront();
    owner.panelState.addWindowDragListeners();
    try {
      owner.panelState.header.setPointerCapture?.(e.pointerId);
    } catch (_) {
      // No-op: window-level listeners are the primary drag source of truth.
    }
    e.preventDefault();
  };
}

export function createNvSetLayoutHandler(owner) {
  return (layout, opts = {}) => {
    owner.panelState.overlayDismissHandler = opts.onDismiss || owner.panelState.overlayDismissHandler;
    switch ((layout || "").toLowerCase()) {
      case "overlay":
        owner.panelState.enterOverlayMode();
        break;
      case "floating":
      case "undocked":
        if (owner.panelState.isOverlay) owner.panelState.exitOverlay("floating");
        owner.panelState.undockPanel();
        break;
      case "maximized":
      case "fullscreen":
        if (owner.panelState.isOverlay) owner.panelState.exitOverlay("maximized");
        owner.panelState.maxBtn.click();
        break;
      default:
        if (owner.panelState.isOverlay) owner.panelState.exitOverlay("docked");
        owner.panelState.dockPanel();
        break;
    }
  };
}
