// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/GIFFrameDecoder.mjs
// Pure browser/Node GIF frame decoder used by the graphical GIF editor timeline.

const GIF_TRAILER = 0x3b;
const GIF_EXTENSION = 0x21;
const GIF_IMAGE_DESCRIPTOR = 0x2c;
const GIF_GRAPHIC_CONTROL = 0xf9;

function ensureBytes(input) {
  if (input instanceof Uint8Array) return input;
  if (input instanceof ArrayBuffer) return new Uint8Array(input);
  if (ArrayBuffer.isView(input)) return new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  throw new Error("GIF decoder requires bytes.");
}

function readAscii(bytes, offset, length) {
  let text = "";
  for (let index = 0; index < length; index += 1) text += String.fromCharCode(bytes[offset + index] || 0);
  return text;
}

function deinterlace(indices, width, height) {
  const output = new Uint8Array(width * height);
  const passes = [
    { start: 0, step: 8 },
    { start: 4, step: 8 },
    { start: 2, step: 4 },
    { start: 1, step: 2 },
  ];
  let sourceOffset = 0;
  passes.forEach((pass) => {
    for (let y = pass.start; y < height; y += pass.step) {
      for (let x = 0; x < width; x += 1) {
        output[y * width + x] = indices[sourceOffset] || 0;
        sourceOffset += 1;
      }
    }
  });
  return output;
}

function lzwDecode(minCodeSize, compressed, expectedSize) {
  const clearCode = 1 << minCodeSize;
  const endCode = clearCode + 1;
  const output = [];
  let byteOffset = 0;
  let bitOffset = 0;
  let codeSize = minCodeSize + 1;
  let nextCode = endCode + 1;
  let dictionary = [];
  let previous = null;

  const resetDictionary = () => {
    dictionary = [];
    for (let index = 0; index < clearCode; index += 1) dictionary[index] = [index];
    dictionary[clearCode] = null;
    dictionary[endCode] = null;
    codeSize = minCodeSize + 1;
    nextCode = endCode + 1;
    previous = null;
  };

  const readCode = () => {
    let code = 0;
    for (let bit = 0; bit < codeSize; bit += 1) {
      if (byteOffset >= compressed.length) return null;
      const byte = compressed[byteOffset];
      code |= ((byte >> bitOffset) & 1) << bit;
      bitOffset += 1;
      if (bitOffset >= 8) {
        bitOffset = 0;
        byteOffset += 1;
      }
    }
    return code;
  };

  resetDictionary();
  while (output.length < expectedSize) {
    const code = readCode();
    if (code === null) break;
    if (code === clearCode) {
      resetDictionary();
      continue;
    }
    if (code === endCode) break;

    let entry = dictionary[code];
    if (!entry && code === nextCode && previous) {
      entry = previous.concat(previous[0]);
    }
    if (!entry) throw new Error("Malformed GIF LZW stream.");

    output.push(...entry);
    if (previous) {
      dictionary[nextCode] = previous.concat(entry[0]);
      nextCode += 1;
      if (nextCode === (1 << codeSize) && codeSize < 12) codeSize += 1;
    }
    previous = entry;
  }

  const decoded = new Uint8Array(expectedSize);
  decoded.set(output.slice(0, expectedSize));
  return decoded;
}

function cloneRgba(source) {
  return new Uint8ClampedArray(source);
}

function clearRect(rgba, screenWidth, left, top, width, height) {
  const x0 = Math.max(0, left);
  const y0 = Math.max(0, top);
  const x1 = Math.min(screenWidth, left + width);
  const y1 = Math.min(rgba.length / (screenWidth * 4), top + height);
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const offset = (y * screenWidth + x) * 4;
      rgba[offset] = 0;
      rgba[offset + 1] = 0;
      rgba[offset + 2] = 0;
      rgba[offset + 3] = 0;
    }
  }
}

function drawIndexedFrame({ composite, screenWidth, screenHeight, frame, indices, palette, gce }) {
  const transparent = Boolean(gce.transparent);
  const transparentIndex = gce.transparentIndex;
  for (let row = 0; row < frame.height; row += 1) {
    const y = frame.top + row;
    if (y < 0 || y >= screenHeight) continue;
    for (let col = 0; col < frame.width; col += 1) {
      const x = frame.left + col;
      if (x < 0 || x >= screenWidth) continue;
      const colorIndex = indices[row * frame.width + col];
      if (transparent && colorIndex === transparentIndex) continue;
      const color = palette[colorIndex] || [0, 0, 0];
      const outputOffset = (y * screenWidth + x) * 4;
      composite[outputOffset] = color[0];
      composite[outputOffset + 1] = color[1];
      composite[outputOffset + 2] = color[2];
      composite[outputOffset + 3] = 255;
    }
  }
}

export function decodeGifFrames(input) {
  const bytes = ensureBytes(input);
  let offset = 0;
  const readByte = () => {
    if (offset >= bytes.length) throw new Error("Unexpected end of GIF data.");
    return bytes[offset++];
  };
  const readUnsignedShort = () => readByte() | (readByte() << 8);
  const readColorTable = (count) => {
    const table = [];
    for (let index = 0; index < count; index += 1) {
      table.push([readByte(), readByte(), readByte()]);
    }
    return table;
  };
  const readSubBlocks = () => {
    const chunks = [];
    let totalLength = 0;
    while (true) {
      const length = readByte();
      if (length === 0) break;
      if (offset + length > bytes.length) throw new Error("GIF sub-block overruns file length.");
      chunks.push(bytes.slice(offset, offset + length));
      totalLength += length;
      offset += length;
    }
    const output = new Uint8Array(totalLength);
    let outputOffset = 0;
    chunks.forEach((chunk) => {
      output.set(chunk, outputOffset);
      outputOffset += chunk.length;
    });
    return output;
  };

  const header = readAscii(bytes, offset, 6);
  offset += 6;
  if (header !== "GIF87a" && header !== "GIF89a") throw new Error("Not a GIF file.");

  const width = readUnsignedShort();
  const height = readUnsignedShort();
  const packed = readByte();
  const globalColorTableFlag = Boolean(packed & 0x80);
  const globalColorTableSize = 1 << ((packed & 0x07) + 1);
  const backgroundColorIndex = readByte();
  const pixelAspectRatio = readByte();
  const globalColorTable = globalColorTableFlag ? readColorTable(globalColorTableSize) : null;
  const composite = new Uint8ClampedArray(width * height * 4);
  const frames = [];
  let gce = { disposalMethod: 0, delayMs: 100, transparent: false, transparentIndex: null };

  while (offset < bytes.length) {
    const blockType = readByte();
    if (blockType === GIF_TRAILER) break;

    if (blockType === GIF_EXTENSION) {
      const label = readByte();
      if (label === GIF_GRAPHIC_CONTROL) {
        const blockSize = readByte();
        if (blockSize !== 4) throw new Error("Invalid GIF graphic control extension.");
        const controlPacked = readByte();
        const delayHundredths = readUnsignedShort();
        const transparentIndex = readByte();
        const terminator = readByte();
        if (terminator !== 0) throw new Error("Invalid GIF graphic control terminator.");
        gce = {
          disposalMethod: (controlPacked >> 2) & 0x07,
          delayMs: delayHundredths > 0 ? delayHundredths * 10 : 100,
          transparent: Boolean(controlPacked & 0x01),
          transparentIndex,
        };
      } else {
        readSubBlocks();
      }
      continue;
    }

    if (blockType !== GIF_IMAGE_DESCRIPTOR) {
      throw new Error("Unknown GIF block 0x" + blockType.toString(16) + ".");
    }

    const frame = {
      left: readUnsignedShort(),
      top: readUnsignedShort(),
      width: readUnsignedShort(),
      height: readUnsignedShort(),
    };
    const imagePacked = readByte();
    const localColorTableFlag = Boolean(imagePacked & 0x80);
    const interlaced = Boolean(imagePacked & 0x40);
    const localColorTableSize = 1 << ((imagePacked & 0x07) + 1);
    const localColorTable = localColorTableFlag ? readColorTable(localColorTableSize) : null;
    const palette = localColorTable || globalColorTable;
    if (!palette) throw new Error("GIF frame has no color table.");

    const lzwMinimumCodeSize = readByte();
    const compressed = readSubBlocks();
    let indices = lzwDecode(lzwMinimumCodeSize, compressed, frame.width * frame.height);
    if (interlaced) indices = deinterlace(indices, frame.width, frame.height);

    const restorePrevious = gce.disposalMethod === 3 ? cloneRgba(composite) : null;
    drawIndexedFrame({ composite, screenWidth: width, screenHeight: height, frame, indices, palette, gce });
    frames.push({
      rgba: cloneRgba(composite),
      delayMs: Math.max(10, Math.min(60000, Math.round(gce.delayMs || 100))),
      disposalMethod: gce.disposalMethod,
      left: frame.left,
      top: frame.top,
      width: frame.width,
      height: frame.height,
      transparentIndex: gce.transparent ? gce.transparentIndex : null,
    });

    if (gce.disposalMethod === 2) {
      clearRect(composite, width, frame.left, frame.top, frame.width, frame.height);
    } else if (restorePrevious) {
      composite.set(restorePrevious);
    }

    gce = { disposalMethod: 0, delayMs: 100, transparent: false, transparentIndex: null };
  }

  if (!frames.length) throw new Error("No GIF image frames were found.");
  return {
    version: header,
    width,
    height,
    backgroundColorIndex,
    pixelAspectRatio,
    frameCount: frames.length,
    frames,
  };
}
