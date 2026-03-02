// Nodevision/public/PanelInstances/EditorPanels/GraphicalEditors/PNGeditor.mjs
//This file is used to create an editor panel for PNG files.
import { History } from "./PNGeditorComponents/history.mjs";
import {
  bresenhamLine,
  hexToRGBA,
} from "./PNGeditorComponents/canvasEngine.mjs";
import { updateToolbarState } from "./../../../panels/createToolbar.mjs";

export async function renderEditor(filePath, container) {
  if (!container) throw new Error("Container required");
  container.innerHTML = "";

  const state = {
    logicalWidth: 32,
    logicalHeight: 32,
    pixelSize: 1,
    drawing: false,
    lastPos: null,
    startPos: null,
    selectionAnchor: null,
    selectionCurrent: null,
    selectionActive: false,
    selectionRect: null,
    selectionAction: null,
    selectionHandle: null,
    selectionStartPointer: null,
    selectionStartRect: null,
    selectionClipboard: null,
    selectionPhase: "idle",
    selectionTextureCanvas: null,
    baseSnapshot: null,
    fillTolerance: 24,
    displayWidth: 32,
    displayHeight: 32,
  };
  const RULER_THICKNESS = 26;
  const RULER_LEFT_WIDTH = 32;

  //0.set current Mode + default draw controls
  window.NodevisionState = window.NodevisionState || {};
  if (!window.NodevisionState.drawColor) {
    window.NodevisionState.drawColor = "#000000";
  }
  if (!window.NodevisionState.drawTool) {
    window.NodevisionState.drawTool = "brush";
  }
  if (!Number.isFinite(window.NodevisionState.drawAlpha)) {
    window.NodevisionState.drawAlpha = 0;
  }
  if (!Number.isFinite(window.NodevisionState.drawBrushSize)) {
    window.NodevisionState.drawBrushSize = 1;
  }
  window.NodevisionState.currentMode = "PNGediting";
  updateToolbarState({
    currentMode: "PNGediting",
    drawColor: window.NodevisionState.drawColor,
    drawTool: window.NodevisionState.drawTool,
    drawAlpha: window.NodevisionState.drawAlpha,
    drawBrushSize: window.NodevisionState.drawBrushSize,
  });

  if (filePath) {
    try {
      const sourceImage = await loadPngFromNotebook(filePath);
      state.logicalWidth = sourceImage.naturalWidth || sourceImage.width ||
        state.logicalWidth;
      state.logicalHeight = sourceImage.naturalHeight || sourceImage.height ||
        state.logicalHeight;
      state.initialImage = sourceImage;
    } catch (err) {
      state.loadError = err?.message || "Failed to load source image.";
      console.warn(
        "PNG editor: failed to load source image, starting with blank canvas.",
        err,
      );
    }
  }

  // 1. UI Build (Wrapper & Canvas + rulers)
  const wrapper = document.createElement("div");
  wrapper.style.cssText =
    "display:flex; flex-direction:column; align-items:flex-start; justify-content:flex-start; height:100%; width:100%; overflow:hidden; padding:8px; box-sizing:border-box; position:relative;";

  const canvas = document.createElement("canvas");
  canvas.width = state.logicalWidth;
  canvas.height = state.logicalHeight;
  canvas.style.cssText =
    "image-rendering:pixelated; image-rendering:crisp-edges; cursor:crosshair; background:repeating-conic-gradient(#ccc 0% 25%, #eee 0% 50%) 50% / 20px 20px; display:block;";
  const ctx = canvas.getContext("2d", { alpha: true });
  const history = new History(ctx);

  const canvasArea = document.createElement("div");
  canvasArea.style.cssText = `
    display:grid;
    grid-template-columns:${RULER_LEFT_WIDTH}px 1fr;
    grid-template-rows:${RULER_THICKNESS}px 1fr;
    width:100%;
    height:100%;
    flex:1;
    min-height:0;
    min-width:0;
    margin-top:8px;
  `;

  const rulerCorner = document.createElement("div");
  rulerCorner.style.cssText =
    "grid-area:1/1/2/2; background:#f4f4f4; border-right:1px solid #ccc; border-bottom:1px solid #ccc;";

  const topRulerSlot = document.createElement("div");
  Object.assign(topRulerSlot.style, {
    gridArea: "1 / 2 / 2 / 3",
    position: "relative",
    overflow: "hidden",
    background: "#f4f4f4"
  });

  const topRulerCanvas = document.createElement("canvas");
  topRulerCanvas.style.cssText =
    "position:absolute; top:0; left:0; height:" + RULER_THICKNESS + "px; background:#f4f4f4;";
  topRulerSlot.appendChild(topRulerCanvas);

  const leftRulerSlot = document.createElement("div");
  Object.assign(leftRulerSlot.style, {
    gridArea: "2 / 1 / 3 / 2",
    position: "relative",
    overflow: "hidden",
    background: "#f4f4f4"
  });

  const leftRulerCanvas = document.createElement("canvas");
  leftRulerCanvas.style.cssText =
    "position:absolute; top:0; left:0; width:" + RULER_LEFT_WIDTH + "px; background:#f4f4f4;";
  leftRulerSlot.appendChild(leftRulerCanvas);

  const canvasContainer = document.createElement("div");
  canvasContainer.style.cssText =
    "grid-area:2/2/3/3; position:relative; overflow:auto; min-width:0; min-height:0; background:#ffffff; display:flex; align-items:flex-start; justify-content:flex-start;";
  canvasContainer.appendChild(canvas);

  const selectionOverlay = document.createElement("div");
  selectionOverlay.id = "png-selection-overlay";
  selectionOverlay.style.cssText =
    "position:absolute; pointer-events:none; border:1px dashed rgba(77,162,255,0.85); background:rgba(77,162,255,0.15); display:none; z-index:15;";
  canvasContainer.appendChild(selectionOverlay);

  const handleNames = ["nw", "ne", "sw", "se"];
  const selectionHandles = {};
  handleNames.forEach((handle) => {
    const el = document.createElement("div");
    el.dataset.selectionHandle = handle;
    Object.assign(el.style, {
      position: "absolute",
      width: "10px",
      height: "10px",
      background: "#fff",
      border: "1px solid #2f80ff",
      borderRadius: "2px",
      cursor: handle === "nw" || handle === "se" ? "nwse-resize" : "nesw-resize",
      display: "none",
      zIndex: 25
    });
    selectionOverlay.appendChild(el);
    selectionHandles[handle] = el;
  });

  const selectionToolbar = document.createElement("div");
  selectionToolbar.style.cssText =
    "position:absolute; display:none; flex-wrap:nowrap; gap:4px; z-index:30; padding:2px 4px; border-radius:4px; background:rgba(0,0,0,0.7); color:#fff; font-size:11px;";
  selectionToolbar.innerHTML = `
    <button type="button" data-selection-action="copy" style="color:#fff;background:transparent;border:none;cursor:pointer;">Copy</button>
    <button type="button" data-selection-action="delete" style="color:#fff;background:transparent;border:none;cursor:pointer;">Delete</button>
  `;
  canvasContainer.appendChild(selectionToolbar);
  const handleSelectionToolbarClick = (evt) => {
    evt.stopPropagation();
    const action = evt.target?.closest("button")?.dataset?.selectionAction;
    if (action === "copy") {
      copySelection();
    } else if (action === "delete") {
      deleteSelection();
    }
  };
  const handleSelectionToolbarPointerDown = (evt) => {
    evt.stopPropagation();
  };
  selectionToolbar.addEventListener("click", handleSelectionToolbarClick);
  selectionToolbar.addEventListener("pointerdown", handleSelectionToolbarPointerDown);

  const selectionPreview = document.createElement("canvas");
  selectionPreview.style.cssText = "position:absolute; inset:0; pointer-events:none;";
  selectionOverlay.appendChild(selectionPreview);
  const selectionPreviewCtx = selectionPreview.getContext("2d");

  canvasArea.append(rulerCorner, topRulerSlot, leftRulerSlot, canvasContainer);
  wrapper.appendChild(canvasArea);
  container.appendChild(wrapper);

  if (state.initialImage) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(state.initialImage, 0, 0);
  }

  const updateDisplayScale = () => {
    const boundsW = Math.max(1, canvasContainer.clientWidth);
    const boundsH = Math.max(1, canvasContainer.clientHeight);
    const fitScale = Math.max(
      1,
      Math.floor(
        Math.min(boundsW / state.logicalWidth, boundsH / state.logicalHeight),
      ),
    );
    const displayW = Math.max(1, state.logicalWidth * fitScale);
    const displayH = Math.max(1, state.logicalHeight * fitScale);
    canvas.style.width = `${displayW}px`;
    canvas.style.height = `${displayH}px`;
    state.displayWidth = displayW;
    state.displayHeight = displayH;
    refreshSelectionOverlay();
    updateRulers();
  };
  updateDisplayScale();
  const resizeObserver = new ResizeObserver(updateDisplayScale);
  resizeObserver.observe(wrapper);

  function createSelectionBounds(a, b) {
    if (!a || !b) return null;
    const left = Math.min(a.x, b.x);
    const right = Math.max(a.x, b.x);
    const top = Math.min(a.y, b.y);
    const bottom = Math.max(a.y, b.y);
    return {
      x: left,
      y: top,
      width: Math.max(1, right - left + 1),
      height: Math.max(1, bottom - top + 1),
    };
  }

  function mapLogicalRectToCss(rect) {
    if (!rect) return null;
    const displayWidth = canvas.offsetWidth || canvas.getBoundingClientRect().width;
    const displayHeight = canvas.offsetHeight || canvas.getBoundingClientRect().height;
    if (!displayWidth || !displayHeight || !canvas.width || !canvas.height) {
      return null;
    }
    const scaleX = displayWidth / canvas.width;
    const scaleY = displayHeight / canvas.height;
    const left = rect.x * scaleX - canvasContainer.scrollLeft;
    const top = rect.y * scaleY - canvasContainer.scrollTop;
    return {
      left,
      top,
      width: Math.max(1, rect.width * scaleX),
      height: Math.max(1, rect.height * scaleY),
    };
  }

  function clampRect(rect) {
    if (!rect) return null;
    let { x, y, width, height } = rect;
    x = Math.round(x);
    y = Math.round(y);
    width = Math.max(1, Math.round(width));
    height = Math.max(1, Math.round(height));

    if (x < 0) {
      width += x;
      x = 0;
    }
    if (y < 0) {
      height += y;
      y = 0;
    }
    if (x + width > state.logicalWidth) {
      width = Math.max(1, state.logicalWidth - x);
    }
    if (y + height > state.logicalHeight) {
      height = Math.max(1, state.logicalHeight - y);
    }

    return {
      x,
      y,
      width: Math.max(1, width),
      height: Math.max(1, height),
    };
  }

  function clearSelectionAssets() {
    state.selectionTextureCanvas = null;
    state.baseSnapshot = null;
    selectionPreviewCtx?.clearRect(0, 0, selectionPreview.width, selectionPreview.height);
    selectionPreview.style.display = "none";
  }

  function resetSelectionState() {
    state.selectionRect = null;
    state.selectionActive = false;
    state.selectionAnchor = null;
    state.selectionCurrent = null;
    state.selectionAction = null;
    state.selectionHandle = null;
    state.selectionStartPointer = null;
    state.selectionStartRect = null;
    state.selectionPhase = "idle";
    window.NodevisionState.drawSelection = null;
    selectionToolbar.style.display = "none";
    selectionOverlay.style.display = "none";
    selectionOverlay.style.pointerEvents = "none";
    updateSelectionHandles(null);
    updateSelectionToolbar(null);
    clearSelectionAssets();
  }

  function updateSelectionPreview(cssRect) {
    if (
      !cssRect ||
      state.selectionPhase !== "committed" ||
      !state.selectionTextureCanvas
    ) {
      selectionPreview.style.display = "none";
      return;
    }
    if (!selectionPreviewCtx) return;
    const width = Math.max(1, Math.round(cssRect.width));
    const height = Math.max(1, Math.round(cssRect.height));
    selectionPreview.width = width;
    selectionPreview.height = height;
    selectionPreviewCtx.imageSmoothingEnabled = false;
    selectionPreviewCtx.clearRect(0, 0, width, height);
    selectionPreviewCtx.drawImage(
      state.selectionTextureCanvas,
      0,
      0,
      state.selectionTextureCanvas.width,
      state.selectionTextureCanvas.height,
      0,
      0,
      width,
      height,
    );
    selectionPreview.style.display = "block";
  }

  function drawSelectionTexture() {
    if (
      state.selectionPhase !== "committed" ||
      !state.selectionTextureCanvas ||
      !state.baseSnapshot ||
      !state.selectionRect
    ) {
      return;
    }
    ctx.putImageData(state.baseSnapshot, 0, 0);
    ctx.drawImage(
      state.selectionTextureCanvas,
      0,
      0,
      state.selectionTextureCanvas.width,
      state.selectionTextureCanvas.height,
      state.selectionRect.x,
      state.selectionRect.y,
      state.selectionRect.width,
      state.selectionRect.height,
    );
  }

  function resampleSelectionTexture(width, height) {
    if (!state.selectionTextureCanvas || width <= 0 || height <= 0) return;
    const temp = document.createElement("canvas");
    temp.width = width;
    temp.height = height;
    const tempCtx = temp.getContext("2d");
    tempCtx.imageSmoothingEnabled = false;
    tempCtx.clearRect(0, 0, width, height);
    tempCtx.drawImage(
      state.selectionTextureCanvas,
      0,
      0,
      state.selectionTextureCanvas.width,
      state.selectionTextureCanvas.height,
      0,
      0,
      width,
      height,
    );
    state.selectionTextureCanvas = temp;
  }

  function commitSelection() {
    if (
      state.selectionPhase === "committed" ||
      !state.selectionRect ||
      state.selectionRect.width <= 0 ||
      state.selectionRect.height <= 0
    ) {
      return;
    }
    const rect = state.selectionRect;
    const textureCanvas = document.createElement("canvas");
    textureCanvas.width = rect.width;
    textureCanvas.height = rect.height;
    const textureCtx = textureCanvas.getContext("2d");
    textureCtx.imageSmoothingEnabled = false;
    textureCtx.drawImage(
      canvas,
      rect.x,
      rect.y,
      rect.width,
      rect.height,
      0,
      0,
      rect.width,
      rect.height,
    );
    history.push(canvas);
    ctx.clearRect(rect.x, rect.y, rect.width, rect.height);
    state.baseSnapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
    state.selectionTextureCanvas = textureCanvas;
    state.selectionPhase = "committed";
    state.selectionAction = null;
    state.selectionHandle = null;
    state.selectionStartPointer = null;
    state.selectionStartRect = null;
    drawSelectionTexture();
    refreshSelectionOverlay();
  }

  function updateSelectionHandles(cssRect) {
    Object.values(selectionHandles).forEach((handle) => {
      handle.style.display = cssRect ? "block" : "none";
    });
    if (!cssRect) return;
    const handleOffset = 5;
    selectionHandles.nw.style.left = `${-handleOffset}px`;
    selectionHandles.nw.style.top = `${-handleOffset}px`;
    selectionHandles.ne.style.left = `${cssRect.width - handleOffset}px`;
    selectionHandles.ne.style.top = `${-handleOffset}px`;
    selectionHandles.sw.style.left = `${-handleOffset}px`;
    selectionHandles.sw.style.top = `${cssRect.height - handleOffset}px`;
    selectionHandles.se.style.left = `${cssRect.width - handleOffset}px`;
    selectionHandles.se.style.top = `${cssRect.height - handleOffset}px`;
  }

  function updateSelectionToolbar(cssRect) {
    if (!cssRect) {
      selectionToolbar.style.display = "none";
      return;
    }
    const maxToolbarWidth = 140;
    const left = Math.max(
      0,
      Math.min(cssRect.left, canvasContainer.clientWidth - maxToolbarWidth),
    );
    const top = Math.max(cssRect.top - 28, 0);
    selectionToolbar.style.left = `${left}px`;
    selectionToolbar.style.top = `${top}px`;
    selectionToolbar.style.display = "flex";
  }

  function setSelectionRect(rect) {
    if (!rect) {
      resetSelectionState();
      return;
    }
    const normalized = clampRect(rect);
    state.selectionRect = normalized;
    state.selectionActive = true;
    window.NodevisionState.drawSelection = normalized;
    refreshSelectionOverlay();
  }

  function refreshSelectionOverlay() {
    const tool = window.NodevisionState?.drawTool;
    const rect = state.selectionRect;
    if (!rect || tool !== "rectselect") {
      selectionOverlay.style.display = "none";
      selectionOverlay.style.pointerEvents = "none";
      updateSelectionHandles(null);
      updateSelectionToolbar(null);
      updateSelectionPreview(null);
      return;
    }
    const cssRect = mapLogicalRectToCss(rect);
    if (!cssRect) {
      selectionOverlay.style.display = "none";
      selectionOverlay.style.pointerEvents = "none";
      updateSelectionHandles(null);
      updateSelectionToolbar(null);
      updateSelectionPreview(null);
      return;
    }
    const committed = state.selectionPhase === "committed";
    selectionOverlay.style.left = `${cssRect.left}px`;
    selectionOverlay.style.top = `${cssRect.top}px`;
    selectionOverlay.style.width = `${cssRect.width}px`;
    selectionOverlay.style.height = `${cssRect.height}px`;
    selectionOverlay.style.display = "block";
    selectionOverlay.style.pointerEvents = committed ? "auto" : "none";
    selectionOverlay.style.borderStyle = committed ? "solid" : "dashed";
    selectionOverlay.style.borderColor = committed ? "#2f80ff" : "rgba(77,162,255,0.85)";
    selectionOverlay.style.background = committed
      ? "rgba(47,128,255,0.08)"
      : "rgba(77,162,255,0.15)";
    if (committed) {
      drawSelectionTexture();
    }
    updateSelectionHandles(committed ? cssRect : null);
    updateSelectionToolbar(committed ? cssRect : null);
    updateSelectionPreview(committed ? cssRect : null);
  }

  function drawHorizontalRuler() {
    const ctx = topRulerCanvas.getContext("2d");
    const measuredWidth = Math.max(1, Math.round(state.displayWidth || canvas.offsetWidth || 1));
    topRulerCanvas.width = measuredWidth;
    topRulerCanvas.height = RULER_THICKNESS;
    topRulerCanvas.style.width = `${measuredWidth}px`;
    ctx.clearRect(0, 0, measuredWidth, RULER_THICKNESS);
    ctx.fillStyle = "#f4f4f4";
    ctx.fillRect(0, 0, measuredWidth, RULER_THICKNESS);
    ctx.strokeStyle = "#999";
    ctx.beginPath();
    ctx.moveTo(0.5, RULER_THICKNESS - 0.5);
    ctx.lineTo(measuredWidth - 0.5, RULER_THICKNESS - 0.5);
    ctx.stroke();

    const totalUnits = Math.max(1, state.logicalWidth);
    const pxPerUnit = measuredWidth / totalUnits;
    const approxSpacing = 50;
    const stepUnits = Math.max(1, Math.round(approxSpacing / Math.max(pxPerUnit, 0.01)));
    const majorStep = Math.max(stepUnits * 5, stepUnits);

    ctx.fillStyle = "#222";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";

    const drawTick = (unit, isMajor = false) => {
      const x = Math.round(unit * pxPerUnit) + 0.5;
      const tickHeight = isMajor ? 12 : 7;
      ctx.beginPath();
      ctx.moveTo(x, RULER_THICKNESS);
      ctx.lineTo(x, RULER_THICKNESS - tickHeight);
      ctx.stroke();
      if (isMajor) {
        ctx.fillText(unit.toString(), x, 2);
      }
    };

    for (let unit = 0; unit <= totalUnits; unit += stepUnits) {
      drawTick(unit, unit % majorStep === 0);
    }
    if ((totalUnits % stepUnits) !== 0) {
      drawTick(totalUnits, true);
    }
  }

  function drawVerticalRuler() {
    const ctx = leftRulerCanvas.getContext("2d");
    const measuredHeight = Math.max(1, Math.round(state.displayHeight || canvas.offsetHeight || 1));
    leftRulerCanvas.height = measuredHeight;
    leftRulerCanvas.width = RULER_LEFT_WIDTH;
    leftRulerCanvas.style.height = `${measuredHeight}px`;
    ctx.clearRect(0, 0, RULER_LEFT_WIDTH, measuredHeight);
    ctx.fillStyle = "#f4f4f4";
    ctx.fillRect(0, 0, RULER_LEFT_WIDTH, measuredHeight);
    ctx.strokeStyle = "#999";
    ctx.beginPath();
    ctx.moveTo(RULER_LEFT_WIDTH - 0.5, 0);
    ctx.lineTo(RULER_LEFT_WIDTH - 0.5, measuredHeight);
    ctx.stroke();

    const totalUnits = Math.max(1, state.logicalHeight);
    const pxPerUnit = measuredHeight / totalUnits;
    const approxSpacing = 40;
    const stepUnits = Math.max(1, Math.round(approxSpacing / Math.max(pxPerUnit, 0.01)));
    const majorStep = Math.max(stepUnits * 5, stepUnits);

    ctx.fillStyle = "#222";
    ctx.font = "10px sans-serif";
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";

    const drawTick = (unit, isMajor = false) => {
      const y = Math.round(unit * pxPerUnit) + 0.5;
      const tickLength = isMajor ? 12 : 7;
      ctx.beginPath();
      ctx.moveTo(RULER_LEFT_WIDTH, y);
      ctx.lineTo(RULER_LEFT_WIDTH - tickLength, y);
      ctx.stroke();
      if (isMajor) {
        ctx.fillText(unit.toString(), RULER_LEFT_WIDTH - 4, y);
      }
    };

    for (let unit = 0; unit <= totalUnits; unit += stepUnits) {
      drawTick(unit, unit % majorStep === 0);
    }
    if ((totalUnits % stepUnits) !== 0) {
      drawTick(totalUnits, true);
    }
  }

  function updateRulers() {
    drawHorizontalRuler();
    drawVerticalRuler();
    const scrollX = canvasContainer.scrollLeft;
    const scrollY = canvasContainer.scrollTop;
    topRulerCanvas.style.transform = `translateX(-${scrollX}px)`;
    leftRulerCanvas.style.transform = `translateY(-${scrollY}px)`;
  }

  const handleCanvasScroll = () => {
    updateRulers();
    refreshSelectionOverlay();
  };
  canvasContainer.addEventListener("scroll", handleCanvasScroll);

  function startSelectionAction(type, handle, pointerPos) {
    if (!state.selectionRect) return;
    if (state.selectionPhase !== "committed") return;
    state.selectionAction = type;
    state.selectionHandle = handle;
    state.selectionStartPointer = pointerPos;
    state.selectionStartRect = { ...state.selectionRect };
  }

  function moveSelection(pos) {
    const start = state.selectionStartRect;
    if (!start || !state.selectionStartPointer) return;
    const dx = pos.x - state.selectionStartPointer.x;
    const dy = pos.y - state.selectionStartPointer.y;
    const x = Math.min(
      Math.max(0, start.x + dx),
      state.logicalWidth - start.width,
    );
    const y = Math.min(
      Math.max(0, start.y + dy),
      state.logicalHeight - start.height,
    );
    setSelectionRect({ x, y, width: start.width, height: start.height });
  }

  function resizeSelection(pos) {
    const start = state.selectionStartRect;
    const handleName = state.selectionHandle;
    if (!start || !handleName) return;
    const x1 = start.x;
    const y1 = start.y;
    const x2 = x1 + start.width;
    const y2 = y1 + start.height;
    let newX1 = x1;
    let newY1 = y1;
    let newX2 = x2;
    let newY2 = y2;
    const clampX = (value) => Math.max(0, Math.min(state.logicalWidth, value));
    const clampY = (value) => Math.max(0, Math.min(state.logicalHeight, value));
    switch (handleName) {
      case "nw":
        newX1 = Math.min(clampX(pos.x), x2 - 1);
        newY1 = Math.min(clampY(pos.y), y2 - 1);
        break;
      case "ne":
        newX2 = Math.max(clampX(pos.x), x1 + 1);
        newY1 = Math.min(clampY(pos.y), y2 - 1);
        break;
      case "sw":
        newX1 = Math.min(clampX(pos.x), x2 - 1);
        newY2 = Math.max(clampY(pos.y), y1 + 1);
        break;
      case "se":
        newX2 = Math.max(clampX(pos.x), x1 + 1);
        newY2 = Math.max(clampY(pos.y), y1 + 1);
        break;
    }
    const updated = createSelectionBounds(
      { x: newX1, y: newY1 },
      { x: newX2, y: newY2 },
    );
    if (updated) {
      setSelectionRect(updated);
    }
  }

  function handleSelectionPointerMove(evt) {
    if (!state.selectionAction) return;
    evt.preventDefault();
    const pos = inBounds(getPos(evt));
    if (!pos) return;
    if (state.selectionAction === "move") {
      moveSelection(pos);
    } else if (state.selectionAction === "resize") {
      resizeSelection(pos);
    }
  }

  function handleSelectionPointerUp() {
    const action = state.selectionAction;
    if (state.selectionPhase === "committed") {
      if (action === "resize" && state.selectionRect) {
        resampleSelectionTexture(state.selectionRect.width, state.selectionRect.height);
      }
      drawSelectionTexture();
      refreshSelectionOverlay();
    }
    state.selectionAction = null;
    state.selectionHandle = null;
    state.selectionStartPointer = null;
    state.selectionStartRect = null;
  }

  const handleKeyDown = (evt) => {
    if (window.NodevisionState?.drawTool !== "rectselect") return;
    const metaKey = window.navigator.platform.match("Mac") ? evt.metaKey : evt.ctrlKey;
    if (evt.key === "Escape") {
      evt.preventDefault();
      clearSelection();
    } else if (evt.key === "Delete" || evt.key === "Backspace") {
      evt.preventDefault();
      deleteSelection();
    } else if (evt.key === "Enter") {
      evt.preventDefault();
      commitSelection();
    } else if (metaKey && evt.key.toLowerCase() === "c") {
      evt.preventDefault();
      copySelection();
    } else if (metaKey && evt.key.toLowerCase() === "v") {
      evt.preventDefault();
      pasteSelection();
    }
  };
  window.addEventListener("pointermove", handleSelectionPointerMove);
  window.addEventListener("pointerup", handleSelectionPointerUp);
  window.addEventListener("keydown", handleKeyDown);

  const beginSelectionDrag = (evt) => {
    if (window.NodevisionState?.drawTool !== "rectselect") return;
    if (!state.selectionRect) return;
    if (state.selectionPhase !== "committed") return;
    evt.preventDefault();
    evt.stopPropagation();
    const pos = inBounds(getPos(evt));
    if (!pos) return;
    const handleName = evt.target?.dataset?.selectionHandle;
    if (handleName) {
      startSelectionAction("resize", handleName, pos);
    } else {
      startSelectionAction("move", null, pos);
    }
  };
  selectionOverlay.addEventListener("pointerdown", beginSelectionDrag);

  function updateRasterStatus(message) {
    const statusEl = document.getElementById("raster-status");
    if (!statusEl) return;
    const span = statusEl.querySelector("span");
    if (!span) return;
    span.textContent = message;
    setTimeout(() => {
      span.textContent = "Ready";
    }, 1800);
  }

  function copySelection() {
    if (
      state.selectionPhase === "committed" &&
      state.selectionTextureCanvas
    ) {
      const textureCtx = state.selectionTextureCanvas.getContext("2d");
      if (!textureCtx) return;
      const width = state.selectionTextureCanvas.width;
      const height = state.selectionTextureCanvas.height;
      const imageData = textureCtx.getImageData(0, 0, width, height);
      state.selectionClipboard = { imageData, width, height };
      updateRasterStatus("Selection copied");
      return;
    }
    if (!state.selectionRect) return;
    const { x, y, width, height } = state.selectionRect;
    const imageData = ctx.getImageData(x, y, width, height);
    state.selectionClipboard = { imageData, width, height };
    window.NodevisionState.drawSelectionClipboard = state.selectionClipboard;
    updateRasterStatus("Selection copied");
  }

  function pasteSelection() {
    const clipboard = state.selectionClipboard;
    if (!clipboard || !clipboard.imageData) return;
    const { width, height, imageData } = clipboard;
    const baseRect = state.selectionRect || { x: 0, y: 0, width, height };
    const offset = 12;
    const x = Math.min(
      Math.max(0, baseRect.x + offset),
      state.logicalWidth - width,
    );
    const y = Math.min(
      Math.max(0, baseRect.y + offset),
      state.logicalHeight - height,
    );
    history.push(canvas);
    ctx.clearRect(x, y, width, height);
    const pasteCanvas = document.createElement("canvas");
    pasteCanvas.width = width;
    pasteCanvas.height = height;
    const pasteCtx = pasteCanvas.getContext("2d");
    pasteCtx?.putImageData(imageData, 0, 0);
    state.selectionTextureCanvas = pasteCanvas;
    state.selectionPhase = "committed";
    state.baseSnapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
    setSelectionRect({ x, y, width, height });
    drawSelectionTexture();
    updateRasterStatus("Selection pasted");
  }

  function deleteSelection() {
    if (!state.selectionRect) return;
    history.push(canvas);
    if (state.baseSnapshot) {
      ctx.putImageData(state.baseSnapshot, 0, 0);
    } else {
      const { x, y, width, height } = state.selectionRect;
      ctx.clearRect(x, y, width, height);
    }
    resetSelectionState();
    updateRasterStatus("Selection deleted");
  }

  function clearSelection() {
    if (state.baseSnapshot) {
      ctx.putImageData(state.baseSnapshot, 0, 0);
    }
    resetSelectionState();
  }

  function startRectSelection(pos) {
    if (!pos) return;
    state.selectionPhase = "defining";
    state.selectionAnchor = pos;
    state.selectionCurrent = pos;
    const initial = createSelectionBounds(pos, pos);
    if (!initial) return;
    setSelectionRect(initial);
  }

  function updateRectSelection(pos) {
    if (!state.selectionAnchor) return;
    state.selectionCurrent = pos;
    const rect = createSelectionBounds(state.selectionAnchor, pos);
    if (!rect) return;
    setSelectionRect(rect);
  }

  function finalizeRectSelection(pos) {
    if (!state.selectionAnchor) return;
    state.selectionCurrent = pos;
    const rect = createSelectionBounds(state.selectionAnchor, pos);
    if (!rect) return;
    setSelectionRect(rect);
    state.selectionAnchor = null;
    state.selectionCurrent = null;
  }

  const handleToolChange = () => refreshSelectionOverlay();
  window.addEventListener("nv-draw-tool-changed", handleToolChange);
  window.addEventListener("resize", updateDisplayScale);

  // 3. Drawing Logic
  const getPos = (e) => {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: Math.floor(((clientX - rect.left) / rect.width) * state.logicalWidth),
      y: Math.floor(((clientY - rect.top) / rect.height) * state.logicalHeight),
    };
  };

  const draw = (x, y) => {
    const selectedTool = window.NodevisionState?.drawTool || "brush";
    const brushSize = clampBrushSize(window.NodevisionState?.drawBrushSize);
    const half = Math.floor(brushSize / 2);
    const startX = x - half;
    const startY = y - half;
    if (selectedTool === "eraser") {
      ctx.clearRect(startX, startY, brushSize, brushSize);
      return;
    }
    const drawColor = window.NodevisionState?.drawColor || "#000000";
    const transparency = clampTransparency(window.NodevisionState?.drawAlpha);
    const opacity = 100 - transparency;
    ctx.fillStyle = hexToRGBA(drawColor, opacity);
    ctx.fillRect(startX, startY, brushSize, brushSize);
  };

  const fillAt = (x, y) => {
    const drawColor = window.NodevisionState?.drawColor || "#000000";
    const transparency = clampTransparency(window.NodevisionState?.drawAlpha);
    const opacity = 100 - transparency;
    const replacement = hexToRGBAArray(drawColor, opacity);
    const tolerance = Number.isFinite(window.NodevisionState?.fillTolerance)
      ? Math.max(0, Number(window.NodevisionState.fillTolerance))
      : state.fillTolerance ?? 0;
    floodFillCanvas(ctx, canvas, x, y, replacement, tolerance);
  };

  const inBounds = (pos) => ({
    x: Math.max(0, Math.min(state.logicalWidth - 1, pos.x)),
    y: Math.max(0, Math.min(state.logicalHeight - 1, pos.y)),
  });

  const pickColorAt = (x, y) => {
    const imageData = ctx.getImageData(x, y, 1, 1).data;
    const r = imageData[0];
    const g = imageData[1];
    const b = imageData[2];
    const a = imageData[3];
    const color = rgbToHex(r, g, b);
    const opacity = Math.round((a / 255) * 100);
    const transparency = 100 - opacity;
    window.NodevisionState.drawColor = color;
    window.NodevisionState.drawAlpha = transparency;
    window.NodevisionState.drawTool = "brush";

    const colorInput = document.getElementById("draw-color-input");
    const colorHex = document.getElementById("draw-color-hex");
    const preview = document.getElementById("draw-color-preview");
    const alphaInput = document.getElementById("draw-alpha-input");
    const alphaValue = document.getElementById("draw-alpha-value");
    const brushBtn = document.getElementById("draw-tool-brush");
    const eraserBtn = document.getElementById("draw-tool-eraser");
    const fillBtn = document.getElementById("draw-tool-fill");
    const eyedropperBtn = document.getElementById("draw-tool-eyedropper");
    const lineBtn = document.getElementById("draw-tool-line");
    const rectangleBtn = document.getElementById("draw-tool-rectangle");
    const circleBtn = document.getElementById("draw-tool-circle");
    if (colorInput) colorInput.value = color;
    if (colorHex) colorHex.textContent = color;
    if (preview) preview.style.backgroundColor = color;
    if (alphaInput) alphaInput.value = String(transparency);
    if (alphaValue) alphaValue.textContent = `${transparency}%`;
    if (brushBtn) brushBtn.style.background = "#cfead2";
    if (eraserBtn) eraserBtn.style.background = "#fff";
    if (fillBtn) fillBtn.style.background = "#fff";
    if (eyedropperBtn) eyedropperBtn.style.background = "#fff";
    if (lineBtn) lineBtn.style.background = "#fff";
    if (rectangleBtn) rectangleBtn.style.background = "#fff";
    if (circleBtn) circleBtn.style.background = "#fff";
    if (window.rasterCanvas) window.rasterCanvas.style.cursor = "crosshair";
  };

  const onMove = (e) => {
    if (
      state.selectionAnchor &&
      window.NodevisionState?.drawTool === "rectselect"
    ) {
      const pos = inBounds(getPos(e));
      updateRectSelection(pos);
      return;
    }
    if (!state.drawing) return;
    const selectedTool = window.NodevisionState?.drawTool || "brush";
    if (selectedTool !== "brush" && selectedTool !== "eraser") return;
    const pos = getPos(e);
    if (state.lastPos) {
      bresenhamLine(state.lastPos.x, state.lastPos.y, pos.x, pos.y, draw);
    }
    state.lastPos = pos;
  };

  // Event Listeners
  canvas.addEventListener("mousedown", (e) => {
    const selectedTool = window.NodevisionState?.drawTool || "brush";
    const startPos = inBounds(getPos(e));
    if (selectedTool === "rectselect") {
      startRectSelection(startPos);
      return;
    }
    history.push(canvas);
    if (selectedTool === "fill") {
      fillAt(startPos.x, startPos.y);
      state.drawing = false;
      state.lastPos = null;
      return;
    }
    if (selectedTool === "eyedropper") {
      pickColorAt(startPos.x, startPos.y);
      state.drawing = false;
      state.lastPos = null;
      return;
    }
    if (
      selectedTool === "line" || selectedTool === "rectangle" ||
      selectedTool === "circle"
    ) {
      state.drawing = true;
      state.startPos = startPos;
      state.lastPos = startPos;
      return;
    }
    state.drawing = true;
    state.startPos = startPos;
    state.lastPos = startPos;
    draw(state.lastPos.x, state.lastPos.y);
  });

  window.addEventListener("mousemove", onMove);
  const onMouseUp = (e) => {
    const selectedTool = window.NodevisionState?.drawTool || "brush";
    if (state.selectionActive && selectedTool === "rectselect") {
      const endPos = inBounds(getPos(e));
      finalizeRectSelection(endPos);
      return;
    }
    if (!state.drawing) return;
    if (
      selectedTool === "line" || selectedTool === "rectangle" ||
      selectedTool === "circle"
    ) {
      const endPos = inBounds(getPos(e));
      if (state.startPos) {
        if (selectedTool === "line") {
          drawLine(
            state.startPos.x,
            state.startPos.y,
            endPos.x,
            endPos.y,
            draw,
          );
        } else if (selectedTool === "rectangle") {
          drawRectangle(
            state.startPos.x,
            state.startPos.y,
            endPos.x,
            endPos.y,
            draw,
          );
        } else if (selectedTool === "circle") {
          drawCircle(
            state.startPos.x,
            state.startPos.y,
            endPos.x,
            endPos.y,
            draw,
          );
        }
      }
    }
    state.drawing = false;
    state.startPos = null;
    state.lastPos = null;
  };
  window.addEventListener("mouseup", onMouseUp);

  // Global Integration
  window.rasterCanvas = canvas;

  return {
    destroy: () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("nv-draw-tool-changed", handleToolChange);
      window.removeEventListener("resize", updateDisplayScale);
      window.removeEventListener("pointermove", handleSelectionPointerMove);
      window.removeEventListener("pointerup", handleSelectionPointerUp);
      window.removeEventListener("keydown", handleKeyDown);
      resizeObserver.disconnect();
      clearSelection();
      selectionOverlay.removeEventListener("pointerdown", beginSelectionDrag);
      selectionToolbar.removeEventListener("click", handleSelectionToolbarClick);
      selectionToolbar.removeEventListener("pointerdown", handleSelectionToolbarPointerDown);
      canvasContainer.removeEventListener("scroll", handleCanvasScroll);
      if (selectionOverlay && selectionOverlay.parentNode) {
        selectionOverlay.parentNode.removeChild(selectionOverlay);
      }
      if (selectionToolbar && selectionToolbar.parentNode) {
        selectionToolbar.parentNode.removeChild(selectionToolbar);
      }
      window.rasterCanvas = null;
    },
  };
}

function clampTransparency(transparency) {
  const numeric = Number(transparency);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(100, numeric));
}

function clampBrushSize(size) {
  const numeric = Math.floor(Number(size));
  if (!Number.isFinite(numeric)) return 1;
  return Math.max(1, numeric);
}

function rgbToHex(r, g, b) {
  const toHex = (value) => value.toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function drawLine(x1, y1, x2, y2, drawPixel) {
  bresenhamLine(x1, y1, x2, y2, drawPixel);
}

function drawRectangle(x1, y1, x2, y2, drawPixel) {
  const left = Math.min(x1, x2);
  const right = Math.max(x1, x2);
  const top = Math.min(y1, y2);
  const bottom = Math.max(y1, y2);
  bresenhamLine(left, top, right, top, drawPixel);
  bresenhamLine(right, top, right, bottom, drawPixel);
  bresenhamLine(right, bottom, left, bottom, drawPixel);
  bresenhamLine(left, bottom, left, top, drawPixel);
}

function drawCircle(x1, y1, x2, y2, drawPixel) {
  const radius = Math.round(Math.hypot(x2 - x1, y2 - y1));
  if (radius <= 0) {
    drawPixel(x1, y1);
    return;
  }

  let x = radius;
  let y = 0;
  let decision = 1 - x;

  while (y <= x) {
    drawPixel(x1 + x, y1 + y);
    drawPixel(x1 + y, y1 + x);
    drawPixel(x1 - y, y1 + x);
    drawPixel(x1 - x, y1 + y);
    drawPixel(x1 - x, y1 - y);
    drawPixel(x1 - y, y1 - x);
    drawPixel(x1 + y, y1 - x);
    drawPixel(x1 + x, y1 - y);
    y += 1;
    if (decision <= 0) {
      decision += 2 * y + 1;
    } else {
      x -= 1;
      decision += 2 * (y - x) + 1;
    }
  }
}

function hexToRGBAArray(hex, alphaPct) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const a = Math.round((alphaPct / 100) * 255);
  return [r, g, b, a];
}

function floodFillCanvas(ctx, canvas, startX, startY, replacementRGBA, tolerance = 0) {
  const width = canvas.width;
  const height = canvas.height;
  if (startX < 0 || startY < 0 || startX >= width || startY >= height) return;

  const image = ctx.getImageData(0, 0, width, height);
  const data = image.data;

  const idx = (startY * width + startX) * 4;
  const target = [data[idx], data[idx + 1], data[idx + 2], data[idx + 3]];

  if (
    target[0] === replacementRGBA[0] &&
    target[1] === replacementRGBA[1] &&
    target[2] === replacementRGBA[2] &&
    target[3] === replacementRGBA[3]
  ) {
    return;
  }

  const visited = new Uint8Array(width * height);
  const threshold = Math.max(0, tolerance);
  const thresholdSq = threshold * threshold;
  const stack = [[startX, startY]];
  while (stack.length) {
    const [x, y] = stack.pop();
    if (x < 0 || y < 0 || x >= width || y >= height) continue;
    const index = y * width + x;
    if (visited[index]) continue;
    const i = index * 4;
    const dr = data[i] - target[0];
    const dg = data[i + 1] - target[1];
    const db = data[i + 2] - target[2];
    const da = data[i + 3] - target[3];
    const distanceSq = dr * dr + dg * dg + db * db + da * da;
    if (distanceSq > thresholdSq) continue;

    visited[index] = 1;
    data[i] = replacementRGBA[0];
    data[i + 1] = replacementRGBA[1];
    data[i + 2] = replacementRGBA[2];
    data[i + 3] = replacementRGBA[3];

    stack.push([x + 1, y]);
    stack.push([x - 1, y]);
    stack.push([x, y + 1]);
    stack.push([x, y - 1]);
  }

  ctx.putImageData(image, 0, 0);
}

async function loadPngFromNotebook(filePath) {
  const stamp = `t=${Date.now()}`;
  const normalized = normalizeNotebookPath(filePath);
  const decodedNormalized = normalizeNotebookPath(safeDecode(filePath));
  const raw = String(filePath || "").trim().replace(/\\/g, "/");
  const rawNoHashQuery = raw.replace(/[?#].*$/, "");
  const rawPathname = rawNoHashQuery.startsWith("http://") ||
      rawNoHashQuery.startsWith("https://")
    ? safePathnameFromUrl(rawNoHashQuery)
    : rawNoHashQuery;

  const pathCandidates = dedupe([
    normalized || null,
    decodedNormalized || null,
    normalizeNotebookPath(rawPathname) || null,
  ]).filter(Boolean);

  for (const candidatePath of pathCandidates) {
    try {
      const img = await loadImageFromApiPath(candidatePath, stamp);
      return img;
    } catch {
      // try next
    }
  }

  const candidates = dedupe([
    normalized ? `/Notebook/${encodePathSegments(normalized)}?${stamp}` : null,
    decodedNormalized
      ? `/Notebook/${encodePathSegments(decodedNormalized)}?${stamp}`
      : null,
    normalized ? `/${encodePathSegments(normalized)}?${stamp}` : null,
    decodedNormalized
      ? `/${encodePathSegments(decodedNormalized)}?${stamp}`
      : null,
    rawPathname
      ? `${rawPathname}${rawPathname.includes("?") ? "&" : "?"}${stamp}`
      : null,
  ]).filter(Boolean);

  let lastError = null;
  for (const src of candidates) {
    try {
      const img = await loadImageFromSrc(src);
      return img;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError ||
    new Error(`Failed to load PNG from candidates for: ${filePath}`);
}

async function loadImageFromApiPath(relativePath, stamp) {
  const encodedPath = encodeURIComponent(relativePath);
  const urls = [
    `/api/file-binary?path=${encodedPath}&${stamp}`,
    `/api/api/file-binary?path=${encodedPath}&${stamp}`,
  ];

  let lastStatus = null;
  for (const url of urls) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) {
      lastStatus = res.status;
      continue;
    }

    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    try {
      const img = await loadImageFromSrc(objectUrl);
      return img;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  throw new Error(
    `Binary API returned ${lastStatus ?? "error"} for ${relativePath}`,
  );
}

function loadImageFromSrc(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load PNG: ${src}`));
    img.src = src;
  });
}

function encodePathSegments(pathValue) {
  return String(pathValue)
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(safeDecode(segment)))
    .join("/");
}

function safeDecode(value) {
  try {
    return decodeURIComponent(String(value));
  } catch {
    return String(value);
  }
}

function dedupe(values) {
  return [...new Set(values)];
}

function normalizeNotebookPath(filePath) {
  if (!filePath) return "";

  const raw = String(filePath).trim();
  if (!raw) return "";

  // Strip protocol/origin if present and keep only pathname part.
  let pathOnly = raw;
  try {
    if (/^https?:\/\//i.test(raw)) {
      pathOnly = new URL(raw).pathname;
    }
  } catch {
    pathOnly = raw;
  }

  // Normalize separators and remove query/hash fragments.
  pathOnly = pathOnly
    .replace(/\\/g, "/")
    .replace(/[?#].*$/, "")
    .replace(/^\/+/, "");

  // If an absolute path contains "/Notebook/", keep the relative section after it.
  pathOnly = pathOnly.replace(/^.*\/Notebook\//i, "");
  pathOnly = pathOnly.replace(/^Notebook\//i, "");

  return pathOnly;
}

function safePathnameFromUrl(urlLike) {
  try {
    return new URL(urlLike).pathname;
  } catch {
    return String(urlLike);
  }
}
