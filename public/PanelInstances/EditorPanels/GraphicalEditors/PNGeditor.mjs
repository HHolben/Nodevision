// Nodevision/public/PanelInstances/EditorPanels/GraphicalEditors/PNGeditor.mjs

export async function renderEditor(filePath, container) {
  if (!container) throw new Error("Container required");
  container.innerHTML = "";

  // --- PIXEL ART CONSTANTS (Unchanged) ---
  const LOGICAL_WIDTH = 32;
  const LOGICAL_HEIGHT = 32;
  let PIXEL_SIZE = 1;

  // Root wrapper (Unchanged)
  const wrapper = document.createElement("div");
  wrapper.id = "pixel-editor-root";
  wrapper.style.display = "flex";
  wrapper.style.flexDirection = "column";
  wrapper.style.height = "100%";
  wrapper.style.width = "100%";
  wrapper.style.overflow = "hidden";
  container.appendChild(wrapper);

  // --- Toolbar ---
  const toolbar = document.createElement("div");
  toolbar.style.display = "flex";
  toolbar.style.gap = "8px";
  toolbar.style.padding = "6px";
  toolbar.style.alignItems = "center";
  toolbar.style.flex = "0 0 auto";
  wrapper.appendChild(toolbar);

  // Color picker (Unchanged)
  const colorInput = document.createElement("input");
  colorInput.type = "color";
  colorInput.value = "#000000";
  colorInput.title = "Brush color";
  toolbar.appendChild(colorInput);

  // Alpha slider (0–100)
const alphaInput = document.createElement("input");
alphaInput.type = "range";
alphaInput.min = 0;
alphaInput.max = 100;
alphaInput.value = 100; // fully opaque by default
alphaInput.title = "Transparency";
alphaInput.style.width = "90px";
toolbar.appendChild(alphaInput);

// Display % next to slider
const alphaLabel = document.createElement("span");
alphaLabel.textContent = "100%";
alphaLabel.style.minWidth = "40px";
toolbar.appendChild(alphaLabel);

alphaInput.addEventListener("input", () => {
  alphaLabel.textContent = alphaInput.value + "%";
});


  // PIXEL SIZE INPUT (Unchanged)
  const pixelSizeInput = document.createElement("input");
  pixelSizeInput.type = "number";
  pixelSizeInput.min = 1;
  pixelSizeInput.max = 16; 
  pixelSizeInput.value = PIXEL_SIZE;
  pixelSizeInput.style.width = "70px";
  pixelSizeInput.title = "Brush size (logical pixels)";
  pixelSizeInput.addEventListener("change", () => {
    const val = parseInt(pixelSizeInput.value);
    PIXEL_SIZE = (val >= 1 && val <= 16) ? val : 1;
    pixelSizeInput.value = PIXEL_SIZE;
  });
  toolbar.appendChild(pixelSizeInput);

  // Undo/Redo/Clear (Unchanged)
  const undoBtn = document.createElement("button");
  undoBtn.textContent = "Undo";
  toolbar.appendChild(undoBtn);

  const redoBtn = document.createElement("button");
  redoBtn.textContent = "Redo";
  toolbar.appendChild(redoBtn);

  const clearBtn = document.createElement("button");
  clearBtn.textContent = "Clear";
  toolbar.appendChild(clearBtn);

  // ⚠️ REMOVED LOCAL SAVE BUTTON: The saving will now rely only on the global SaveFile.mjs

  // Message element (Now only for status, not for local save messages)
  const msg = document.createElement("span");
  msg.style.marginLeft = "8px";
  msg.style.fontSize = "0.9em";
  toolbar.appendChild(msg);

  // --- Canvas setup (Unchanged) ---
  const canvasWrapper = document.createElement("div");
  canvasWrapper.style.flex = "1 1 auto";
  canvasWrapper.style.position = "relative";
  canvasWrapper.style.width = "100%";
  canvasWrapper.style.height = "100%";
  canvasWrapper.style.display = "flex";
  canvasWrapper.style.justifyContent = "center";
  canvasWrapper.style.alignItems = "center";
  wrapper.appendChild(canvasWrapper);

  const canvas = document.createElement("canvas");

  canvas.style.background = `
  repeating-conic-gradient(#ccc 0% 25%, #eee 0% 50%)
  50% / 20px 20px
`;


  canvas.style.maxWidth = "100%";
  canvas.style.maxHeight = "100%";
  canvas.style.imageRendering = "pixelated";
  canvas.style.userSelect = "none";
  canvas.style.touchAction = "none";
  canvas.style.cursor = "crosshair";
  canvasWrapper.appendChild(canvas);

  const ctx = canvas.getContext("2d", { alpha: true });
  ctx.imageSmoothingEnabled = false;

  // --- Buffer & Undo/Redo Logic (Unchanged) ---
  function makeBuffer(w, h) {
    const off = document.createElement("canvas");
    off.width = w;
    off.height = h;
    off.getContext("2d").imageSmoothingEnabled = false;
    return off;
  }

  const undoStack = [];
  const redoStack = [];
  const UNDO_LIMIT = 30;

  function pushUndo() {
    try {
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      undoStack.push(imgData);
      if (undoStack.length > UNDO_LIMIT) undoStack.shift();
      redoStack.length = 0;
      updateUndoRedoButtons();
    } catch (err) {
      console.warn("pushUndo failed:", err);
    }
  }

  function doUndo() {
    if (!undoStack.length) return;
    try {
      const last = undoStack.pop();
      const current = ctx.getImageData(0, 0, canvas.width, canvas.height);
      redoStack.push(current);
      ctx.putImageData(last, 0, 0);
      updateUndoRedoButtons();
    } catch (err) {
      console.warn("undo failed:", err);
    }
  }

  function doRedo() {
    if (!redoStack.length) return;
    try {
      const next = redoStack.pop();
      const current = ctx.getImageData(0, 0, canvas.width, canvas.height);
      undoStack.push(current);
      ctx.putImageData(next, 0, 0);
      updateUndoRedoButtons();
    } catch (err) {
      console.warn("redo failed:", err);
    }
  }

  function updateUndoRedoButtons() {
    undoBtn.disabled = undoStack.length === 0;
    redoBtn.disabled = redoStack.length === 0;
  }

  // --- PIXEL ART RESIZE LOGIC (Unchanged) ---
  function resizeCanvasToWrapper() {
    canvas.width = LOGICAL_WIDTH;
    canvas.height = LOGICAL_HEIGHT;

    // Make initial canvas fully transparent
ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);


    const cw = Math.max(1, Math.floor(canvasWrapper.clientWidth));
    const ch = Math.max(1, Math.floor(canvasWrapper.clientHeight));

    const scaleFactor = Math.floor(Math.min(cw / LOGICAL_WIDTH, ch / LOGICAL_HEIGHT));
    const displaySize = Math.max(1, scaleFactor);

    canvas.style.width = `${LOGICAL_WIDTH * displaySize}px`;
    canvas.style.height = `${LOGICAL_HEIGHT * displaySize}px`;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    updateUndoRedoButtons();
  }

  let resizeObserver = new ResizeObserver(() => {
    resizeCanvasToWrapper();
  });
  resizeObserver.observe(canvasWrapper);
  resizeCanvasToWrapper();

  // --- PIXEL DRAWING LOGIC (Unchanged) ---
  let drawing = false;

  function getEventLogicalPos(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    const xRatio = (clientX - rect.left) / rect.width;
    const yRatio = (clientY - rect.top) / rect.height;

    const logicalX = Math.floor(xRatio * LOGICAL_WIDTH);
    const logicalY = Math.floor(yRatio * LOGICAL_HEIGHT);

    return { x: logicalX, y: logicalY };
  }

  

  function drawPixel(pos) {
function hexToRGBA(hex, alphaPct) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const a = alphaPct / 100;
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

function drawPixel(pos) {
  ctx.fillStyle = hexToRGBA(colorInput.value, alphaInput.value);
  ctx.fillRect(pos.x, pos.y, PIXEL_SIZE, PIXEL_SIZE);
}
    ctx.fillRect(pos.x, pos.y, PIXEL_SIZE, PIXEL_SIZE);
  }

  let lastLogicalPos = null;

  function beginStroke(e) {
    pushUndo();
    drawing = true;
    lastLogicalPos = getEventLogicalPos(e);
    drawPixel(lastLogicalPos);
    if (e.cancelable) e.preventDefault();
  }

  function continueStroke(e) {
    if (!drawing) return;
    const pos = getEventLogicalPos(e);

    if (pos.x !== lastLogicalPos.x || pos.y !== lastLogicalPos.y) {
      const dx = Math.abs(pos.x - lastLogicalPos.x);
      const dy = Math.abs(pos.y - lastLogicalPos.y);
      const sx = (lastLogicalPos.x < pos.x) ? 1 : -1;
      const sy = (lastLogicalPos.y < pos.y) ? 1 : -1;
      let err = dx - dy;

      let x = lastLogicalPos.x;
      let y = lastLogicalPos.y;

      while (x !== pos.x || y !== pos.y) {
          drawPixel({ x: x, y: y });
          const e2 = 2 * err;
          if (e2 > -dy) { err -= dy; x += sx; }
          if (e2 < dx) { err += dx; y += sy; }
      }

      drawPixel(pos);
      lastLogicalPos = pos;
    }

    if (e.cancelable) e.preventDefault();
  }

  function endStroke() {
    if (!drawing) return;
    drawing = false;
    lastLogicalPos = null;
    updateUndoRedoButtons();
  }

  canvas.addEventListener("mousedown", (e) => { if (e.button === 0) beginStroke(e); });
  window.addEventListener("mousemove", continueStroke);
  window.addEventListener("mouseup", endStroke);

  canvas.addEventListener("touchstart", beginStroke, { passive: false });
  canvas.addEventListener("touchmove", continueStroke, { passive: false });
  canvas.addEventListener("touchend", endStroke);

  // Keyboard shortcuts (Unchanged)
  function onKeyDown(e) {
    const isMac = navigator.platform.toUpperCase().includes("MAC");
    const meta = isMac ? e.metaKey : e.ctrlKey;
    if (meta && !e.shiftKey && e.key.toLowerCase() === "z") {
      e.preventDefault();
      doUndo();
    } else if ((meta && e.shiftKey && e.key.toLowerCase() === "z") || (meta && !isMac && e.key.toLowerCase() === "y")) {
      e.preventDefault();
      doRedo();
    }
  }
  window.addEventListener("keydown", onKeyDown);

  undoBtn.addEventListener("click", doUndo);
  redoBtn.addEventListener("click", doRedo);
  clearBtn.addEventListener("click", () => {
    pushUndo();
    ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    updateUndoRedoButtons();
  });

  // --- GLOBAL INTEGRATION (THE FIX) ---
  
  // 1. Expose the canvas instance for SaveFile.mjs to find
  window.rasterCanvas = canvas;

  // 2. We no longer need an internalSave function since the global saveFile() handles it.
  
  // 3. Cleanup function
  window.destroyPngEditor = function() {
    // ... cleanup logic (omitted for brevity, but keep it)
    try { resizeObserver.disconnect(); } catch (e) {}
    try { canvas.remove(); } catch (e) {}
    try { 
      // Important: nullify this so SaveFile doesn't try to save a dead canvas
      if (window.rasterCanvas === canvas) window.rasterCanvas = null; 
    } catch (e) {}
    try { delete window.destroyPngEditor; } catch (e) {}
    try { window.removeEventListener("keydown", onKeyDown); } catch (e) {}
    try { window.removeEventListener("mousemove", continueStroke); } catch (e) {}
    try { window.removeEventListener("mouseup", endStroke); } catch (e) {}
  };

  // --- Image Loading (Unchanged) ---
  if (filePath) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = `/Notebook/${filePath}`;
    img.onload = () => {
      ctx.drawImage(img, 0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
      pushUndo();
    };
    img.onerror = (err) => {
      console.warn("Image load failed:", err);
    };
  } else {
    ctx.clearRect(0, 0, LOGICAL_WIDTH, LOGICAL_HEIGHT);
    pushUndo();
  }

  return {
    canvas,
    ctx,
    // Removed save from return
    destroy: window.destroyPngEditor
  };
}

export default renderEditor;