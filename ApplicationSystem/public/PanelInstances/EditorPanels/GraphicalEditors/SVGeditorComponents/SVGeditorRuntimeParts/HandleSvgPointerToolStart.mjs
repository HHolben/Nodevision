// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/HandleSvgPointerToolStart.mjs
// This module implements handle Svg Pointer Tool Start behavior for the SVGeditorRuntime feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { toSvgPoint } from "../svgDom.mjs";

// Handle Svg Pointer Tool Start operations.
export function handleSvgPointerToolStart(scope) {
  scope.owner.svgSession.recordLineProbe("svg-handler:start", {
    mode: scope.owner.svgSession.toolState.mode,
    isTrusted: Boolean(scope.e.isTrusted)
  });
  scope.owner.svgSession.recordLineProbe("pointerdown:start", {
    mode: scope.owner.svgSession.toolState.mode
  });
  scope.owner.svgSession.syncModeFromToolbarState();
  scope.owner.svgSession.recordLineProbe("pointerdown:after-sync", {
    mode: scope.owner.svgSession.toolState.mode
  });
  scope.owner.svgSession.recordLineProbe("coordinate:start");
  scope.pointerStartState.p = toSvgPoint(scope.owner.svgSession.svgRoot, scope.e.clientX, scope.e.clientY);
  scope.owner.svgSession.recordLineProbe("coordinate:end", {
    x: scope.pointerStartState.p.x,
    y: scope.pointerStartState.p.y
  });
  scope.owner.svgSession.recordLineProbe("pointerdown:after-toSvgPoint", {
    x: scope.pointerStartState.p.x,
    y: scope.pointerStartState.p.y
  });
  scope.owner.svgSession.lastPointerRoot = scope.pointerStartState.p;
  scope.owner.svgSession.lastPointerClient = {
    x: scope.e.clientX,
    y: scope.e.clientY
  };
  scope.owner.svgSession.quickMenu.cancelLongPress();
  scope.owner.svgSession.recordLineProbe("pointerdown:after-cancelLongPress");
  scope.owner.svgSession.wrapper.focus();
  scope.owner.svgSession.recordLineProbe("pointerdown:after-focus");
  scope.pointerStartState.barrelQuickMenu = scope.e.pointerType === "pen" && scope.owner.svgSession.drawingAssistSettings.gestureBarrelButtonQuickMenu && (scope.e.buttons & 32 || scope.e.button === 5);
  scope.pointerStartState.rightQuickMenu = scope.e.button === 2 && scope.owner.svgSession.drawingAssistSettings.gestureRightClickQuickMenu;
  if ((scope.pointerStartState.barrelQuickMenu || scope.pointerStartState.rightQuickMenu) && !scope.owner.svgSession.toolState.drawing) {
    scope.owner.svgSession.quickMenu.show(scope.e.clientX, scope.e.clientY, scope.owner.svgSession.drawingAssistSettings);
    scope.e.preventDefault();
    scope.e.stopPropagation();
    return {
      value: void 0
    };
  }
  if (scope.owner.svgSession.selectionGrabState) {
    scope.owner.svgSession.commitSelectionGrabCommand();
    scope.e.preventDefault();
    scope.e.stopPropagation();
    return {
      value: void 0
    };
  }
  if (scope.owner.svgSession.toolState.mode !== "sketch" && scope.owner.svgSession.nodeEditor.isActive?.() && scope.owner.svgSession.nodeEditor.onPointerDown?.(scope.e, scope.e.target, scope.pointerStartState.p)) return {
    value: void 0
  };
}
