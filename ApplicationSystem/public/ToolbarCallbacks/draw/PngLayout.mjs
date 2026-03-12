// Nodevision/public/ToolbarCallbacks/draw/PngLayout.mjs
// Renders PNG layout controls directly in the sub-toolbar row.

function clampInt(value, fallback) {
  const numeric = Math.floor(Number(value));
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(1, numeric);
}

export default function PngLayout() {
  const subToolbar = document.getElementById("sub-toolbar");
  if (!subToolbar) return;

  const api = window.__nvPngEditorApi;

  subToolbar.innerHTML = `
    <div
      data-png-layout-widget="true"
      style="display:flex;align-items:center;gap:10px;padding:4px 6px;background:#f5f5f5;border:1px solid #333;border-radius:4px;flex-wrap:wrap;"
    >
      <strong style="font-size:12px;">Layout</strong>
      <span style="font-size:12px;color:#222;">Canvas</span>
      <input id="png-layout-width" type="number" min="1" style="width:70px;padding:3px 6px;border-radius:4px;border:1px solid #888;font-size:12px;background:#fff;" />
      <span style="font-weight:bold;">×</span>
      <input id="png-layout-height" type="number" min="1" style="width:70px;padding:3px 6px;border-radius:4px;border:1px solid #888;font-size:12px;background:#fff;" />
      <button id="png-layout-resize" type="button" style="padding:4px 10px;border-radius:4px;border:1px solid #666;background:#fff;cursor:pointer;font-size:12px;">Resize Canvas</button>
      <button id="png-layout-crop" type="button" style="padding:4px 10px;border-radius:4px;border:1px solid #666;background:#fff;cursor:pointer;font-size:12px;">Crop to Selection</button>
      <span id="png-layout-current" style="color:#555;white-space:nowrap;font-family:monospace;font-size:12px;"></span>
    </div>
  `;

  subToolbar.style.display = "flex";

  const widthInput = subToolbar.querySelector("#png-layout-width");
  const heightInput = subToolbar.querySelector("#png-layout-height");
  const resizeBtn = subToolbar.querySelector("#png-layout-resize");
  const cropBtn = subToolbar.querySelector("#png-layout-crop");
  const currentLabel = subToolbar.querySelector("#png-layout-current");
  if (!widthInput || !heightInput || !resizeBtn || !cropBtn || !currentLabel) return;

  const refresh = () => {
    const liveApi = window.__nvPngEditorApi;
    if (!liveApi || typeof liveApi.getCanvasSize !== "function") {
      resizeBtn.disabled = true;
      cropBtn.disabled = true;
      currentLabel.textContent = "Open a PNG editor to use Layout";
      return;
    }

    const size = liveApi.getCanvasSize?.() || {};
    const w = clampInt(size.width, 1);
    const h = clampInt(size.height, 1);
    currentLabel.textContent = `${w}×${h}`;

    if (document.activeElement !== widthInput) widthInput.value = String(w);
    if (document.activeElement !== heightInput) heightInput.value = String(h);

    const canCrop = Boolean(liveApi.canCrop?.());
    cropBtn.disabled = !canCrop;
    resizeBtn.disabled = false;
  };

  const performResize = () => {
    const liveApi = window.__nvPngEditorApi;
    if (!liveApi || typeof liveApi.resizeCanvas !== "function") return;
    const requestedWidth = clampInt(widthInput.value, 1);
    const requestedHeight = clampInt(heightInput.value, 1);
    liveApi.resizeCanvas(requestedWidth, requestedHeight);
    refresh();
  };

  const performCrop = () => {
    const liveApi = window.__nvPngEditorApi;
    if (!liveApi || typeof liveApi.cropToSelection !== "function") return;
    liveApi.cropToSelection();
    refresh();
  };

  resizeBtn.addEventListener("click", performResize);
  cropBtn.addEventListener("click", performCrop);
  widthInput.addEventListener("keydown", (evt) => {
    if (evt.key === "Enter") performResize();
  });
  heightInput.addEventListener("keydown", (evt) => {
    if (evt.key === "Enter") performResize();
  });

  // Keep the widget in sync with selection/canvas changes.
  if (window.__nvPngLayoutListener) {
    window.removeEventListener(
      "nv-png-editor-layout-changed",
      window.__nvPngLayoutListener,
    );
  }
  window.__nvPngLayoutListener = () => refresh();
  window.addEventListener(
    "nv-png-editor-layout-changed",
    window.__nvPngLayoutListener,
  );

  refresh();
}

