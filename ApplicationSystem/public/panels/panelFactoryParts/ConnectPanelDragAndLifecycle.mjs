// Nodevision/ApplicationSystem/public/panels/panelFactoryParts/ConnectPanelDragAndLifecycle.mjs
// This module implements connect Panel Drag And Lifecycle behavior for the panelFactory feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { createAddEventListenerClickHandler, createAddEventListenerPointerdownHandler, createNvSetLayoutHandler } from "./CreateSetActiveContextFromPanelHandler.mjs";
import { observePanelRemoval } from "../panelRemovalCleanup.mjs";

// Connect Panel Drag And Lifecycle operations.
export function connectPanelDragAndLifecycle(scope) {
  scope.panelState.highlightedSnapTarget = null;
  scope.panelState.lastDockParent = null;
  scope.panelState.lastDockNextSibling = null;
  scope.panelState.lastDockCell = null;
  scope.panelState.maxBtn.addEventListener("click", createAddEventListenerClickHandler({
    get panelState() {
      return scope.panelState;
    }
  }));
  scope.panelState.closeBtn.addEventListener("click", () => {
    scope.panelState.removeWindowDragListeners();
    scope.panelState.clearTargetHighlight();
    if (window.__nvActivePanelElement === scope.panelState.panel) {
      window.__nvActivePanelElement = null;
    }
    scope.panelState.panel.remove();
  });
  scope.panelState.dockBtn.addEventListener("click", () => {
    if (scope.panelState.isMaximized) {
      scope.panelState.maxBtn.click();
    }
    if (scope.panelState.isOverlay) {
      scope.panelState.exitOverlay("docked");
      return;
    }
    if (scope.panelState.isDocked) {
      scope.panelState.undockPanel();
    } else {
      scope.panelState.dockPanel();
      scope.panelState.clearTargetHighlight();
      scope.panelState.currentSnapTarget = null;
      scope.panelState.canSnapToCurrentTarget = false;
    }
  });
  scope.panelState.confirmBtn.addEventListener("click", e => {
    e.stopPropagation();
    scope.panelState.dismissOverlay();
  });
  scope.panelState.header.style.cursor = "move";
  scope.panelState.header.style.touchAction = "none";
  scope.panelState.onPointerMove = e => {
    if (!scope.panelState.dragging || e.pointerId !== scope.panelState.activePointerId || scope.panelState.isDocked || scope.panelState.isMaximized) return;
    if (!scope.panelState.movedWhileDragging) {
      const dx = Math.abs(e.clientX - scope.panelState.dragStartClientX);
      const dy = Math.abs(e.clientY - scope.panelState.dragStartClientY);
      if (dx > 2 || dy > 2) scope.panelState.movedWhileDragging = true;
    }
    scope.panelState.panel.style.left = `${e.clientX - scope.panelState.offsetX}px`;
    scope.panelState.panel.style.top = `${e.clientY - scope.panelState.offsetY}px`;
    scope.panelState.scheduleSnapUpdate(e.clientX, e.clientY);
  };
  scope.panelState.onPointerEnd = e => {
    if (!scope.panelState.dragging || e.pointerId !== scope.panelState.activePointerId) return;
    try {
      scope.panelState.header.releasePointerCapture?.(e.pointerId);
    } catch (_) {
      // No-op: fallback window listeners keep drag termination reliable.
    }
    scope.panelState.activePointerId = null;
    scope.panelState.finishDrag(e.clientX, e.clientY);
    scope.panelState.removeWindowDragListeners();
  };
  scope.panelState.onWindowBlur = () => {
    if (!scope.panelState.dragging) return;
    scope.panelState.activePointerId = null;
    scope.panelState.finishDrag(scope.panelState.latestPointerX, scope.panelState.latestPointerY);
    scope.panelState.removeWindowDragListeners();
  };
  scope.panelState.header.addEventListener("pointerdown", createAddEventListenerPointerdownHandler({
    get panelState() {
      return scope.panelState;
    }
  }));
  scope.panelState.header.addEventListener("click", () => {
    if (scope.panelState.movedWhileDragging) {
      scope.panelState.movedWhileDragging = false;
      return;
    }
    scope.panelState.openLayoutControlsSubToolbar();
  });
  scope.panelState.panel.__nvSetLayout = createNvSetLayoutHandler({
    get panelState() {
      return scope.panelState;
    }
  });
  if (String(scope.panelVars.defaultLayout || scope.panelVars.layout || "").toLowerCase() === "overlay") {
    scope.panelState.enterOverlayMode();
  }
  observePanelRemoval(scope.panelState.panel, () => {
    scope.panelState.cleanupResize();
    scope.panelState.removeWindowDragListeners();
    scope.panelState.detachOverlayKeyHandler();
    scope.panelState.content.cleanup?.();
  });
  return {
    value: {
      panel: scope.panelState.panel,
      header: scope.panelState.header,
      dockBtn: scope.panelState.dockBtn,
      maxBtn: scope.panelState.maxBtn,
      closeBtn: scope.panelState.closeBtn,
      resizer: scope.panelState.resizer,
      content: scope.panelState.content
    }
  };
}
