// Nodevision/ApplicationSystem/public/PanelInstances/ControlPanels/ScadTimelinePanel.mjs
// ControlPanel wrapper for the graphical SCAD editor history timeline.

import { renderScadTimelinePanel } from "/PanelInstances/EditorPanels/ScadTimelinePanel.mjs";

function getContext() {
  return window.GraphicalScadEditorContext || null;
}

function render(panel) {
  const ctx = getContext();
  panel.innerHTML = "";
  Object.assign(panel.style, {
    display: "flex",
    flexDirection: "column",
    minHeight: "0",
    overflow: "hidden",
  });

  if (!ctx?.getModel) {
    const message = document.createElement("div");
    message.textContent = "Open a graphical SCAD editor to show the CADtimeline.";
    Object.assign(message.style, { padding: "12px", color: "#b00020", font: "12px/1.35 system-ui, sans-serif" });
    panel.appendChild(message);
    return;
  }

  const model = ctx.getModel();
  const selectedIds = ctx.getSelectedIds?.() || [];
  renderScadTimelinePanel(panel, { model, selectedIds }, {
    selectStep: (step) => ctx.selectTimelineStep?.(step),
    toggleStep: (id, disabled) => ctx.toggleTimelineStep?.(id, disabled),
    renameStep: (id, label) => ctx.renameTimelineStep?.(id, label),
    deleteStep: (id) => ctx.deleteTimelineStep?.(id),
  });
}

export async function setupPanel(panel) {
  if (!panel) throw new Error("Panel container required.");
  if (typeof panel.__nvCleanupScadTimelinePanel === "function") panel.__nvCleanupScadTimelinePanel();
  const rerender = () => render(panel);
  render(panel);
  window.addEventListener("nv-scad-model-changed", rerender);
  window.addEventListener("nodevision:scad-selection-changed", rerender);
  window.addEventListener("nodevision:scad-layers-changed", rerender);
  panel.__nvCleanupScadTimelinePanel = () => {
    window.removeEventListener("nv-scad-model-changed", rerender);
    window.removeEventListener("nodevision:scad-selection-changed", rerender);
    window.removeEventListener("nodevision:scad-layers-changed", rerender);
  };
  return panel.__nvCleanupScadTimelinePanel;
}
