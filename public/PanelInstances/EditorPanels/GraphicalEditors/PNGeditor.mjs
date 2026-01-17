// Nodevision/public/PanelInstances/EditorPanels/GraphicalEditors/PNGeditor.mjs
//This file is used to create an editor panel for PNG files.
import { History } from './PNGeditorComponents/history.mjs';
import { bresenhamLine, hexToRGBA } from './PNGeditorComponents/canvasEngine.mjs';
import { updateToolbarState } from "./../../../panels/createToolbar.mjs";


export async function renderEditor(filePath, container) {
  if (!container) throw new Error("Container required");
  container.innerHTML = "";

  const state = {
    logicalWidth: 32,
    logicalHeight: 32,
    pixelSize: 1,
    drawing: false,
    lastPos: null
  };


  //0.set current Mode
    window.NodevisionState.currentMode = "PNGediting";
  updateToolbarState({ currentMode: "PNGediting" });


  // 1. UI Build (Wrapper & Canvas)
  const wrapper = document.createElement("div");
  wrapper.style.cssText = "display:flex; flex-direction:column; height:100%; width:100%; overflow:hidden;";
  
  const canvas = document.createElement("canvas");
  canvas.width = state.logicalWidth;
  canvas.height = state.logicalHeight;
  canvas.style.cssText = "image-rendering:pixelated; cursor:crosshair; background:repeating-conic-gradient(#ccc 0% 25%, #eee 0% 50%) 50% / 20px 20px;";
  
  const ctx = canvas.getContext("2d", { alpha: true });
  const history = new History(ctx);


  // 2. Setup Toolbar (Briefly showing logic)
  const toolbar = document.createElement("div");
  const colorInput = document.createElement("input"); colorInput.type = "color";
  const alphaInput = document.createElement("input"); alphaInput.type = "range"; alphaInput.value = 100;
  
  [colorInput, alphaInput, canvas].forEach(el => wrapper.appendChild(el));
  container.appendChild(wrapper);

  // 3. Drawing Logic
  const getPos = (e) => {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: Math.floor(((clientX - rect.left) / rect.width) * state.logicalWidth),
      y: Math.floor(((clientY - rect.top) / rect.height) * state.logicalHeight)
    };
  };

  const draw = (x, y) => {
    ctx.fillStyle = hexToRGBA(colorInput.value, alphaInput.value);
    ctx.fillRect(x, y, state.pixelSize, state.pixelSize);
  };

  const onMove = (e) => {
    if (!state.drawing) return;
    const pos = getPos(e);
    if (state.lastPos) {
      bresenhamLine(state.lastPos.x, state.lastPos.y, pos.x, pos.y, draw);
    }
    state.lastPos = pos;
  };

  // Event Listeners
  canvas.addEventListener("mousedown", (e) => {
    history.push(canvas);
    state.drawing = true;
    state.lastPos = getPos(e);
    draw(state.lastPos.x, state.lastPos.y);
  });

  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", () => state.drawing = false);

  // Global Integration
  window.rasterCanvas = canvas;

  return {
    destroy: () => {
      window.removeEventListener("mousemove", onMove);
      window.rasterCanvas = null;
    }
  };
}