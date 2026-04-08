// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/CircuitEditorComponents/CircuitEditorRuntime.mjs
// This file stitches together the circuit editor UI. This file builds layout, state, rendering, interactions, toolbar, palette, inspector, and save/load plumbing.

import { updateToolbarState } from "/panels/createToolbar.mjs";
import { createCircuitLayout } from "./CircuitEditorLayout.mjs";
import { createCircuitState, markDirty, resetDirty } from "./CircuitEditorState.mjs";
import { renderCircuitToolbar } from "./CircuitToolbar.mjs";
import { renderSymbolPalette } from "./SymbolPalette.mjs";
import { createPropertiesInspector } from "./PropertiesInspector.mjs";
import { createSchematicCanvas } from "./SchematicCanvas.mjs";
import { createSchematicRenderer } from "./SchematicRenderer.mjs";
import { setupInteractions } from "./SchematicInteractions.mjs";
import { loadCircuitFile, saveCircuitFile } from "./CircuitFileFormat.mjs";

export async function renderEditor(filePath, container) {
  if (!container) throw new Error("Container required");
  const doc = await loadCircuitFile(filePath);
  const state = createCircuitState(doc);
  state.filePath = filePath;

  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.currentMode = "CIRediting";
  window.NodevisionState.activePanelType = "GraphicalEditor";
  window.NodevisionState.selectedFile = filePath;

  function handleCircuitToolbarAction(callbackKey) {
    const map = {
      cirInsertResistor: "resistor",
      cirInsertCapacitor: "capacitor",
      cirInsertInductor: "inductor",
      cirInsertVoltageSource: "vsource",
      cirInsertCurrentSource: "isource",
      cirInsertDiode: "diode",
      cirInsertOpAmp: "opamp",
      cirInsertTransistor: "npn",
      cirInsertOther: "ground",
      cirInsertSource: "vsource",
    };
    if (callbackKey === "cirShowCircuitElements") {
      if (layout.subToolbarFallback) {
        layout.subToolbarFallback.style.display = "flex";
        palette = renderSymbolPalette(
          layout.subToolbarFallback,
          state,
          (symId) => {
            state.activeSymbol = symId;
            state.tool = "place";
            state.placeDraft = null;
            layout.message.textContent = `Place ${symId}`;
            palette?.update?.();
            toolbar.update?.();
            layout.subToolbarFallback.style.display = "none";
            canvas.updateCursor("place");
          },
          ["resistor", "inductor", "capacitor", "diode", "opamp", "npn", "ground"]
        ) || palette;
      }
      return;
    }
    if (callbackKey === "cirWireTool") {
      state.tool = "wire";
      layout.message.textContent = "Wire tool active";
      if (layout.subToolbarFallback) layout.subToolbarFallback.style.display = "none";
      state.placeDraft = null;
      renderer.render();
      toolbar.update?.();
      canvas.updateCursor("wire");
      return;
    }
    const sym = map[callbackKey];
    if (!sym) return;
    state.activeSymbol = sym;
    state.tool = "place";
    state.placeDraft = null;
    layout.message.textContent = `Insert ${sym}`;
    if (layout.subToolbarFallback) layout.subToolbarFallback.style.display = "none";
    palette?.update?.();
    toolbar.update?.();
    canvas.updateCursor("place");
  }

  updateToolbarState({
    currentMode: "CIRediting",
    activePanelType: "GraphicalEditor",
    selectedFile: filePath,
    fileIsDirty: false,
    activeActionHandler: handleCircuitToolbarAction,
  });

  const layout = createCircuitLayout(container);
  const canvas = createSchematicCanvas(layout.canvasHost, state, () => {});
  const renderer = createSchematicRenderer(canvas, state);
  const inspector = createPropertiesInspector(layout.inspector, state, {
    onChange: (msg) => {
      markDirty(state, msg);
      renderer.render();
      updateToolbarState({ fileIsDirty: state.dirty });
    },
    onGridChange: (size) => {
      canvas.updateGridSize(size);
      renderer.render();
      markDirty(state, "Changed grid");
      updateToolbarState({ fileIsDirty: state.dirty });
    },
  });

  const toolbar = renderCircuitToolbar(layout.toolbar, state, {
    setTool: (tool) => {
      state.tool = tool;
      layout.message.textContent = `${tool} tool active`;
      toolbar.update?.();
      canvas.updateCursor(tool);
    },
    rotate: () => {
      state.document.components.forEach((c) => {
        if (state.selection.includes(c.id)) c.rotation = ((c.rotation || 0) + 90) % 360;
      });
      markDirty(state, "Rotated selection");
      renderer.render();
      inspector.render();
    },
    deleteSelection: () => deleteSelection(),
    save: () => save(),
  });

  const subToolbarHost = document.querySelector("#sub-toolbar");
  if (subToolbarHost) subToolbarHost.style.display = "flex";
  if (layout.subToolbarFallback) layout.subToolbarFallback.style.display = "none";
  let palette = { update: () => {} };
  window.NodevisionState.activeActionHandler = handleCircuitToolbarAction;
  window.dispatchEvent(new CustomEvent("nv-show-subtoolbar", {
    detail: { heading: "Insert", force: true, toggle: false }
  }));

  function deleteSelection() {
    if (!state.selection.length) return;
    const ids = new Set(state.selection);
    state.document.components = state.document.components.filter((c) => !ids.has(c.id));
    state.document.wires = state.document.wires.filter((w) => !ids.has(w.id));
    state.selection = [];
    inspector.render();
    renderer.render();
    markDirty(state, "Deleted selection");
    updateToolbarState({ fileIsDirty: state.dirty });
  }

  async function save() {
    try {
      await saveCircuitFile(state.filePath, state.document);
      resetDirty(state);
      layout.message.textContent = "Saved schematic";
      updateToolbarState({ fileIsDirty: false });
    } catch (err) {
      layout.message.textContent = `Save failed: ${err.message}`;
    }
  }

  window.saveWYSIWYGFile = async (path = state.filePath) => {
    await saveCircuitFile(path, state.document);
    resetDirty(state);
    updateToolbarState({ fileIsDirty: false });
  };
  window.saveMDFile = window.saveWYSIWYGFile;

  setupInteractions(canvas, state, renderer, inspector, {
    onChange: (msg) => {
      markDirty(state, msg);
      updateToolbarState({ fileIsDirty: state.dirty });
      layout.message.textContent = msg;
    },
    onTransientChange: () => layout.message.textContent = "Moving...",
    deleteSelection,
    onToolChange: () => toolbar.update?.(),
    onHover: (id) => {
      state.hover = id;
      renderer.render();
    },
  });

  renderer.render();
  inspector.render();
  palette?.update?.();
  toolbar.update?.();

  layout.message.textContent = filePath ? `Opened ${filePath}` : "Blank schematic";
}
