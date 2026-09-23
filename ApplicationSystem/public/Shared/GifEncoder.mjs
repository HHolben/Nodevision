// Nodevision/ApplicationSystem/public/Shared/GifEncoder.mjs
// This module provides a small dependency-free GIF89a encoder for browser-side editors and Sessions that need to save indexed still or animated raster images.

const DEFAULT_TRANSPARENT_INDEX = 0;

export function encodeGif(frames, width, height, options = {}) {
  const w = Math.max(1, Math.floor(width || 1));
  const h = Math.max(1, Math.floor(height || 1));
  const palette = normalizePalette(options.palette || createWebSafePalette());
  const transparentIndex = Number.isInteger(options.transparentIndex) ? options.transparentIndex : DEFAULT_TRANSPARENT_INDEX;
  const writer = createByteWriter();
  writer.ascii("GIF89a");
  writer.short(w);
  writer.short(h);
  writer.byte(0xf7);
  writer.byte(Math.max(0, Math.min(255, transparentIndex)));
  writer.byte(0);
  writer.bytes(palette);
  if ((frames || []).length > 1) writeLoopExtension(writer);
  for (const frame of frames || []) writeFrame(writer, frame, w, h, palette, transparentIndex);
  writer.byte(0x3b);
  return new Uint8Array(writer.output);
}

export function createWebSafePalette() {
  const palette = [0, 0, 0];
  for (let r = 0; r < 6; r += 1) {
    for (let g = 0; g < 6; g += 1) {
      for (let b = 0; b < 6; b += 1) palette.push(r * 51, g * 51, b * 51);
    }
  }
  for (let i = 0; palette.length < 256 * 3; i += 1) {
    const value = Math.round((i / 38) * 255);
    palette.push(value, value, value);
  }
  return palette.slice(0, 256 * 3);
}

export function createGrayscalePalette(levels = 256) {
  const count = Math.max(2, Math.min(256, Math.round(Number(levels) || 256)));
  const palette = [];
  for (let i = 0; i < 256; i += 1) {
    const step = count === 1 ? 0 : Math.round((i / 255) * (count - 1));
    const value = count === 1 ? 0 : Math.round((step / (count - 1)) * 255);
    palette.push(value, value, value);
  }
  return palette;
}

export function frameToPaletteIndices(frame, width, height, options = {}) {
  if (frame?.indices instanceof Uint8Array) return frame.indices;
  const canvas = canvasForFrame(frame, width, height);
  const ctx = canvas?.getContext?.("2d", { alpha: true });
  if (!ctx) return new Uint8Array(width * height);
  const data = ctx.getImageData(0, 0, width, height).data;
  const grayscale = options.grayscale === true;
  const transparentIndex = Number.isInteger(options.transparentIndex) ? options.transparentIndex : DEFAULT_TRANSPARENT_INDEX;
  const indices = new Uint8Array(width * height);
  for (let offset = 0, pixel = 0; offset < data.length; offset += 4, pixel += 1) {
    if (data[offset + 3] < 128) {
      indices[pixel] = transparentIndex;
    } else if (grayscale) {
      indices[pixel] = Math.max(0, Math.min(255, Math.round((data[offset] + data[offset + 1] + data[offset + 2]) / 3)));
    } else {
      const r = Math.round(data[offset] / 51);
      const g = Math.round(data[offset + 1] / 51);
      const b = Math.round(data[offset + 2] / 51);
      indices[pixel] = 1 + r * 36 + g * 6 + b;
    }
  }
  return indices;
}

function canvasForFrame(frame, width, height) {
  const source = frame?.canvas;
  if (!source) return null;
  if (source.width === width && source.height === height) return source;
  const target = document.createElement("canvas");
  target.width = width;
  target.height = height;
  const ctx = target.getContext("2d", { alpha: true });
  if (ctx) {
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(source, 0, 0);
  }
  return target;
}

function normalizePalette(palette) {
  const out = Array.from(palette || []).slice(0, 256 * 3).map((value) => Number(value) & 255);
  while (out.length < 256 * 3) out.push(0);
  return out;
}

function writeLoopExtension(writer) {
  writer.byte(0x21);
  writer.byte(0xff);
  writer.byte(0x0b);
  writer.ascii("NETSCAPE2.0");
  writer.byte(0x03);
  writer.byte(0x01);
  writer.short(0);
  writer.byte(0x00);
}

function writeFrame(writer, frame, width, height, palette, transparentIndex) {
  const delayHundredths = Math.max(1, Math.round(clampDelay(frame?.delayMs) / 10));
  const indices = frameToPaletteIndices(frame, width, height, {
    grayscale: frame?.grayscale === true,
    transparentIndex,
    palette,
  });
  writer.byte(0x21);
  writer.byte(0xf9);
  writer.byte(0x04);
  writer.byte(0x09);
  writer.short(delayHundredths);
  writer.byte(transparentIndex);
  writer.byte(0x00);
  writer.byte(0x2c);
  writer.short(0);
  writer.short(0);
  writer.short(width);
  writer.short(height);
  writer.byte(0x00);
  writer.byte(8);
  writer.subBlocks(lzwEncodeFlat(indices));
}

function clampDelay(delayMs) {
  const numeric = Math.floor(Number(delayMs));
  if (!Number.isFinite(numeric)) return 100;
  return Math.max(10, Math.min(60000, numeric));
}

function lzwEncodeFlat(indices) {
  const clearCode = 256;
  const endCode = 257;
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
  return packFixedCodes(codes, 9);
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

export function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(offset, offset + chunkSize));
  }
  return btoa(binary);
}
