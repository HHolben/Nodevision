// Nodevision/ApplicationSystem/public/panels/panelFactoryParts/InstallPanelActivationAndGeometry.mjs
// This module implements install Panel Activation And Geometry behavior for the panelFactory feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { createSetActiveContextFromPanelHandler } from "./CreateSetActiveContextFromPanelHandler.mjs";

// Install Panel Activation And Geometry operations.
export function installPanelActivationAndGeometry(scope) {
  scope.panelState.openLayoutControlsSubToolbar = function () {
    scope.panelState.setActiveContextFromPanel();
    window.dispatchEvent(new CustomEvent("nv-show-subtoolbar", {
      detail: {
        heading: "Layout Controls",
        force: false,
        toggle: false
      }
    }));
  };
  scope.panelState.setActiveContextFromPanel = createSetActiveContextFromPanelHandler({
    get panelState() {
      return scope.panelState;
    }
  });
  scope.panelState.clearTargetHighlight = function () {
    if (scope.panelState.highlightedSnapTarget?.classList) {
      scope.panelState.highlightedSnapTarget.classList.remove(scope.panelState.SNAP_TARGET_CLASS);
    }
    scope.panelState.highlightedSnapTarget = null;
  };
  scope.panelState.bringToFront = function () {
    const maxZ = Array.from(document.querySelectorAll(".panel")).map(el => Number.parseInt(el.style.zIndex || "0", 10) || 0).reduce((a, b) => Math.max(a, b), 1000);
    scope.panelState.panel.style.zIndex = String(maxZ + 1);
  };
  scope.panelState.isOutsideInner80Percent = function (cell, clientX, clientY) {
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
  };
  scope.panelState.setDockedStyles = function () {
    scope.panelState.panel.classList.remove("floating");
    scope.panelState.panel.classList.remove("overlay");
    scope.panelState.panel.classList.add("docked");
    scope.panelState.panel.style.position = "relative";
    scope.panelState.panel.style.top = "";
    scope.panelState.panel.style.left = "";
    scope.panelState.panel.style.zIndex = "";
    scope.panelState.panel.style.width = "";
    scope.panelState.panel.style.height = "";
    scope.panelState.panel.style.maxHeight = "";
    scope.panelState.panel.style.transform = "";
  };
  scope.panelState.setFloatingStyles = function (left, top, width = null, height = null) {
    scope.panelState.panel.classList.remove("docked");
    scope.panelState.panel.classList.remove("overlay");
    scope.panelState.panel.classList.add("floating");
    scope.panelState.panel.style.position = "absolute";
    scope.panelState.panel.style.left = `${Math.max(8, Math.round(left))}px`;
    scope.panelState.panel.style.top = `${Math.max(8, Math.round(top))}px`;
    const currentWidth = String(scope.panelState.panel.style.width || "").trim();
    const currentHeight = String(scope.panelState.panel.style.height || "").trim();
    if (!currentWidth || currentWidth === "100%") {
      const nextWidth = Math.max(280, Math.round(width || 460));
      scope.panelState.panel.style.width = `${nextWidth}px`;
    }
    if (!currentHeight || currentHeight === "100%") {
      const nextHeight = Math.max(200, Math.round(height || 340));
      scope.panelState.panel.style.height = `${nextHeight}px`;
    }
    scope.panelState.bringToFront();
  };
  scope.panelState.setOverlayStyles = function () {
    scope.panelState.panel.classList.remove("docked");
    scope.panelState.panel.classList.remove("floating");
    scope.panelState.panel.classList.remove("maximized");
    scope.panelState.panel.classList.add("overlay");
    const preferredWidth = Math.min(window.innerWidth * 0.9, 720);
    const topOffset = Math.max(56, window.__nvGlobalToolbarHeight || 64);
    Object.assign(scope.panelState.panel.style, {
      position: "fixed",
      top: `${topOffset}px`,
      left: "50%",
      width: `${Math.round(preferredWidth)}px`,
      maxHeight: "80vh",
      transform: "translateX(-50%)",
      zIndex: "1200",
      height: ""
    });
    scope.panelState.bringToFront();
  };
  scope.panelState.attachOverlayKeyHandler = function () {
    if (scope.panelState.overlayKeyHandler) return;
    scope.panelState.overlayKeyHandler = e => {
      if (e.key === "Escape") {
        scope.panelState.dismissOverlay();
      }
    };
    window.addEventListener("keydown", scope.panelState.overlayKeyHandler);
  };
  scope.panelState.detachOverlayKeyHandler = function () {
    if (!scope.panelState.overlayKeyHandler) return;
    window.removeEventListener("keydown", scope.panelState.overlayKeyHandler);
    scope.panelState.overlayKeyHandler = null;
  };
  scope.panelState.getDefaultDockCell = function () {
    const override = scope.panelState.panel.__nvDefaultDockCell;
    if (override && override.isConnected && override.classList?.contains("panel-cell")) {
      return override;
    }
    if (scope.panelState.lastDockCell && scope.panelState.lastDockCell.isConnected) return scope.panelState.lastDockCell;
    return null;
  };
}
