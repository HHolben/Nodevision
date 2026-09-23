// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/GIFeditor.mjs
// GIF editor shell built on the shared raster editor from PNGeditor.
import { ensureGifEditorModeLayout } from "/panels/workspace.mjs";
import { renderRasterEditor } from "./PNGeditor.mjs";
import { decodeGifFrames } from "./GIFFrameDecoder.mjs";
import { bytesToBase64, createWebSafePalette, encodeGif } from "/Shared/GifEncoder.mjs";

const GIF_MODE = "GIFediting";
const TRANSPARENT_INDEX = 0;

export async function renderEditor(filePath, container) {
  const rasterInstance = await renderRasterEditor(filePath, container, {
    mode: GIF_MODE,
    editorKind: "GIF",
    apiGlobalName: "__nvGifEditorApi",
    layoutEventName: "nv-raster-editor-layout-changed",
  });
  const rasterApi = rasterInstance && rasterInstance.api
    ? rasterInstance.api
    : window.__nvGifEditorApi || window.__nvRasterEditorApi;
  const gifContext = createGifEditorContext(filePath, rasterApi);

  window.GIFEditorContext = gifContext;
  window.__nvGifEditorContext = gifContext;
  window.__nvGifEditorActivePath = filePath || "";
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.currentMode = GIF_MODE;
  if (filePath) {
    window.NodevisionState.activeEditorFilePath = filePath;
    window.NodevisionState.selectedFile = filePath;
    window.currentActiveFilePath = filePath;
    window.filePath = filePath;
  }
  try {
    await applyGifEditorModeLayout(container);
  } catch (err) {
    console.warn("GIF editor: failed to apply GIF editor mode layout:", err);
  }

  await gifContext.loadSourceFrames();
  gifContext.refresh();

  return {
    api: rasterApi,
    gif: gifContext,
    destroy: () => {
      if (window.GIFEditorContext === gifContext) window.GIFEditorContext = null;
      if (window.__nvGifEditorContext === gifContext) window.__nvGifEditorContext = null;
      if (window.__nvGifEditorActivePath === filePath) window.__nvGifEditorActivePath = null;
      gifContext.destroy();
      if (rasterInstance && typeof rasterInstance.destroy === "function") {
        rasterInstance.destroy();
      }
    },
  };
}

async function applyGifEditorModeLayout(container) {
  const editorCell = container?.closest?.(".panel-cell");
  if (!editorCell) return null;
  if (editorCell.closest?.(".panel-row[data-nv-mode-layout-id=\"GifEditorMode\"]")) return null;
  return ensureGifEditorModeLayout({ editorCell });
}

function createGifEditorContext(filePath, rasterApi) {
  const firstCanvas = getApiCanvas(rasterApi) || createCanvas(1, 1);
  const frames = [createFrameFromCanvas(firstCanvas, 100)];
  let currentFrameIndex = 0;
  let copiedFrame = null;
  let destroyed = false;

  const context = {
    filePath,
    get mode() { return GIF_MODE; },
    get frames() { return frames; },
    get currentFrameIndex() { return currentFrameIndex; },
    getState,
    refresh,
    saveCurrentFrame,
    selectFrame,
    nextFrame,
    previousFrame,
    addDuplicateFrame,
    duplicateFrame,
    copyFrame,
    pasteFrame,
    moveFrame,
    deleteCurrentFrame,
    deleteFrame,
    setFrameDelay,
    loadSourceFrames,
    save,
    destroy,
  };

  function getState() {
    const frame = frames[currentFrameIndex] || frames[0];
    const size = getExportSize();
    return {
      filePath,
      mode: GIF_MODE,
      frameCount: frames.length,
      currentFrameIndex,
      currentFrameNumber: currentFrameIndex + 1,
      delayMs: frame ? frame.delayMs : 100,
      width: size.width,
      height: size.height,
      canDeleteFrame: frames.length > 1,
      hasCopiedFrame: Boolean(copiedFrame),
      frames: frames.map(getFrameSummary),
    };
  }

  function getFrameSummary(frame, index) {
    return {
      index,
      frameNumber: index + 1,
      delayMs: frame ? frame.delayMs : 100,
      width: frame?.canvas?.width || 1,
      height: frame?.canvas?.height || 1,
      selected: index === currentFrameIndex,
    };
  }

  function refresh() {
    if (destroyed) return;
    window.dispatchEvent(new CustomEvent("nv-gif-editor-state-changed", { detail: getState() }));
  }

  function saveCurrentFrame({ notify = true } = {}) {
    const canvas = getApiCanvas(rasterApi);
    if (!(canvas instanceof HTMLCanvasElement)) return false;
    const previous = frames[currentFrameIndex] || { delayMs: 100 };
    frames[currentFrameIndex] = createFrameFromCanvas(canvas, previous.delayMs);
    if (notify) refresh();
    return true;
  }

  function selectFrame(index) {
    const nextIndex = clampIndex(index, frames.length);
    if (nextIndex === currentFrameIndex) return true;
    saveCurrentFrame({ notify: false });
    currentFrameIndex = nextIndex;
    drawFrameToRaster(frames[currentFrameIndex]);
    refresh();
    return true;
  }

  function nextFrame() {
    return selectFrame((currentFrameIndex + 1) % frames.length);
  }

  function previousFrame() {
    return selectFrame((currentFrameIndex - 1 + frames.length) % frames.length);
  }

  function addDuplicateFrame() {
    return duplicateFrame(currentFrameIndex);
  }

  function duplicateFrame(index = currentFrameIndex) {
    saveCurrentFrame({ notify: false });
    const sourceIndex = clampIndex(index, frames.length);
    const source = frames[sourceIndex] || frames[0];
    if (!source) return false;
    const duplicate = createFrameFromCanvas(source.canvas, source.delayMs);
    frames.splice(sourceIndex + 1, 0, duplicate);
    currentFrameIndex = sourceIndex + 1;
    drawFrameToRaster(duplicate);
    refresh();
    return true;
  }

  function copyFrame(index = currentFrameIndex) {
    const sourceIndex = clampIndex(index, frames.length);
    if (sourceIndex === currentFrameIndex) saveCurrentFrame({ notify: false });
    const source = frames[sourceIndex] || frames[0];
    if (!source) return false;
    copiedFrame = createFrameFromCanvas(source.canvas, source.delayMs);
    refresh();
    return true;
  }

  function pasteFrame(index = currentFrameIndex) {
    if (!copiedFrame) return false;
    saveCurrentFrame({ notify: false });
    const insertAfterIndex = clampIndex(index, frames.length);
    const duplicate = createFrameFromCanvas(copiedFrame.canvas, copiedFrame.delayMs);
    frames.splice(insertAfterIndex + 1, 0, duplicate);
    currentFrameIndex = insertAfterIndex + 1;
    drawFrameToRaster(duplicate);
    refresh();
    return true;
  }

  function moveFrame(fromIndex, toIndex) {
    if (frames.length <= 1) return false;
    saveCurrentFrame({ notify: false });
    const from = clampIndex(fromIndex, frames.length);
    const to = clampIndex(toIndex, frames.length);
    if (from === to) return true;
    const [frame] = frames.splice(from, 1);
    frames.splice(to, 0, frame);
    if (currentFrameIndex === from) {
      currentFrameIndex = to;
    } else if (from < currentFrameIndex && to >= currentFrameIndex) {
      currentFrameIndex -= 1;
    } else if (from > currentFrameIndex && to <= currentFrameIndex) {
      currentFrameIndex += 1;
    }
    drawFrameToRaster(frames[currentFrameIndex]);
    refresh();
    return true;
  }

  function deleteCurrentFrame() {
    return deleteFrame(currentFrameIndex);
  }

  function deleteFrame(index = currentFrameIndex) {
    if (frames.length <= 1) return false;
    saveCurrentFrame({ notify: false });
    const targetIndex = clampIndex(index, frames.length);
    frames.splice(targetIndex, 1);
    if (currentFrameIndex > targetIndex) {
      currentFrameIndex -= 1;
    } else if (currentFrameIndex === targetIndex) {
      currentFrameIndex = Math.min(targetIndex, frames.length - 1);
    }
    drawFrameToRaster(frames[currentFrameIndex]);
    refresh();
    return true;
  }

  function setFrameDelay(delayMs) {
    const frame = frames[currentFrameIndex];
    if (!frame) return false;
    frame.delayMs = clampDelay(delayMs);
    refresh();
    return true;
  }

  async function loadSourceFrames() {
    if (!filePath) return false;
    try {
      const decoded = await fetchDecodedGifFrames(filePath);
      if (!decoded || !Array.isArray(decoded.frames) || !decoded.frames.length) return false;
      const decodedFrames = decoded.frames.map((frame) => createFrameFromDecodedGifFrame(frame, decoded.width, decoded.height));
      frames.splice(0, frames.length, ...decodedFrames);
      currentFrameIndex = 0;
      drawFrameToRaster(frames[currentFrameIndex]);
      console.info("GIF editor: loaded " + String(frames.length) + " frame" + (frames.length === 1 ? "" : "s") + " from " + filePath + ".");
      refresh();
      return true;
    } catch (err) {
      console.warn("GIF editor: failed to decode animated GIF frames; using browser-rendered first frame.", err);
      return false;
    }
  }

  async function save(targetPath = filePath) {
    const cleanPath = String(targetPath || filePath || "").trim();
    if (!cleanPath) throw new Error("GIF save path is missing.");
    saveCurrentFrame({ notify: false });
    const size = getExportSize();
    const gifBytes = encodeGif(frames, size.width, size.height, {
      palette: createWebSafePalette(),
      transparentIndex: TRANSPARENT_INDEX,
    });
    const payload = {
      path: cleanPath,
      sourcePath: filePath || cleanPath,
      encoding: "base64",
      mimeType: "image/gif",
      content: bytesToBase64(gifBytes),
    };
    const res = await fetch("/api/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = null;
    }
    if (!res.ok || !data || !data.success) {
      throw new Error((data && data.error) || res.status + " " + res.statusText);
    }
    refresh();
    return true;
  }

  function destroy() {
    destroyed = true;
  }

  function drawFrameToRaster(frame) {
    if (!frame || !frame.canvas) return false;
    if (rasterApi && typeof rasterApi.replaceCanvasContents === "function") {
      return rasterApi.replaceCanvasContents(frame.canvas, {
        pushHistory: false,
        statusMessage: "Frame " + (currentFrameIndex + 1),
      });
    }
    const canvas = getApiCanvas(rasterApi);
    const ctx = canvas && canvas.getContext ? canvas.getContext("2d") : null;
    if (!canvas || !ctx) return false;
    canvas.width = frame.canvas.width;
    canvas.height = frame.canvas.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(frame.canvas, 0, 0);
    return true;
  }

  function getExportSize() {
    const canvas = getApiCanvas(rasterApi);
    let width = canvas ? canvas.width : 1;
    let height = canvas ? canvas.height : 1;
    frames.forEach((frame) => {
      width = Math.max(width, frame.canvas.width || 1);
      height = Math.max(height, frame.canvas.height || 1);
    });
    return { width: Math.max(1, width), height: Math.max(1, height) };
  }

  return context;
}

function gifNotebookUrl(pathValue = "") {
  const clean = String(pathValue || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/[?#].*$/, "")
    .replace(/^\/+/, "")
    .replace(/^Notebook\/+/, "");
  const encoded = clean.split("/").filter(Boolean).map(encodeURIComponent).join("/");
  return "/Notebook/" + encoded;
}

async function fetchDecodedGifFrames(filePath) {
  const response = await fetch(gifNotebookUrl(filePath), { cache: "no-store" });
  if (!response.ok) throw new Error("HTTP " + String(response.status));
  const bytes = new Uint8Array(await response.arrayBuffer());
  return decodeGifFrames(bytes);
}

function createFrameFromDecodedGifFrame(frame, width, height) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d", { alpha: true });
  if (ctx) {
    const imageData = ctx.createImageData(width, height);
    imageData.data.set(frame.rgba);
    ctx.putImageData(imageData, 0, 0);
  }
  return { canvas, delayMs: clampDelay(frame.delayMs) };
}

function getApiCanvas(api) {
  if (api && typeof api.getCanvas === "function") return api.getCanvas();
  if (window.rasterCanvas instanceof HTMLCanvasElement) return window.rasterCanvas;
  return null;
}

function createFrameFromCanvas(sourceCanvas, delayMs = 100) {
  const canvas = cloneCanvas(sourceCanvas);
  return { canvas, delayMs: clampDelay(delayMs) };
}

function cloneCanvas(sourceCanvas) {
  const width = Math.max(1, sourceCanvas && sourceCanvas.width ? sourceCanvas.width : 1);
  const height = Math.max(1, sourceCanvas && sourceCanvas.height ? sourceCanvas.height : 1);
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");
  if (ctx && sourceCanvas) {
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(sourceCanvas, 0, 0, width, height);
  }
  return canvas;
}

function createCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.floor(width || 1));
  canvas.height = Math.max(1, Math.floor(height || 1));
  return canvas;
}

function clampIndex(index, length) {
  const count = Math.max(1, length || 1);
  const numeric = Math.floor(Number(index));
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.min(count - 1, numeric));
}

function clampDelay(delayMs) {
  const numeric = Math.floor(Number(delayMs));
  if (!Number.isFinite(numeric)) return 100;
  return Math.max(10, Math.min(60000, numeric));
}
