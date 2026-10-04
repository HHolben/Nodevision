// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/InstallSvgClipboardCommands.mjs
// This module implements install Svg Clipboard Commands behavior for the SVGeditorRuntime feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { cleanupSvgCloneForSave } from "../SvgPreservation.mjs";
import { createAlignSelectionHandler } from "./CreateCommitPendingRotationCommandHandler.mjs";
import { SVG_UI_ATTR } from "./CreateBlankSvgRoot.mjs";
import { createMoveSelectionInHierarchyHandler } from "./CreateMoveSelectionInHierarchyHandler.mjs";
import { createSvgEl } from "../svgDom.mjs";

// Install Svg Clipboard Commands operations.
export function installSvgClipboardCommands(scope) {
  scope.svgSession.duplicateSelection = function (offsetX = 20, offsetY = 20) {
    if (!scope.svgSession.selectedElements.length) return [];
    const clones = scope.svgSession.selectedElements.map(el => {
      const clone = cleanupSvgCloneForSave(el.cloneNode(true));
      el.parentNode?.appendChild(clone);
      scope.svgSession.translateElement(clone, offsetX, offsetY);
      return clone;
    });
    scope.svgSession.setSelection(clones, {
      primary: clones[0] || null
    });
    scope.svgSession.setStatus("Selection duplicated");
    return clones;
  };
  scope.svgSession.copySelection = function () {
    if (!scope.svgSession.selectedElements.length) return false;
    scope.svgSession.svgClipboard = scope.svgSession.selectedElements.map(el => cleanupSvgCloneForSave(el.cloneNode(true)));
    scope.svgSession.setStatus("Selection copied");
    return true;
  };
  scope.svgSession.pasteSelection = function (offsetX = 20, offsetY = 20) {
    if (!scope.svgSession.svgClipboard.length) return [];
    const active = scope.svgSession.getActiveLayer() || scope.svgSession.svgRoot;
    const clones = scope.svgSession.svgClipboard.map(template => {
      const clone = template.cloneNode(true);
      active.appendChild(clone);
      scope.svgSession.translateElement(clone, offsetX, offsetY);
      return clone;
    });
    scope.svgSession.setSelection(clones, {
      primary: clones[0] || null
    });
    scope.svgSession.setStatus("Selection pasted");
    return clones;
  };
  scope.svgSession.alignSelection = createAlignSelectionHandler({
    get svgSession() {
      return scope.svgSession;
    }
  });
  scope.svgSession.arrangeSelection = function (mode = "front") {
    if (!scope.svgSession.selectedElements.length) return false;
    if (mode === "front") {
      scope.svgSession.selectedElements.forEach(el => el.parentNode?.appendChild(el));
    } else if (mode === "back") {
      [...scope.svgSession.selectedElements].reverse().forEach(el => {
        if (!el.parentNode) return;
        el.parentNode.insertBefore(el, el.parentNode.firstChild);
      });
    }
    scope.svgSession.setStatus(mode === "front" ? "Brought selection to front" : "Sent selection to back");
    scope.svgSession.refreshSelectionVisuals();
    return true;
  };
  scope.svgSession.isLayerOrderableElement = function (el) {
    if (!(el instanceof SVGElement) || !scope.svgSession.svgRoot.contains(el)) return false;
    if (el === scope.svgSession.overlayLayer || el.closest?.("[" + SVG_UI_ATTR + "]")) return false;
    if (el.getAttribute?.("data-nv-sketch-session") === "true") return false;
    if (el.getAttribute?.("data-nv-sketch-construction") === "true") return false;
    return true;
  };
  scope.svgSession.getHierarchyOrderSelection = function () {
    return scope.svgSession.selectedElements.filter(el => {
      if (!el?.isConnected || !el.parentNode || !scope.svgSession.isLayerOrderableElement(el)) return false;
      return !scope.svgSession.selectedElements.some(other => other !== el && other?.contains?.(el));
    });
  };
  scope.svgSession.moveElementOneHierarchyStep = function (el, direction, selectedSet) {
    const parent = el?.parentNode;
    if (!parent?.children) return false;
    const siblings = Array.from(parent.children).filter(scope.svgSession.isLayerOrderableElement);
    const index = siblings.indexOf(el);
    if (index < 0) return false;
    if (direction >= 0) {
      const next = siblings[index + 1];
      if (!next || selectedSet.has(next)) return false;
      parent.insertBefore(next, el);
      return true;
    }
    const previous = siblings[index - 1];
    if (!previous || selectedSet.has(previous)) return false;
    parent.insertBefore(el, previous);
    return true;
  };
  scope.svgSession.moveSelectionInHierarchy = createMoveSelectionInHierarchyHandler({
    get svgSession() {
      return scope.svgSession;
    }
  });
  scope.svgSession.groupSelection = function () {
    if (scope.svgSession.selectedElements.length < 2) return null;
    const group = createSvgEl("g");
    const firstParent = scope.svgSession.selectedElements[0].parentNode || scope.svgSession.svgRoot;
    firstParent.appendChild(group);
    scope.svgSession.selectedElements.forEach(el => group.appendChild(el));
    scope.svgSession.setSelection([group], {
      primary: group
    });
    scope.svgSession.setStatus("Grouped selection");
    return group;
  };
}
