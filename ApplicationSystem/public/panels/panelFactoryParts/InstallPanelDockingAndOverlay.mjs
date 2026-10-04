// Nodevision/ApplicationSystem/public/panels/panelFactoryParts/InstallPanelDockingAndOverlay.mjs
// This module implements install Panel Docking And Overlay behavior for the panelFactory feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

// Install Panel Docking And Overlay operations.
export function installPanelDockingAndOverlay(scope) {
  scope.panelState.dockPanel = function (targetCell = null) {
    const resolvedCell = targetCell && targetCell.isConnected && targetCell.classList?.contains("panel-cell") ? targetCell : scope.panelState.getDefaultDockCell();
    if (resolvedCell) {
      resolvedCell.appendChild(scope.panelState.panel);
      scope.panelState.lastDockCell = resolvedCell;
    } else if (scope.panelState.lastDockParent && scope.panelState.lastDockParent.isConnected && scope.panelState.lastDockParent !== document.body) {
      if (scope.panelState.lastDockNextSibling && scope.panelState.lastDockNextSibling.isConnected && scope.panelState.lastDockNextSibling.parentNode === scope.panelState.lastDockParent) {
        scope.panelState.lastDockParent.insertBefore(scope.panelState.panel, scope.panelState.lastDockNextSibling);
      } else {
        scope.panelState.lastDockParent.appendChild(scope.panelState.panel);
      }
    } else {
      return false;
    }
    scope.panelState.setDockedStyles();
    scope.panelState.isDocked = true;
    scope.panelState.isOverlay = false;
    scope.panelState.confirmBtn.style.display = "none";
    scope.panelState.detachOverlayKeyHandler();
    return true;
  };
  scope.panelState.undockPanel = function () {
    if (!scope.panelState.isDocked) return;
    const rect = scope.panelState.panel.getBoundingClientRect();
    scope.panelState.lastDockParent = scope.panelState.panel.parentNode || null;
    scope.panelState.lastDockNextSibling = scope.panelState.panel.nextSibling || null;
    scope.panelState.lastDockCell = scope.panelState.panel.closest(".panel-cell");
    document.body.appendChild(scope.panelState.panel);
    scope.panelState.setFloatingStyles(rect.left + window.scrollX, rect.top + window.scrollY, rect.width, rect.height);
    scope.panelState.isDocked = false;
    scope.panelState.isOverlay = false;
    scope.panelState.confirmBtn.style.display = "none";
    scope.panelState.detachOverlayKeyHandler();
  };
  scope.panelState.enterOverlayMode = function () {
    if (scope.panelState.isOverlay) return;
    scope.panelState.isDocked = false;
    scope.panelState.isMaximized = false;
    scope.panelState.isOverlay = true;
    scope.panelState.confirmBtn.style.display = "inline-flex";
    scope.panelState.setOverlayStyles();
    scope.panelState.attachOverlayKeyHandler();
  };
  scope.panelState.exitOverlay = function (targetLayout = "docked") {
    if (!scope.panelState.isOverlay) return;
    scope.panelState.isOverlay = false;
    scope.panelState.panel.classList.remove("overlay");
    scope.panelState.confirmBtn.style.display = "none";
    scope.panelState.panel.style.transform = "";
    scope.panelState.panel.style.maxHeight = "";
    scope.panelState.detachOverlayKeyHandler();
    if (targetLayout === "floating" || targetLayout === "undocked") {
      scope.panelState.undockPanel();
    } else if (targetLayout === "maximized" || targetLayout === "fullscreen") {
      scope.panelState.dockPanel() || scope.panelState.undockPanel();
      scope.panelState.maxBtn.click();
    } else {
      scope.panelState.dockPanel();
    }
  };
  scope.panelState.dismissOverlay = function () {
    if (!scope.panelState.isOverlay) return;
    scope.panelState.detachOverlayKeyHandler();
    if (typeof scope.panelState.overlayDismissHandler === "function") {
      try {
        scope.panelState.overlayDismissHandler();
      } catch (err) {
        console.warn("Overlay dismiss handler error:", err);
      }
    }
    scope.panelState.panel.remove();
  };
  scope.panelState.updateSnapTarget = function (clientX, clientY) {
    const hit = document.elementsFromPoint(clientX, clientY).find(el => el.classList?.contains("panel-cell") && !scope.panelState.panel.contains(el));
    scope.panelState.currentSnapTarget = hit || null;
    scope.panelState.canSnapToCurrentTarget = scope.panelState.isOutsideInner80Percent(scope.panelState.currentSnapTarget, clientX, clientY);
    const nextHighlighted = scope.panelState.currentSnapTarget && scope.panelState.canSnapToCurrentTarget ? scope.panelState.currentSnapTarget : null;
    if (nextHighlighted !== scope.panelState.highlightedSnapTarget) {
      scope.panelState.clearTargetHighlight();
      if (nextHighlighted) {
        nextHighlighted.classList.add(scope.panelState.SNAP_TARGET_CLASS);
        scope.panelState.highlightedSnapTarget = nextHighlighted;
      }
    }
  };
  scope.panelState.scheduleSnapUpdate = function (clientX, clientY) {
    scope.panelState.latestPointerX = clientX;
    scope.panelState.latestPointerY = clientY;
    if (scope.panelState.snapRafId) return;
    scope.panelState.snapRafId = window.requestAnimationFrame(() => {
      scope.panelState.snapRafId = 0;
      scope.panelState.updateSnapTarget(scope.panelState.latestPointerX, scope.panelState.latestPointerY);
    });
  };
  scope.panelState.finishDrag = function (clientX, clientY) {
    if (!scope.panelState.dragging) return;
    scope.panelState.dragging = false;
    scope.panelState.panel.style.userSelect = "";
    scope.panelState.panel.style.willChange = "";
    if (scope.panelState.snapRafId) {
      window.cancelAnimationFrame(scope.panelState.snapRafId);
      scope.panelState.snapRafId = 0;
    }
    scope.panelState.updateSnapTarget(clientX, clientY);
    if (scope.panelState.currentSnapTarget && scope.panelState.canSnapToCurrentTarget) {
      scope.panelState.dockPanel(scope.panelState.currentSnapTarget);
    }
    scope.panelState.clearTargetHighlight();
    scope.panelState.currentSnapTarget = null;
    scope.panelState.canSnapToCurrentTarget = false;
  };
}
