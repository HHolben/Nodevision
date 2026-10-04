// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/CreateCommitSelectionGrabCommandHandler.mjs
// This module implements create Commit Selection Grab Command Handler behavior for the SVGeditorRuntime feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

// Create Commit Selection Grab Command Handler operations.
export function createCommitSelectionGrabCommandHandler(owner) {
  return function (options = {}) {
    const grab = owner.svgSession.selectionGrabState;
    if (!grab) return false;
    owner.svgSession.selectionGrabState = null;
    if (grab.layerOrderMode) {
      if (!options.silent) owner.svgSession.setStatus("Layer order shortcut ended");
      return false;
    }
    if (!grab.applied) {
      if (!options.silent) owner.svgSession.setStatus("Grab released");
      return false;
    }
    const before = grab.beforeSvgText || "";
    const after = owner.svgSession.serializeSvgForSave();
    if (before && after && before !== after) {
      owner.svgSession.history.pushCustom({
        kind: "grab-selection",
        undo: () => {
          owner.svgSession.setSvgFromString(before);
          return {
            label: "grab-selection"
          };
        },
        redo: () => {
          owner.svgSession.setSvgFromString(after);
          return {
            label: "grab-selection"
          };
        }
      });
      owner.svgSession.markDocumentDirty(true);
    }
    owner.svgSession.refreshSelectionAfterMutation("grab");
    if (!options.silent) owner.svgSession.setStatus("Grab released");
    return true;
  };
}

export function createHandleSelectionGrabKeyHandler(owner) {
  return function (e) {
    const key = String(e.key || "");
    const lower = key.toLowerCase();
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    if (owner.svgSession.selectionGrabState) {
      if (owner.svgSession.selectionGrabState.layerOrderMode) {
        if (key === "Enter") return owner.svgSession.finishSelectionLayerOrderCommand();
        if (key === "Escape") return owner.svgSession.cancelSelectionGrabCommand();
        if (key === "PageUp" || key === "ArrowUp") return owner.svgSession.moveSelectionLayerOrderShortcut(1);
        if (key === "PageDown" || key === "ArrowDown") return owner.svgSession.moveSelectionLayerOrderShortcut(-1);
        return false;
      }
      if (key === "Enter") return owner.svgSession.commitSelectionGrabCommand();
      if (key === "Escape") return owner.svgSession.cancelSelectionGrabCommand();
      if (key === "Backspace") {
        if (!owner.svgSession.selectionGrabState.axis) return true;
        owner.svgSession.selectionGrabState.buffer = owner.svgSession.selectionGrabState.buffer.slice(0, -1);
        return owner.svgSession.applySelectionGrabPercentBuffer();
      }
      if (lower === "z" && key.length === 1 && !owner.svgSession.selectionGrabState.axis && !owner.svgSession.selectionGrabState.buffer) return owner.svgSession.beginSelectionLayerOrderCommand();
      if (lower === "x" || lower === "y") return owner.svgSession.setSelectionGrabAxis(lower);
      if (key === "-") return owner.svgSession.toggleSelectionGrabAxisDirection();
      if (key === "+") return owner.svgSession.toggleSelectionGrabAxisDirection(1);
      if (!owner.svgSession.selectionGrabState.axis || !"0123456789.".includes(key)) return false;
      if (key === "." && owner.svgSession.selectionGrabState.buffer.includes(".")) return false;
      owner.svgSession.selectionGrabState.buffer += key;
      return owner.svgSession.applySelectionGrabPercentBuffer();
    }
    if (owner.svgSession.toolState.mode !== "select" && owner.svgSession.toolState.mode !== "rotate") return false;
    if (lower !== "g" || key.length !== 1) return false;
    return owner.svgSession.beginSelectionGrabCommand("keyboard");
  };
}

export function createBeginPendingRotationCommandHandler(owner) {
  return function (source = "keyboard") {
    if (owner.svgSession.pendingRotateCommand) return owner.svgSession.pendingRotateCommand;
    if (!owner.svgSession.selectedElements.length) {
      owner.svgSession.setMode("rotate");
      owner.svgSession.setStatus("Rotate tool: select an object, then drag or type an angle");
      return null;
    }
    if (owner.svgSession.nodeEditor.isActive?.()) owner.svgSession.nodeEditor.exit?.();
    const centerRoot = owner.svgSession.getRotationCenterRoot();
    if (!centerRoot) {
      owner.svgSession.setStatus("Rotate: selection cannot be measured");
      return null;
    }
    const items = owner.svgSession.buildRotationCommandItems(owner.svgSession.selectedElements);
    if (!items.length) return null;
    owner.svgSession.pendingRotateCommand = {
      source,
      prefix: "r",
      unit: "rad",
      buffer: "",
      directionSign: 1,
      angleRad: 0,
      applied: false,
      originChanged: false,
      centerRoot,
      items,
      beforeSvgText: owner.svgSession.serializeSvgForSave()
    };
    owner.svgSession.updateRotationOriginMarker(centerRoot);
    owner.svgSession.updatePendingRotationStatus("Rotate preview started: type radians, ro origin, rr radians, rd degrees, drag selection, Enter commits, Esc cancels");
    return owner.svgSession.pendingRotateCommand;
  };
}
