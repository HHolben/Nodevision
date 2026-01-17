// Nodevision/public/ToolbarCallbacks/draw/PickColor.mjs
// Adds an undocked panel for selecting the current draw color

import { createPanel } from "/panels/panelManager.mjs";

export function PickColor() {
  // Prevent duplicate panels
  if (document.getElementById("pick-color-panel")) {
    return;
  }

  const panel = createPanel({
    id: "pick-color-panel",
    title: "Pick Color",
    docked: false, // explicitly undocked
    width: 220,
    height: 140,
  });

  panel.innerHTML = `
    <div class="pick-color-panel">
      <label for="draw-color-input">Draw color:</label>
      <input 
        id="draw-color-input"
        type="color"
        value="${window.NodevisionState?.drawColor || "#000000"}"
      />
      <div class="color-preview"></div>
    </div>
  `;

  const colorInput = panel.querySelector("#draw-color-input");
  const preview = panel.querySelector(".color-preview");

  const updateColor = (color) => {
    if (!window.NodevisionState) window.NodevisionState = {};
    window.NodevisionState.drawColor = color;
    preview.style.backgroundColor = color;
  };

  // Initial preview
  updateColor(colorInput.value);

  colorInput.addEventListener("input", (e) => {
    updateColor(e.target.value);
  });
}
