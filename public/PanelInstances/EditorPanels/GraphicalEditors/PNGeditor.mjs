// Nodevision/public/PanelInstances/EditorPanels/GraphicalEditors/PNGeditor.mjs

export async function renderEditor(filePath, container) {
  if (!container) throw new Error("Container required");
  container.innerHTML = "";

  // Root wrapper
  const wrapper = document.createElement("div");
  wrapper.id = "png-editor-root";
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

  // Color picker
  const colorInput = document.createElement("input");
  colorInput.type = "color";
  colorInput.value = "#000000";
  colorInput.title = "Brush color";
  toolbar.appendChild(colorInput);

  // Brush size
  const brushInput = document.createElement("input");
  brushInput.type = "number";
  brushInput.min = 1;
  brushInput.max = 200;
  brushInput.value = 5;
  brushInput.style.width = "70px";
  brushInput.title = "Brush size (px)";
  toolbar.appendChild(brushInput);

  // Undo/Redo/Clear
  const undoBtn = document.createElement("button");
  undoBtn.textContent = "Undo";
  toolbar.appendChild(undoBtn);

  const redoBtn = document.createElement("button");
  redoBtn.textContent = "Redo";
  toolbar.appendChild(redoBtn);

  const clearBtn = document.createElement("button");
  clearBtn.textContent = "Clear";
  toolbar.appendChild(clearBtn);

  // Local Save Button
  const saveBtn = document.createElement("button");
  saveBtn.textContent = "Save PNG";
  toolbar.appendChild(saveBtn);

  // Message element
  const msg = document.createElement("span");
  msg.style.marginLeft = "8px";
  msg.style.fontSize = "0.9em";
  toolbar.appendChild(msg);

  // --- Canvas wrapper & canvas ---
  const canvasWrapper = document.createElement("div");
  canvasWrapper.style.flex = "1 1 auto";
  canvasWrapper.style.position = "relative";
  canvasWrapper.style.width = "100%";
  canvasWrapper.style.height = "100%";
  wrapper.appendChild(canvasWrapper);

  const canvas = document.createElement("canvas");
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.display = "block";
  canvas.style.userSelect = "none";
  canvas.style.touchAction = "none";
  canvas.style.cursor = "crosshair"; // UX improvement
  canvasWrapper.appendChild(canvas);

  const ctx = canvas.getContext("2d", { alpha: true });

  // --- Buffer & Resize Logic (Unchanged) ---
  function makeBuffer(w, h) {
    const off = document.createElement("canvas");
    off.width = w;
    off.height = h;
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

  let DPR = window.devicePixelRatio || 1;

// --- FIXED RESIZE LOGIC ---
  function resizeCanvasToWrapper() {
    // 1. Snapshot the current physical pixels
    // We create a buffer exactly the size of the current physical canvas
    const prevW = canvas.width;
    const prevH = canvas.height;
    
    // If the canvas has 0 size (first run), don't try to snapshot
    let prev = null;
    if (prevW > 0 && prevH > 0) {
      prev = makeBuffer(prevW, prevH);
      prev.getContext("2d").drawImage(canvas, 0, 0);
    }

    // 2. Calculate new dimensions
    const cw = Math.max(1, Math.floor(canvasWrapper.clientWidth));
    const ch = Math.max(1, Math.floor(canvasWrapper.clientHeight));
    const newWidth = Math.floor(cw * DPR);
    const newHeight = Math.floor(ch * DPR);

    // 3. Resize the canvas (this clears the context)
    canvas.width = newWidth;
    canvas.height = newHeight;

    // 4. RESTORE CONTENT
    // Crucial: We reset the transform to Identity (1:1) to copy pixels exactly
    // This prevents the "disappearing content" bug caused by double-scaling
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    if (prev) {
      // Draw the previous image into the new canvas.
      // We draw it at 0,0 with its original physical dimensions.
      // If the new window is smaller, it crops. If larger, it leaves whitespace.
      ctx.drawImage(prev, 0, 0);
    }

    // 5. Re-apply High DPI Scaling for FUTURE strokes
    // Now that the old pixels are safe, we set the scale for the user's mouse/brush
    ctx.scale(DPR, DPR);

    updateUndoRedoButtons();
  }

  // --- FIXED SAVE LOGIC (With Debugging) ---
  async function internalSave() {
    if (!filePath) {
      msg.textContent = "No file path!";
      msg.style.color = "red";
      return;
    }
    
    msg.textContent = "Saving...";

    try {
      // DEBUG: Check if canvas is actually empty
      const pixelCheck = ctx.getImageData(0, 0, 1, 1).data; // Check top left pixel
      console.log(`Saving Canvas. Dimensions: ${canvas.width}x${canvas.height} (DPR: ${DPR})`);

      const dataURL = canvas.toDataURL("image/png");
      const base64Content = dataURL.replace(/^data:image\/png;base64,/, "");
      
      console.log(`Payload size: ${base64Content.length} chars`);

      const res = await fetch("/api/files/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: filePath,
          content: base64Content,
          encoding: "base64",
          mimeType: "image/png"
        })
      });

      if (!res.ok) throw new Error(`Server error: ${res.status}`);

      const data = await res.json();
      if (data.success || data.path) {
        msg.textContent = "Saved!";
        msg.style.color = "green";
        setTimeout(() => { if (msg.textContent === "Saved!") msg.textContent = ""; }, 2000);
      } else {
        throw new Error(data.error || "Save failed");
      }
    } catch (err) {
      console.error("Internal PNG Save Error:", err);
      msg.textContent = "Error saving";
      msg.style.color = "red";
    }
  }

  let resizeObserver = new ResizeObserver(() => {
    DPR = window.devicePixelRatio || 1;
    resizeCanvasToWrapper();
  });
  resizeObserver.observe(canvasWrapper);
  resizeCanvasToWrapper();

  // --- Drawing Logic (Unchanged) ---
  let drawing = false;

  function getEventPos(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width) / DPR,
      y: (clientY - rect.top) * (canvas.height / rect.height) / DPR
    };
  }

  function beginStroke(e) {
    pushUndo();
    drawing = true;
    const pos = getEventPos(e);
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = colorInput.value;
    ctx.lineWidth = parseFloat(brushInput.value) || 1;
    if (e.cancelable) e.preventDefault();
  }

  function continueStroke(e) {
    if (!drawing) return;
    const pos = getEventPos(e);
    ctx.strokeStyle = colorInput.value;
    ctx.lineWidth = parseFloat(brushInput.value) || 1;
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    if (e.cancelable) e.preventDefault();
  }

  function endStroke() {
    if (!drawing) return;
    drawing = false;
    ctx.closePath();
    updateUndoRedoButtons();
  }

  canvas.addEventListener("mousedown", (e) => { if (e.button === 0) beginStroke(e); });
  window.addEventListener("mousemove", continueStroke);
  window.addEventListener("mouseup", endStroke);

  canvas.addEventListener("touchstart", beginStroke, { passive: false });
  canvas.addEventListener("touchmove", continueStroke, { passive: false });
  canvas.addEventListener("touchend", endStroke);

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
    ctx.clearRect(0, 0, canvas.width / DPR, canvas.height / DPR);
    updateUndoRedoButtons();
  });

  // --- SAVE LOGIC ---

  /**
   * Internal Save function for the LOCAL toolbar button.
   * Mirrors the logic found in global SaveFile.mjs to ensure consistency.
   */
  async function internalSave() {
    if (!filePath) {
      msg.textContent = "No file path!";
      msg.style.color = "red";
      return;
    }
    
    msg.textContent = "Saving...";

    try {
      const dataURL = canvas.toDataURL("image/png");
      const base64Content = dataURL.replace(/^data:image\/png;base64,/, "");

      // NOTE: Using /api/files/save to match SaveFile.mjs logic
      const res = await fetch("/api/files/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          path: filePath,
          content: base64Content,
          encoding: "base64",
          mimeType: "image/png"
        })
      });

      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }

      const data = await res.json();
      if (data.success || data.path) {
        msg.textContent = "Saved!";
        msg.style.color = "green";
        setTimeout(() => { if (msg.textContent === "Saved!") msg.textContent = ""; }, 2000);
      } else {
        throw new Error(data.error || "Save failed");
      }
    } catch (err) {
      console.error("Internal PNG Save Error:", err);
      msg.textContent = "Error saving";
      msg.style.color = "red";
    }
  }

  // Hook up the local button
  saveBtn.addEventListener("click", internalSave);

  // --- GLOBAL INTEGRATION ---
  
  // 1. Expose the canvas instance so SaveFile.mjs can find it
  // (See SaveFile.mjs Section 3: if (window.rasterCanvas instanceof HTMLCanvasElement))
  window.rasterCanvas = canvas;

  // 2. Cleanup function
  window.destroyPngEditor = function() {
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

  // --- Image Loading ---
  if (filePath) {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = `/Notebook/${filePath}`;
    img.onload = () => {
      const cssW = canvasWrapper.clientWidth;
      const cssH = canvasWrapper.clientHeight;
      if (!cssW || !cssH) {
        ctx.drawImage(img, 0, 0);
        return;
      }
      const scale = Math.min(cssW / img.width, cssH / img.height, 1);
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      const offsetX = (cssW - drawW) / 2;
      const offsetY = (cssH - drawH) / 2;

      ctx.clearRect(0, 0, canvas.width / DPR, canvas.height / DPR);
      ctx.drawImage(img, 0, 0, img.width, img.height, offsetX, offsetY, drawW, drawH);
      pushUndo();
    };
    img.onerror = (err) => {
      console.warn("Image load failed:", err);
    };
  } else {
    pushUndo();
  }

  return {
    canvas,
    ctx,
    save: internalSave,
    destroy: window.destroyPngEditor
  };
}

export default renderEditor;