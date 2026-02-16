// Nodevision/public/ToolbarCallbacks/draw/PickColor.mjs
// Renders draw color controls directly in the sub-toolbar row.

export function PickColor() {
  const subToolbar = document.getElementById("sub-toolbar");
  if (!subToolbar) return;

  if (!window.NodevisionState) window.NodevisionState = {};
  const currentColor = window.NodevisionState.drawColor || "#000000";
  const currentTool = window.NodevisionState.drawTool || "brush";
  const currentAlpha = Number.isFinite(window.NodevisionState.drawAlpha)
    ? Math.max(0, Math.min(100, Number(window.NodevisionState.drawAlpha)))
    : 0;
  const currentBrushSize = Number.isFinite(window.NodevisionState.drawBrushSize)
    ? Math.max(1, Math.floor(Number(window.NodevisionState.drawBrushSize)))
    : 1;

  subToolbar.innerHTML = `
    <div
      data-draw-color-widget="true"
      style="display:flex;align-items:center;gap:10px;padding:4px 6px;background:#f5f5f5;border:1px solid #333;border-radius:4px;flex-wrap:wrap;"
    >
      <strong style="font-size:12px;">Draw Color</strong>
      <div style="display:flex;align-items:center;gap:4px;">
        <button id="draw-tool-brush" type="button" style="padding:2px 8px;border:1px solid #333;background:${currentTool === "brush" ? "#cfead2" : "#fff"};cursor:pointer;">Brush</button>
        <button id="draw-tool-eraser" type="button" style="padding:2px 8px;border:1px solid #333;background:${currentTool === "eraser" ? "#cfead2" : "#fff"};cursor:pointer;">Eraser</button>
        <button id="draw-tool-fill" type="button" style="padding:2px 8px;border:1px solid #333;background:${currentTool === "fill" ? "#cfead2" : "#fff"};cursor:pointer;">Fill Bucket</button>
        <button id="draw-tool-eyedropper" type="button" style="padding:2px 8px;border:1px solid #333;background:${currentTool === "eyedropper" ? "#cfead2" : "#fff"};cursor:pointer;">Eyedropper</button>
        <button id="draw-tool-line" type="button" style="padding:2px 8px;border:1px solid #333;background:${currentTool === "line" ? "#cfead2" : "#fff"};cursor:pointer;">Line</button>
        <button id="draw-tool-rectangle" type="button" style="padding:2px 8px;border:1px solid #333;background:${currentTool === "rectangle" ? "#cfead2" : "#fff"};cursor:pointer;">Rectangle</button>
        <button id="draw-tool-circle" type="button" style="padding:2px 8px;border:1px solid #333;background:${currentTool === "circle" ? "#cfead2" : "#fff"};cursor:pointer;">Circle</button>
      </div>
      <input id="draw-color-input" type="color" value="${currentColor}" style="cursor:pointer;" />
      <span id="draw-color-hex" style="font-family:monospace;font-size:12px;min-width:70px;">${currentColor}</span>
      <span id="draw-color-preview" style="width:18px;height:18px;border:1px solid #333;border-radius:2px;background:${currentColor};"></span>
      <label for="draw-alpha-input" style="font-size:12px;">Transparency</label>
      <input id="draw-alpha-input" type="range" min="0" max="100" step="1" value="${currentAlpha}" style="cursor:pointer;" />
      <span id="draw-alpha-value" style="font-family:monospace;font-size:12px;min-width:42px;">${currentAlpha}%</span>
      <label for="draw-brush-size-input" style="font-size:12px;">Brush Width</label>
      <input id="draw-brush-size-input" type="range" min="1" max="64" step="1" value="${currentBrushSize}" style="cursor:pointer;" />
      <span id="draw-brush-size-value" style="font-family:monospace;font-size:12px;min-width:42px;">${currentBrushSize}px</span>
    </div>
  `;

  subToolbar.style.display = "flex";

  const colorInput = subToolbar.querySelector("#draw-color-input");
  const colorHex = subToolbar.querySelector("#draw-color-hex");
  const preview = subToolbar.querySelector("#draw-color-preview");
  const alphaInput = subToolbar.querySelector("#draw-alpha-input");
  const alphaValue = subToolbar.querySelector("#draw-alpha-value");
  const brushSizeInput = subToolbar.querySelector("#draw-brush-size-input");
  const brushSizeValue = subToolbar.querySelector("#draw-brush-size-value");
  const brushBtn = subToolbar.querySelector("#draw-tool-brush");
  const eraserBtn = subToolbar.querySelector("#draw-tool-eraser");
  const fillBtn = subToolbar.querySelector("#draw-tool-fill");
  const eyedropperBtn = subToolbar.querySelector("#draw-tool-eyedropper");
  const lineBtn = subToolbar.querySelector("#draw-tool-line");
  const rectangleBtn = subToolbar.querySelector("#draw-tool-rectangle");
  const circleBtn = subToolbar.querySelector("#draw-tool-circle");
  if (!colorInput || !colorHex || !preview || !alphaInput || !alphaValue || !brushSizeInput || !brushSizeValue || !brushBtn || !eraserBtn || !fillBtn || !eyedropperBtn || !lineBtn || !rectangleBtn || !circleBtn) return;

  const updateColor = (color) => {
    window.NodevisionState.drawColor = color;
    if (window.rasterEditor) window.rasterEditor.brushColor = color;
    colorHex.textContent = color;
    preview.style.backgroundColor = color;
  };

  const setTool = (tool) => {
    const normalizedTool = ["brush", "eraser", "fill", "eyedropper", "line", "rectangle", "circle"].includes(tool) ? tool : "brush";
    window.NodevisionState.drawTool = normalizedTool;
    brushBtn.style.background = normalizedTool === "brush" ? "#cfead2" : "#fff";
    eraserBtn.style.background = normalizedTool === "eraser" ? "#cfead2" : "#fff";
    fillBtn.style.background = normalizedTool === "fill" ? "#cfead2" : "#fff";
    eyedropperBtn.style.background = normalizedTool === "eyedropper" ? "#cfead2" : "#fff";
    lineBtn.style.background = normalizedTool === "line" ? "#cfead2" : "#fff";
    rectangleBtn.style.background = normalizedTool === "rectangle" ? "#cfead2" : "#fff";
    circleBtn.style.background = normalizedTool === "circle" ? "#cfead2" : "#fff";
    if (window.rasterCanvas) {
      window.rasterCanvas.style.cursor = normalizedTool === "fill" ? "cell" : normalizedTool === "eyedropper" ? "copy" : "crosshair";
    }
  };

  const updateAlpha = (alpha) => {
    const numericAlpha = Math.max(0, Math.min(100, Number(alpha) || 0));
    window.NodevisionState.drawAlpha = numericAlpha;
    alphaValue.textContent = `${numericAlpha}%`;
  };

  const updateBrushSize = (size) => {
    const numericSize = Math.max(1, Math.floor(Number(size) || 1));
    window.NodevisionState.drawBrushSize = numericSize;
    brushSizeValue.textContent = `${numericSize}px`;
  };

  updateColor(colorInput.value);
  setTool(currentTool);
  updateAlpha(alphaInput.value);
  updateBrushSize(brushSizeInput.value);

  colorInput.addEventListener("input", (e) => updateColor(e.target.value));
  alphaInput.addEventListener("input", (e) => updateAlpha(e.target.value));
  brushSizeInput.addEventListener("input", (e) => updateBrushSize(e.target.value));
  brushBtn.addEventListener("click", () => setTool("brush"));
  eraserBtn.addEventListener("click", () => setTool("eraser"));
  fillBtn.addEventListener("click", () => setTool("fill"));
  eyedropperBtn.addEventListener("click", () => setTool("eyedropper"));
  lineBtn.addEventListener("click", () => setTool("line"));
  rectangleBtn.addEventListener("click", () => setTool("rectangle"));
  circleBtn.addEventListener("click", () => setTool("circle"));
}

export default PickColor;
