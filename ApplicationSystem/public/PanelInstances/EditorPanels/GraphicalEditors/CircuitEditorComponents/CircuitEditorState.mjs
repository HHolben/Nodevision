// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/CircuitEditorComponents/CircuitEditorState.mjs
// This file defines circuit editor state helpers for the Nodevision UI. This file describes default schematic data and tracks view-specific flags.

export function createDefaultDocument() {
  return {
    metadata: { title: "Untitled Circuit", format: "nvcircuit", version: 1 },
    sheet: { gridSize: 20, width: 5000, height: 4000 },
    components: [],
    wires: [],
    junctions: [],
    labels: [],
    texts: [],
  };
}

export function createCircuitState(doc = createDefaultDocument()) {
  const cleanDoc = JSON.parse(JSON.stringify(doc));
  return {
    document: cleanDoc,
    tool: "select",
    activeSymbol: null,
    selection: [],
    hover: null,
    drag: null,
    wireDraft: null,
    placeDraft: null,
    refCounters: {},
    zoom: 1,
    pan: { x: 0, y: 0 },
    snap: true,
    message: "",
    dirty: false,
    filePath: null,
  };
}

export function markDirty(state, message = "") {
  state.dirty = true;
  state.message = message;
}

export function resetDirty(state) {
  state.dirty = false;
}
