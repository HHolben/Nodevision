// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/CreateCommitPendingRotationCommandHandler.mjs
// This module implements create Commit Pending Rotation Command Handler behavior for the SVGeditorRuntime feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

// Create Commit Pending Rotation Command Handler operations.
export function createCommitPendingRotationCommandHandler(owner) {
  return function (options = {}) {
    const command = owner.svgSession.pendingRotateCommand;
    if (!command) return false;
    owner.svgSession.pendingRotateCommand = null;
    if (!command.applied) {
      owner.svgSession.restoreRotationCommandBase(command);
      owner.svgSession.refreshSelectionVisuals();
      if (!options.silent) owner.svgSession.setStatus(command.originChanged ? "Rotation origin set" : "Rotate canceled: no angle applied");
      return Boolean(command.originChanged);
    }
    const before = command.beforeSvgText || "";
    const after = owner.svgSession.serializeSvgForSave();
    if (before && after && before !== after) {
      owner.svgSession.history.pushCustom({
        kind: "rotate-selection",
        undo: () => {
          owner.svgSession.setSvgFromString(before);
          return {
            label: "rotate-selection"
          };
        },
        redo: () => {
          owner.svgSession.setSvgFromString(after);
          return {
            label: "rotate-selection"
          };
        }
      });
      owner.svgSession.markDocumentDirty(true);
    }
    owner.svgSession.refreshSelectionAfterMutation("rotate");
    if (!options.silent) owner.svgSession.setStatus("Rotation applied");
    return true;
  };
}

export function createHandleSelectionRotateKeyHandler(owner) {
  return function (e) {
    const key = String(e.key || "");
    const lower = key.toLowerCase();
    if (e.ctrlKey || e.metaKey || e.altKey) return false;
    if (owner.svgSession.pendingRotateCommand) {
      if (owner.svgSession.pendingRotateCommand.originPlacement) {
        if (key === "Enter") {
          owner.svgSession.pendingRotateCommand.originPlacement = null;
          owner.svgSession.updatePendingRotationStatus("Rotation origin kept; type angle, drag selection, Enter commits");
          return true;
        }
        if (key === "Escape") {
          owner.svgSession.pendingRotateCommand.originPlacement = null;
          owner.svgSession.updatePendingRotationStatus("Rotation origin placement canceled");
          return true;
        }
        if (key === "Backspace") {
          if (owner.svgSession.pendingRotateCommand.originPlacement.axis) {
            owner.svgSession.pendingRotateCommand.originPlacement.axis = null;
            owner.svgSession.pendingRotateCommand.prefix = "ro";
            owner.svgSession.updateRotationOriginPlacementStatus("Rotation origin axis constraint cleared; click selected object to place it");
            return true;
          }
          owner.svgSession.pendingRotateCommand.originPlacement = null;
          owner.svgSession.updatePendingRotationStatus();
          return true;
        }
        if (lower === "x" || lower === "y") return owner.svgSession.setPendingRotationOriginAxis(lower);
        if (lower === "z") {
          owner.svgSession.setStatus("Rotation origin is 2D; use X or Y to constrain placement");
          return true;
        }
        if (lower === "o") return owner.svgSession.startRotationOriginPlacement();
        return false;
      }
      if (key === "Enter") return owner.svgSession.commitPendingRotationCommand();
      if (key === "Escape") return owner.svgSession.cancelPendingRotationCommand();
      if (key === "Backspace") {
        if (owner.svgSession.pendingRotateCommand.buffer) {
          owner.svgSession.pendingRotateCommand.buffer = owner.svgSession.pendingRotateCommand.buffer.slice(0, -1);
          return owner.svgSession.reapplyPendingRotationBuffer();
        }
        if (owner.svgSession.pendingRotateCommand.prefix === "rd") return owner.svgSession.setPendingRotationUnit("rad");
        return owner.svgSession.cancelPendingRotationCommand();
      }
      if (key === "-") return owner.svgSession.togglePendingRotationDirection();
      if (key === "+") {
        owner.svgSession.pendingRotateCommand.directionSign = 1;
        return owner.svgSession.pendingRotateCommand.buffer ? owner.svgSession.reapplyPendingRotationBuffer() : (owner.svgSession.updatePendingRotationStatus("Rotate sign set positive"), true);
      }
      if (!owner.svgSession.pendingRotateCommand.buffer && lower === "o") return owner.svgSession.startRotationOriginPlacement();
      if (!owner.svgSession.pendingRotateCommand.buffer && lower === "r") return owner.svgSession.setPendingRotationUnit("rad");
      if (!owner.svgSession.pendingRotateCommand.buffer && lower === "d") return owner.svgSession.setPendingRotationUnit("deg");
      if (key.length !== 1 || !"0123456789.".includes(key)) return false;
      if (key === "." && owner.svgSession.pendingRotateCommand.buffer.includes(".")) return false;
      owner.svgSession.pendingRotateCommand.buffer += key;
      return owner.svgSession.reapplyPendingRotationBuffer();
    }
    if (owner.svgSession.toolState.mode !== "select" && owner.svgSession.toolState.mode !== "rotate") return false;
    if (lower !== "r" || key.length !== 1) return false;
    owner.svgSession.beginPendingRotationCommand("keyboard");
    return true;
  };
}

export function createAlignSelectionHandler(owner) {
  return function (mode = "left") {
    if (owner.svgSession.selectedElements.length < 2) return false;
    const boxes = owner.svgSession.selectedElements.map(el => ({
      el,
      bbox: owner.svgSession.getElementBBoxInRoot(el)
    })).filter(b => b.bbox && Number.isFinite(b.bbox.x) && Number.isFinite(b.bbox.y));
    if (boxes.length < 2) return false;
    const minX = Math.min(...boxes.map(b => b.bbox.x));
    const maxX = Math.max(...boxes.map(b => b.bbox.x + b.bbox.width));
    const centerX = (minX + maxX) / 2;
    boxes.forEach(({
      el,
      bbox
    }) => {
      let dx = 0;
      if (mode === "left") dx = minX - bbox.x;
      if (mode === "right") dx = maxX - (bbox.x + bbox.width);
      if (mode === "center") dx = centerX - (bbox.x + bbox.width / 2);
      if (dx) owner.svgSession.translateElement(el, dx, 0);
    });
    owner.svgSession.refreshSelectionVisuals();
    owner.svgSession.setStatus(`Aligned ${owner.svgSession.selectedElements.length} element(s) ${mode}`);
    return true;
  };
}
