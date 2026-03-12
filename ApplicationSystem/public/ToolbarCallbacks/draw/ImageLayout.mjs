// Nodevision/public/ToolbarCallbacks/draw/ImageLayout.mjs
// Shared layout sub-toolbar for both PNG and SVG editors.

function clampInt(value, fallback = 0) {
  const numeric = Math.floor(Number(value));
  if (!Number.isFinite(numeric)) return fallback;
  return numeric;
}

function clampNonNegative(value) {
  return Math.max(0, clampInt(value, 0));
}

function asButton(id, label) {
  return `<button id="${id}" type="button">${label}</button>`;
}

function getSvgApi() {
  const api = window.SVGEditorContext;
  if (!api) return null;
  if (typeof api.getCanvasSize !== "function") return null;
  return api;
}

function getPngApi() {
  const api = window.__nvPngEditorApi;
  if (!api) return null;
  if (typeof api.getCanvasSize !== "function") return null;
  return api;
}

function getActiveImageApi() {
  const mode = window.NodevisionState?.currentMode;
  if (mode === "SVG Editing") return getSvgApi() || getPngApi();
  if (mode === "PNGediting") return getPngApi() || getSvgApi();
  return getPngApi() || getSvgApi();
}

export default function ImageLayout() {
  const subToolbar = document.getElementById("sub-toolbar");
  if (!subToolbar) return;

  subToolbar.innerHTML = `
    <div data-image-layout-widget="true" class="nv-subtoolbar-widget" style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
      <strong>Layout</strong>

      <span style="color:#222;">Canvas</span>
      <input id="img-layout-width" type="number" min="1" style="width:90px;" />
      <span style="font-weight:bold;">×</span>
      <input id="img-layout-height" type="number" min="1" style="width:90px;" />
      ${asButton("img-layout-resize", "Resize")}

      <span style="margin-left:10px;color:#222;">Crop</span>
      ${asButton("img-layout-crop-selection", "To Selection")}
      <span style="color:#555;">L</span><input id="img-layout-crop-left" type="number" min="0" style="width:60px;" value="0" />
      <span style="color:#555;">T</span><input id="img-layout-crop-top" type="number" min="0" style="width:60px;" value="0" />
      <span style="color:#555;">R</span><input id="img-layout-crop-right" type="number" min="0" style="width:60px;" value="0" />
      <span style="color:#555;">B</span><input id="img-layout-crop-bottom" type="number" min="0" style="width:60px;" value="0" />
      ${asButton("img-layout-crop-edges", "Crop Edges")}

      <span style="margin-left:10px;color:#222;">Transform</span>
      ${asButton("img-layout-rot-cw", "⟳ 90°")}
      ${asButton("img-layout-rot-ccw", "⟲ 90°")}
      ${asButton("img-layout-flip-h", "Flip H")}
      ${asButton("img-layout-flip-v", "Flip V")}

      <span id="img-layout-current" class="nv-mono" style="color:#555;white-space:nowrap;margin-left:auto;"></span>
    </div>
  `;

  subToolbar.style.display = "flex";

  const widthInput = subToolbar.querySelector("#img-layout-width");
  const heightInput = subToolbar.querySelector("#img-layout-height");
  const resizeBtn = subToolbar.querySelector("#img-layout-resize");
  const cropSelectionBtn = subToolbar.querySelector("#img-layout-crop-selection");
  const cropLeft = subToolbar.querySelector("#img-layout-crop-left");
  const cropTop = subToolbar.querySelector("#img-layout-crop-top");
  const cropRight = subToolbar.querySelector("#img-layout-crop-right");
  const cropBottom = subToolbar.querySelector("#img-layout-crop-bottom");
  const cropEdgesBtn = subToolbar.querySelector("#img-layout-crop-edges");

  const rotCwBtn = subToolbar.querySelector("#img-layout-rot-cw");
  const rotCcwBtn = subToolbar.querySelector("#img-layout-rot-ccw");
  const flipHBtn = subToolbar.querySelector("#img-layout-flip-h");
  const flipVBtn = subToolbar.querySelector("#img-layout-flip-v");
  const currentLabel = subToolbar.querySelector("#img-layout-current");

  if (
    !widthInput || !heightInput || !resizeBtn || !cropSelectionBtn ||
    !cropLeft || !cropTop || !cropRight || !cropBottom || !cropEdgesBtn ||
    !rotCwBtn || !rotCcwBtn || !flipHBtn || !flipVBtn || !currentLabel
  ) {
    return;
  }

  const setEnabled = (el, enabled, title = "") => {
    el.disabled = !enabled;
    if (title) el.title = title;
  };

  const refresh = () => {
    const api = getActiveImageApi();
    if (!api) {
      currentLabel.textContent = "Open a PNG/SVG editor to use Layout";
      [
        resizeBtn, cropSelectionBtn, cropEdgesBtn,
        rotCwBtn, rotCcwBtn, flipHBtn, flipVBtn,
      ].forEach((btn) => setEnabled(btn, false));
      return;
    }

    const size = api.getCanvasSize?.() || {};
    const w = Math.max(1, clampInt(size.width, 1));
    const h = Math.max(1, clampInt(size.height, 1));
    currentLabel.textContent = `${w}×${h}`;

    if (document.activeElement !== widthInput) widthInput.value = String(w);
    if (document.activeElement !== heightInput) heightInput.value = String(h);

    setEnabled(resizeBtn, typeof api.resizeCanvas === "function");
    setEnabled(cropSelectionBtn, typeof api.cropToSelection === "function" && (api.canCrop?.() ?? true));
    setEnabled(cropEdgesBtn, typeof api.cropEdges === "function");

    setEnabled(rotCwBtn, typeof api.rotate90CW === "function");
    setEnabled(rotCcwBtn, typeof api.rotate90CCW === "function");
    setEnabled(flipHBtn, typeof api.flipHorizontal === "function");
    setEnabled(flipVBtn, typeof api.flipVertical === "function");
  };

  const performResize = () => {
    const api = getActiveImageApi();
    if (!api || typeof api.resizeCanvas !== "function") return;
    const requestedWidth = Math.max(1, clampInt(widthInput.value, 1));
    const requestedHeight = Math.max(1, clampInt(heightInput.value, 1));
    api.resizeCanvas(requestedWidth, requestedHeight);
    refresh();
  };

  const performCropSelection = () => {
    const api = getActiveImageApi();
    if (!api || typeof api.cropToSelection !== "function") return;
    api.cropToSelection();
    refresh();
  };

  const performCropEdges = () => {
    const api = getActiveImageApi();
    if (!api || typeof api.cropEdges !== "function") return;
    api.cropEdges({
      left: clampNonNegative(cropLeft.value),
      top: clampNonNegative(cropTop.value),
      right: clampNonNegative(cropRight.value),
      bottom: clampNonNegative(cropBottom.value),
    });
    refresh();
  };

  resizeBtn.addEventListener("click", performResize);
  cropSelectionBtn.addEventListener("click", performCropSelection);
  cropEdgesBtn.addEventListener("click", performCropEdges);
  widthInput.addEventListener("keydown", (evt) => { if (evt.key === "Enter") performResize(); });
  heightInput.addEventListener("keydown", (evt) => { if (evt.key === "Enter") performResize(); });

  rotCwBtn.addEventListener("click", () => { getActiveImageApi()?.rotate90CW?.(); refresh(); });
  rotCcwBtn.addEventListener("click", () => { getActiveImageApi()?.rotate90CCW?.(); refresh(); });
  flipHBtn.addEventListener("click", () => { getActiveImageApi()?.flipHorizontal?.(); refresh(); });
  flipVBtn.addEventListener("click", () => { getActiveImageApi()?.flipVertical?.(); refresh(); });

  // Keep widget in sync with editor changes.
  if (window.__nvImageLayoutListener) {
    window.removeEventListener("nv-png-editor-layout-changed", window.__nvImageLayoutListener);
    window.removeEventListener("nv-svg-editor-layout-changed", window.__nvImageLayoutListener);
  }
  window.__nvImageLayoutListener = () => refresh();
  window.addEventListener("nv-png-editor-layout-changed", window.__nvImageLayoutListener);
  window.addEventListener("nv-svg-editor-layout-changed", window.__nvImageLayoutListener);

  refresh();
}
