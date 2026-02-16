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
    lastPos: null,
    startPos: null
  };


  //0.set current Mode + default draw controls
  window.NodevisionState = window.NodevisionState || {};
  if (!window.NodevisionState.drawColor) window.NodevisionState.drawColor = "#000000";
  if (!window.NodevisionState.drawTool) window.NodevisionState.drawTool = "brush";
  if (!Number.isFinite(window.NodevisionState.drawAlpha)) window.NodevisionState.drawAlpha = 0;
  if (!Number.isFinite(window.NodevisionState.drawBrushSize)) window.NodevisionState.drawBrushSize = 1;
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
      state.logicalWidth = sourceImage.naturalWidth || sourceImage.width || state.logicalWidth;
      state.logicalHeight = sourceImage.naturalHeight || sourceImage.height || state.logicalHeight;
      state.initialImage = sourceImage;
    } catch (err) {
      state.loadError = err?.message || "Failed to load source image.";
      console.warn("PNG editor: failed to load source image, starting with blank canvas.", err);
    }
  }

  // 1. UI Build (Wrapper & Canvas)
  const wrapper = document.createElement("div");
  wrapper.style.cssText = "display:flex; flex-direction:column; height:100%; width:100%; overflow:hidden;";
  
  const canvas = document.createElement("canvas");
  canvas.width = state.logicalWidth;
  canvas.height = state.logicalHeight;
  canvas.style.cssText = "image-rendering:pixelated; cursor:crosshair; background:repeating-conic-gradient(#ccc 0% 25%, #eee 0% 50%) 50% / 20px 20px;";
  
  const ctx = canvas.getContext("2d", { alpha: true });
  const history = new History(ctx);

  // 2. Canvas-only panel controls: color is set through Draw -> Color
  if (state.loadError) {
    const warning = document.createElement("div");
    warning.textContent = state.loadError;
    warning.style.cssText = "padding:6px 8px; color:#b00020; background:#fff3f3; border-bottom:1px solid #d9a0a0; font:12px monospace;";
    wrapper.appendChild(warning);
  }
  wrapper.appendChild(canvas);
  container.appendChild(wrapper);

  if (state.initialImage) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(state.initialImage, 0, 0);
  }

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
    floodFillCanvas(ctx, canvas, x, y, replacement);
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
    if (selectedTool === "line" || selectedTool === "rectangle" || selectedTool === "circle") {
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
    if (!state.drawing) return;
    const selectedTool = window.NodevisionState?.drawTool || "brush";
    if (selectedTool === "line" || selectedTool === "rectangle" || selectedTool === "circle") {
      const endPos = inBounds(getPos(e));
      if (state.startPos) {
        if (selectedTool === "line") {
          drawLine(state.startPos.x, state.startPos.y, endPos.x, endPos.y, draw);
        } else if (selectedTool === "rectangle") {
          drawRectangle(state.startPos.x, state.startPos.y, endPos.x, endPos.y, draw);
        } else if (selectedTool === "circle") {
          drawCircle(state.startPos.x, state.startPos.y, endPos.x, endPos.y, draw);
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
      window.rasterCanvas = null;
    }
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

function floodFillCanvas(ctx, canvas, startX, startY, replacementRGBA) {
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

  const stack = [[startX, startY]];
  while (stack.length) {
    const point = stack.pop();
    const x = point[0];
    const y = point[1];
    if (x < 0 || y < 0 || x >= width || y >= height) continue;

    const i = (y * width + x) * 4;
    if (
      data[i] !== target[0] ||
      data[i + 1] !== target[1] ||
      data[i + 2] !== target[2] ||
      data[i + 3] !== target[3]
    ) {
      continue;
    }

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
  const rawPathname = rawNoHashQuery.startsWith("http://") || rawNoHashQuery.startsWith("https://")
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
    decodedNormalized ? `/Notebook/${encodePathSegments(decodedNormalized)}?${stamp}` : null,
    normalized ? `/${encodePathSegments(normalized)}?${stamp}` : null,
    decodedNormalized ? `/${encodePathSegments(decodedNormalized)}?${stamp}` : null,
    rawPathname ? `${rawPathname}${rawPathname.includes("?") ? "&" : "?"}${stamp}` : null,
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

  throw lastError || new Error(`Failed to load PNG from candidates for: ${filePath}`);
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

  throw new Error(`Binary API returned ${lastStatus ?? "error"} for ${relativePath}`);
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
