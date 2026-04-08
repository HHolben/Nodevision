// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/CircuitEditorComponents/CircuitSelectionModel.mjs
// This file defines helpers for selection handling in the circuit editor. This file keeps selection mutations centralized for clarity.

export function setSelection(state, ids) {
  state.selection = Array.from(new Set(ids));
}

export function clearSelection(state) {
  state.selection = [];
}

export function toggleSelection(state, id) {
  const set = new Set(state.selection);
  if (set.has(id)) set.delete(id); else set.add(id);
  state.selection = Array.from(set);
}

export function isSelected(state, id) {
  return state.selection.includes(id);
}
