// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/SVGeditorComponents/SVGeditorRuntimeParts/CreateRunSvgSnapshotOperationHandler.mjs
// This module implements create Run Svg Snapshot Operation Handler behavior for the SVGeditorRuntime feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

// Create Run Svg Snapshot Operation Handler operations.
export function createRunSvgSnapshotOperationHandler(owner) {
  return function (label, operation) {
    if (owner.svgSession.svgSnapshotDepth > 0) return operation?.();
    owner.svgSession.svgSnapshotDepth += 1;
    const before = owner.svgSession.serializeSvgForSave();
    try {
      const result = operation?.();
      const after = owner.svgSession.serializeSvgForSave();
      if (!result || before === after) return result;
      owner.svgSession.history.pushCustom({
        kind: label || "svg-operation",
        undo: () => {
          owner.svgSession.setSvgFromString(before);
          return {
            label
          };
        },
        redo: () => {
          owner.svgSession.setSvgFromString(after);
          return {
            label
          };
        }
      });
      owner.svgSession.markDocumentDirty(true);
      owner.svgSession.refreshSelectionAfterMutation(label || "svg-operation");
      return result;
    } finally {
      owner.svgSession.svgSnapshotDepth -= 1;
    }
  };
}

export function createRunSvgSnapshotOperationAsyncHandler(owner) {
  return async function (label, operation) {
    if (owner.svgSession.svgSnapshotDepth > 0) return await operation?.();
    owner.svgSession.svgSnapshotDepth += 1;
    const before = owner.svgSession.serializeSvgForSave();
    try {
      const result = await operation?.();
      const after = owner.svgSession.serializeSvgForSave();
      if (!result || before === after) return result;
      owner.svgSession.history.pushCustom({
        kind: label || "svg-operation",
        undo: () => {
          owner.svgSession.setSvgFromString(before);
          return {
            label
          };
        },
        redo: () => {
          owner.svgSession.setSvgFromString(after);
          return {
            label
          };
        }
      });
      owner.svgSession.markDocumentDirty(true);
      owner.svgSession.refreshSelectionAfterMutation(label || "svg-operation");
      return result;
    } finally {
      owner.svgSession.svgSnapshotDepth -= 1;
    }
  };
}
