// Nodevision/ApplicationSystem/public/PanelInstances/ControlPanels/GifTimelinePanel.mjs
// ControlPanel wrapper for the GIF editor frame timeline.

import { renderGifTimelinePanel } from "/PanelInstances/EditorPanels/GifTimelinePanel.mjs";

function getContext() {
  return window.GIFEditorContext || window.__nvGifEditorContext || null;
}

function render(panel) {
  const ctx = getContext();
  panel.innerHTML = "";
  Object.assign(panel.style, {
    display: "flex",
    flexDirection: "column",
    minHeight: "0",
    height: "100%",
    overflow: "hidden",
  });

  if (!ctx?.getState) {
    const message = document.createElement("div");
    message.textContent = "Open a GIF editor to show the timeline.";
    Object.assign(message.style, {
      padding: "12px",
      color: "#7a2632",
      font: "12px/1.35 system-ui, sans-serif",
    });
    panel.appendChild(message);
    return;
  }

  const state = ctx.getState();
  renderGifTimelinePanel(panel, {
    ...state,
    sourceFrames: ctx.frames || [],
  }, {
    selectFrame: (index) => ctx.selectFrame?.(index),
    moveFrame: (fromIndex, toIndex) => ctx.moveFrame?.(fromIndex, toIndex),
    copyFrame: (index) => ctx.copyFrame?.(index),
    pasteFrame: (index) => ctx.pasteFrame?.(index),
    deleteFrame: (index) => ctx.deleteFrame?.(index),
  });
}

export async function setupPanel(panel) {
  if (!panel) throw new Error("Panel container required.");
  if (typeof panel.__nvCleanupGifTimelinePanel === "function") panel.__nvCleanupGifTimelinePanel();
  const rerender = () => render(panel);
  render(panel);
  window.addEventListener("nv-gif-editor-state-changed", rerender);
  panel.__nvCleanupGifTimelinePanel = () => {
    window.removeEventListener("nv-gif-editor-state-changed", rerender);
  };
  return panel.__nvCleanupGifTimelinePanel;
}

export async function createPanel(panel) {
  return setupPanel(panel);
}

export default setupPanel;
