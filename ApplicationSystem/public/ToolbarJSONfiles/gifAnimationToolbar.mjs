// Nodevision/ApplicationSystem/public/ToolbarJSONfiles/gifAnimationToolbar.mjs
// Compact sub-toolbar controls for GIF frame editing.

export function initToolbarWidget(hostElement) {
  if (!hostElement) return;
  hostElement.innerHTML = `
    <div data-gif-animation-widget="true" class="nv-subtoolbar-widget" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
      <strong>Animations</strong>
      <button type="button" data-gif-action="previous" title="Previous frame">Prev</button>
      <button type="button" data-gif-action="next" title="Next frame">Next</button>
      <span id="gif-animation-status" class="nv-mono" style="color:#333;white-space:nowrap;">Frame 1 / 1</span>
      <label style="display:flex;align-items:center;gap:4px;color:#222;white-space:nowrap;">Delay
        <input id="gif-animation-delay" type="number" min="10" max="60000" step="10" value="100" style="width:74px;" />
        ms
      </label>
      <button type="button" data-gif-action="capture" title="Capture the current canvas into this frame">Capture</button>
      <button type="button" data-gif-action="duplicate" title="Duplicate current frame">Duplicate</button>
      <button type="button" data-gif-action="delete" title="Delete current frame">Delete</button>
      <span id="gif-animation-size" class="nv-mono" style="color:#666;white-space:nowrap;margin-left:auto;"></span>
    </div>
  `;

  const status = hostElement.querySelector("#gif-animation-status");
  const delayInput = hostElement.querySelector("#gif-animation-delay");
  const sizeLabel = hostElement.querySelector("#gif-animation-size");
  const buttons = Array.from(hostElement.querySelectorAll("button[data-gif-action]"));

  const getContext = () => window.GIFEditorContext || window.__nvGifEditorContext || null;
  const setEnabled = (enabled) => {
    buttons.forEach((button) => {
      button.disabled = !enabled;
    });
    if (delayInput) delayInput.disabled = !enabled;
  };

  const refresh = () => {
    const context = getContext();
    const inGifMode = (window.NodevisionState && window.NodevisionState.currentMode) === "GIFediting";
    if (!context || !inGifMode || typeof context.getState !== "function") {
      if (status) status.textContent = "Open a GIF editor";
      if (sizeLabel) sizeLabel.textContent = "";
      setEnabled(false);
      return;
    }

    const state = context.getState();
    if (status) {
      status.textContent = "Frame " + state.currentFrameNumber + " / " + state.frameCount;
    }
    if (delayInput && document.activeElement !== delayInput) {
      delayInput.value = String(state.delayMs || 100);
    }
    if (sizeLabel) {
      sizeLabel.textContent = String(state.width || 1) + "x" + String(state.height || 1);
    }
    setEnabled(true);
    const deleteButton = hostElement.querySelector("button[data-gif-action=\"delete\"]");
    if (deleteButton) deleteButton.disabled = !state.canDeleteFrame;
  };

  const applyDelay = () => {
    const context = getContext();
    if (!context || typeof context.setFrameDelay !== "function") return;
    context.setFrameDelay(delayInput ? delayInput.value : 100);
    refresh();
  };

  hostElement.addEventListener("click", (evt) => {
    const button = evt.target && evt.target.closest ? evt.target.closest("button[data-gif-action]") : null;
    if (!button || !hostElement.contains(button)) return;
    const context = getContext();
    if (!context) return;
    const action = button.dataset.gifAction;
    if (action === "previous") context.previousFrame && context.previousFrame();
    if (action === "next") context.nextFrame && context.nextFrame();
    if (action === "capture") context.saveCurrentFrame && context.saveCurrentFrame();
    if (action === "duplicate") context.addDuplicateFrame && context.addDuplicateFrame();
    if (action === "delete") context.deleteCurrentFrame && context.deleteCurrentFrame();
    refresh();
  });

  if (delayInput) {
    delayInput.addEventListener("change", applyDelay);
    delayInput.addEventListener("keydown", (evt) => {
      if (evt.key === "Enter") applyDelay();
    });
  }

  if (window.__nvGifAnimationToolbarListener) {
    window.removeEventListener("nv-gif-editor-state-changed", window.__nvGifAnimationToolbarListener);
  }
  window.__nvGifAnimationToolbarListener = () => refresh();
  window.addEventListener("nv-gif-editor-state-changed", window.__nvGifAnimationToolbarListener);

  refresh();
}
