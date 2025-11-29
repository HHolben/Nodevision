// Nodevision/public/PanelInstances/EditorPanels/GraphicalEditors/PNGeditor.mjs
// Purpose: Paint-like PNG editor (improved)
// Features:
// - crisp rendering using devicePixelRatio
// - proper resize preserving content (backing buffer)
// - aspect-preserving image load
// - accurate coordinate transforms for CSS scaling / HiDPI
// - mouse + touch support
// - undo / redo stack
// - clear, save, color & brush UI
// - registers window.rasterCanvas and window.saveRasterImage for global SaveFile()
// - exposes window.destroyPngEditor() to clean up when switching editors

export async function renderEditor(filePath, container) {
  if (!container) throw new Error("Container required");
  // Clean container
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

  // Undo
  const undoBtn = document.createElement("button");
  undoBtn.textContent = "Undo";
  toolbar.appendChild(undoBtn);

  // Redo
  const redoBtn = document.createElement("button");
  redoBtn.textContent = "Redo";
  toolbar.appendChild(redoBtn);

  // Clear
  const clearBtn = document.createElement("button");
  clearBtn.textContent = "Clear";
  toolbar.appendChild(clearBtn);

  // Save button (local affordance; SaveFile toolbar will call global hook)
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

  // Canvas element (styled via CSS size; actual pixel buffer controlled in JS)
  const canvas = document.createElement("canvas");
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  canvas.style.display = "block";
  canvas.style.userSelect = "none";
  canvas.style.touchAction = "none"; // important for proper touch drawing
  canvasWrapper.appendChild(canvas);

  const ctx = canvas.getContext("2d", { alpha: true });

  // Backing buffer for preserving content across resizes
  function makeBuffer(w, h) {
    const off = document.createElement("canvas");
    off.width = w;
    off.height = h;
    return off;
  }

  // Undo/redo stacks (store ImageData objects)
  const undoStack = [];
  const redoStack = [];
  const UNDO_LIMIT = 30;

  function pushUndo() {
    try {
      // capture current pixel buffer
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      undoStack.push(imgData);
      if (undoStack.length > UNDO_LIMIT) undoStack.shift();
      // clear redo when new action
      redoStack.length = 0;
      updateUndoRedoButtons();
    } catch (err) {
      // Security or other errors shouldn't break editor
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

  // Device pixel ratio handling for crisp lines
  let DPR = window.devicePixelRatio || 1;

  function resizeCanvasToWrapper() {
    // Save current contents to an offscreen buffer (physical pixels)
    const prev = makeBuffer(canvas.width || 1, canvas.height || 1);
    const prevCtx = prev.getContext("2d");
    // If canvas had a pixel buffer, copy it
    try {
      if (canvas.width && canvas.height) prevCtx.drawImage(canvas, 0, 0);
    } catch (err) {
      // ignore
    }

    // Compute new logical pixel dimensions based on wrapper client size and DPR
    const cw = Math.max(1, Math.floor(canvasWrapper.clientWidth));
    const ch = Math.max(1, Math.floor(canvasWrapper.clientHeight));
    const newWidth = Math.floor(cw * DPR);
    const newHeight = Math.floor(ch * DPR);

    // Resize actual canvas pixel buffer
    canvas.width = newWidth;
    canvas.height = newHeight;

    // Keep display size via CSS (already set to 100%)
    // Scale ctx so 1 canvas pixel == 1/DPR CSS pixel
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0); // scale drawing operations by DPR

    // Redraw previous buffer into resized canvas and scale appropriately
    try {
      // draw prev (which is in previous pixel buffer size) into current
      ctx.clearRect(0, 0, canvas.width / DPR, canvas.height / DPR);
      ctx.drawImage(prev, 0, 0, prev.width / DPR, prev.height / DPR, 0, 0, cw, ch);
    } catch (err) {
      // fallback: clear to white/transparent
      ctx.clearRect(0, 0, canvas.width / DPR, canvas.height / DPR);
    }

    updateUndoRedoButtons();
  }

  // Observe size changes (better than window resize only)
  let resizeObserver = new ResizeObserver(() => {
    // recompute DPR in case of monitor move
    DPR = window.devicePixelRatio || 1;
    resizeCanvasToWrapper();
  });
  resizeObserver.observe(canvasWrapper);

  // Initial resize
  resizeCanvasToWrapper();

  // --- Drawing state & helpers ---
  let drawing = false;
  let lastPos = { x: 0, y: 0 };

  function getEventPos(e) {
    // support mouse and touch events; always return coordinates in CSS pixels
    const rect = canvas.getBoundingClientRect();

    if (e.touches && e.touches.length) {
      const t = e.touches[0];
      return {
        x: (t.clientX - rect.left) * (canvas.width / rect.width) / DPR,
        y: (t.clientY - rect.top) * (canvas.height / rect.height) / DPR
      };
    } else {
      return {
        x: (e.clientX - rect.left) * (canvas.width / rect.width) / DPR,
        y: (e.clientY - rect.top) * (canvas.height / rect.height) / DPR
      };
    }
  }

  function beginStroke(e) {
    // push snapshot for undo before mutating
    pushUndo();

    drawing = true;
    const pos = getEventPos(e);
    lastPos = pos;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    // set stroke style
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = colorInput.value;
    ctx.lineWidth = parseFloat(brushInput.value) || 1;
    // prevent scrolling on touch devices
    if (e.cancelable) e.preventDefault();
  }

  function continueStroke(e) {
    if (!drawing) return;
    const pos = getEventPos(e);
    // update stroke style in case UI changed mid-stroke
    ctx.strokeStyle = colorInput.value;
    ctx.lineWidth = parseFloat(brushInput.value) || 1;
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPos = pos;
    if (e.cancelable) e.preventDefault();
  }

  function endStroke() {
    if (!drawing) return;
    drawing = false;
    ctx.closePath();
    updateUndoRedoButtons();
  }

  // Mouse events
  canvas.addEventListener("mousedown", (e) => {
    if (e.button !== 0) return; // only left click
    beginStroke(e);
  });
  window.addEventListener("mousemove", continueStroke);
  window.addEventListener("mouseup", endStroke);

  // Touch events
  canvas.addEventListener("touchstart", (e) => beginStroke(e), { passive: false });
  canvas.addEventListener("touchmove", (e) => continueStroke(e), { passive: false });
  canvas.addEventListener("touchend", (e) => {
    // touchend has no touches; finish stroke
    endStroke();
  });

  // Keyboard shortcuts for undo/redo (Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z)
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

  // Button handlers
  undoBtn.addEventListener("click", doUndo);
  redoBtn.addEventListener("click", doRedo);

  clearBtn.addEventListener("click", () => {
    pushUndo();
    ctx.clearRect(0, 0, canvas.width / DPR, canvas.height / DPR);
    updateUndoRedoButtons();
  });

  saveBtn.addEventListener("click", async () => {
    // If filePath undefined, show message
    if (!filePath) {
      msg.textContent = "No file path selected";
      msg.style.color = "red";
      return;
    }
    await internalSave(filePath);
  });

  // Expose a programmatic save hook used by global SaveFile()
async function internalSave() {
  if (!filePath) {
    console.error("Cannot save PNG: missing filePath");
    return;
  }

  try {
    const dataURL = canvas.toDataURL("image/png");
    const base64 = dataURL.replace(/^data:image\/png;base64,/, "");

fetch("/api/save", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    path: "TestImages/test_save.png",
    content: base64Data,
    encoding: "base64",
    mimeType: "image/png"
  })
})
.then(res => res.json())
.then(data => console.log("Server response:", data))
.catch(err => console.error("Error sending PNG:", err));


    const data = await res.json();
    if (data.success) {
      msg.textContent = "Saved!";
      msg.style.color = "green";
      console.log("PNG saved:", filePath);
    } else {
      console.error("Save failed:", data.error);
      msg.textContent = "Save failed!";
      msg.style.color = "red";
    }
  } catch (err) {
    console.error("Save error:", err);
    msg.textContent = "Save failed!";
    msg.style.color = "red";
  }
}


  // Register global hooks expected by saveFile.mjs
  // rasterCanvas is a reference to the drawing canvas element
  // saveRasterImage(path) is called by the global SaveFile handler
  window.rasterCanvas = canvas;
  window.saveRasterImage = async function(path) {
    await internalSave(path);
  };

  // Provide a cleanup function to remove globals and listeners when editor is destroyed
  window.destroyPngEditor = function() {
    try {
      resizeObserver.disconnect();
    } catch (e) {}
    try {
      canvas.remove();
    } catch (e) {}
    try {
      delete window.rasterCanvas;
    } catch (e) {}
    try {
      delete window.saveRasterImage;
    } catch (e) {}
    try {
      delete window.destroyPngEditor;
    } catch (e) {}
    try {
      window.removeEventListener("keydown", onKeyDown);
    } catch (e) {}
  };

  // --- Image loading (preserve aspect ratio) ---
  if (filePath) {
    const img = new Image();
    // Prevent tainting if images are from another origin - but Notebook files are local
    img.crossOrigin = "anonymous";
    img.src = `/Notebook/${filePath}`;
    img.onload = () => {
      // compute scale preserving aspect ratio inside the canvas CSS area
      const cssW = canvasWrapper.clientWidth;
      const cssH = canvasWrapper.clientHeight;
      if (!cssW || !cssH) {
        // fallback: draw at natural size
        ctx.drawImage(img, 0, 0);
        return;
      }
      const scale = Math.min(cssW / img.width, cssH / img.height, 1);
      const drawW = img.width * scale;
      const drawH = img.height * scale;
      const offsetX = (cssW - drawW) / 2;
      const offsetY = (cssH - drawH) / 2;

      // Because ctx is scaled by DPR, we draw using CSS-coordinate sizes
      ctx.clearRect(0, 0, canvas.width / DPR, canvas.height / DPR);
      ctx.drawImage(img, 0, 0, img.width, img.height, offsetX, offsetY, drawW, drawH);

      // push initial state to undo stack (so user can undo the load)
      pushUndo();
    };
    img.onerror = (err) => {
      console.warn("Image load failed:", err);
    };
  } else {
    // initialize with transparent canvas; push initial state so undo works
    pushUndo();
  }

  // Utility: allow other code to programmatically export a dataUrl
  window.getPngEditorDataUrl = function() {
    return canvas.toDataURL("image/png");
  };

  // Ensure undo/redo buttons state
  updateUndoRedoButtons();

  // Return an object (optional) for embedding code to manipulate editor directly
  return {
    canvas,
    ctx,
    save: internalSave,
    destroy: window.destroyPngEditor,
    getDataUrl: window.getPngEditorDataUrl
  };
}

export default renderEditor;
