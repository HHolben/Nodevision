// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/GIFeditor.mjs
// GIF editor shell built on the shared raster editor from PNGeditor.
import { renderRasterEditor } from "./PNGeditor.mjs";

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

function createGifEditorContext(filePath, rasterApi) {
  const firstCanvas = getApiCanvas(rasterApi) || createCanvas(1, 1);
  const frames = [createFrameFromCanvas(firstCanvas, 100)];
  let currentFrameIndex = 0;
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
    deleteCurrentFrame,
    setFrameDelay,
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
    };
  }

  function refresh() {
    if (destroyed) return;
    window.dispatchEvent(new CustomEvent("nv-gif-editor-state-changed", { detail: getState() }));
  }

  function saveCurrentFrame() {
    const canvas = getApiCanvas(rasterApi);
    if (!(canvas instanceof HTMLCanvasElement)) return false;
    const previous = frames[currentFrameIndex] || { delayMs: 100 };
    frames[currentFrameIndex] = createFrameFromCanvas(canvas, previous.delayMs);
    refresh();
    return true;
  }

  function selectFrame(index) {
    const nextIndex = clampIndex(index, frames.length);
    if (nextIndex === currentFrameIndex) return true;
    saveCurrentFrame();
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
    saveCurrentFrame();
    const source = frames[currentFrameIndex] || frames[0];
    const duplicate = createFrameFromCanvas(source.canvas, source.delayMs);
    frames.splice(currentFrameIndex + 1, 0, duplicate);
    currentFrameIndex += 1;
    drawFrameToRaster(duplicate);
    refresh();
    return true;
  }

  function deleteCurrentFrame() {
    if (frames.length <= 1) return false;
    frames.splice(currentFrameIndex, 1);
    currentFrameIndex = Math.min(currentFrameIndex, frames.length - 1);
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

  async function save(targetPath = filePath) {
    const cleanPath = String(targetPath || filePath || "").trim();
    if (!cleanPath) throw new Error("GIF save path is missing.");
    saveCurrentFrame();
    const size = getExportSize();
    const gifBytes = encodeGif(frames, size.width, size.height);
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

function encodeGif(frames, width, height) {
  const writer = createByteWriter();
  writer.ascii("GIF89a");
  writer.short(width);
  writer.short(height);
  writer.byte(0xf7);
  writer.byte(TRANSPARENT_INDEX);
  writer.byte(0);
  writer.bytes(createGlobalPalette());

  writer.byte(0x21);
  writer.byte(0xff);
  writer.byte(0x0b);
  writer.ascii("NETSCAPE2.0");
  writer.byte(0x03);
  writer.byte(0x01);
  writer.short(0);
  writer.byte(0x00);

  frames.forEach((frame) => {
    const indices = frameToPaletteIndices(frame, width, height);
    const delayHundredths = Math.max(1, Math.round(clampDelay(frame.delayMs) / 10));

    writer.byte(0x21);
    writer.byte(0xf9);
    writer.byte(0x04);
    writer.byte(0x09);
    writer.short(delayHundredths);
    writer.byte(TRANSPARENT_INDEX);
    writer.byte(0x00);

    writer.byte(0x2c);
    writer.short(0);
    writer.short(0);
    writer.short(width);
    writer.short(height);
    writer.byte(0x00);

    writer.byte(8);
    writer.subBlocks(lzwEncodeFlat(indices));
  });

  writer.byte(0x3b);
  return new Uint8Array(writer.output);
}

function createGlobalPalette() {
  const palette = [];
  palette.push(0, 0, 0);
  for (let r = 0; r < 6; r += 1) {
    for (let g = 0; g < 6; g += 1) {
      for (let b = 0; b < 6; b += 1) {
        palette.push(r * 51, g * 51, b * 51);
      }
    }
  }
  for (let i = 0; palette.length < 256 * 3; i += 1) {
    const value = Math.round((i / 38) * 255);
    palette.push(value, value, value);
  }
  return palette.slice(0, 256 * 3);
}

function frameToPaletteIndices(frame, width, height) {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d", { alpha: true });
  if (!ctx) return new Uint8Array(width * height);
  ctx.clearRect(0, 0, width, height);
  if (frame && frame.canvas) ctx.drawImage(frame.canvas, 0, 0);
  const data = ctx.getImageData(0, 0, width, height).data;
  const indices = new Uint8Array(width * height);
  for (let offset = 0, pixel = 0; offset < data.length; offset += 4, pixel += 1) {
    const alpha = data[offset + 3];
    if (alpha < 128) {
      indices[pixel] = TRANSPARENT_INDEX;
      continue;
    }
    const r = Math.round(data[offset] / 51);
    const g = Math.round(data[offset + 1] / 51);
    const b = Math.round(data[offset + 2] / 51);
    indices[pixel] = 1 + r * 36 + g * 6 + b;
  }
  return indices;
}

function lzwEncodeFlat(indices) {
  const clearCode = 256;
  const endCode = 257;
  const codeSize = 9;
  const codes = [clearCode];
  let sinceClear = 0;
  for (const value of indices) {
    if (sinceClear >= 250) {
      codes.push(clearCode);
      sinceClear = 0;
    }
    codes.push(value & 255);
    sinceClear += 1;
  }
  codes.push(endCode);
  return packFixedCodes(codes, codeSize);
}

function packFixedCodes(codes, codeSize) {
  const output = [];
  let buffer = 0;
  let bitCount = 0;
  codes.forEach((code) => {
    buffer |= code << bitCount;
    bitCount += codeSize;
    while (bitCount >= 8) {
      output.push(buffer & 0xff);
      buffer >>= 8;
      bitCount -= 8;
    }
  });
  if (bitCount > 0) output.push(buffer & 0xff);
  return output;
}

function createByteWriter() {
  return {
    output: [],
    byte(value) { this.output.push(value & 0xff); },
    bytes(values) { values.forEach((value) => this.byte(value)); },
    short(value) {
      this.byte(value & 0xff);
      this.byte((value >> 8) & 0xff);
    },
    ascii(text) {
      for (let i = 0; i < text.length; i += 1) this.byte(text.charCodeAt(i));
    },
    subBlocks(values) {
      for (let offset = 0; offset < values.length; offset += 255) {
        const block = values.slice(offset, offset + 255);
        this.byte(block.length);
        this.bytes(block);
      }
      this.byte(0);
    },
  };
}

function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode.apply(null, chunk);
  }
  return btoa(binary);
}
