// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/CSVHistory.mjs
// This module retains immutable CSV model states and selection coordinates for undo and redo without serializing every cell on each keystroke.

export function createCsvHistory({ readSnapshot, writeSnapshot, maxEntries = 25 }) {
  const undo = [], redo = [];
  const limit = Math.max(1, Math.floor(maxEntries) || 25);
  const push = (stack, state) => {
    stack.push(state);
    if (stack.length > limit) stack.shift();
  };
  const restore = (from, to) => {
    if (!from.length) return false;
    push(to, readSnapshot());
    writeSnapshot(from.pop());
    return true;
  };

  // Models passed here are immutable; public imports must copy caller-owned arrays.
  return {
    record(before) {
      if (before.rows === readSnapshot().rows) return false;
      push(undo, before);
      redo.length = 0;
      return true;
    },
    undo: () => restore(undo, redo),
    redo: () => restore(redo, undo),
    canUndo: () => undo.length > 0,
    canRedo: () => redo.length > 0,
    clear() { undo.length = 0; redo.length = 0; },
  };
}
