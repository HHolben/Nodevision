// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/GIFFrameDecoder.test.mjs
// This test module verifies GIF frame decoding behavior for graphical editor image workflows.
import assert from "node:assert/strict";
import { decodeGifFrames } from "./GIFFrameDecoder.mjs";

function writer() {
  return {
    output: [],
    byte(value) { this.output.push(value & 0xff); },
    short(value) { this.byte(value & 0xff); this.byte((value >> 8) & 0xff); },
    ascii(text) { for (let index = 0; index < text.length; index += 1) this.byte(text.charCodeAt(index)); },
    bytes(values) { values.forEach((value) => this.byte(value)); },
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

function tinyAnimatedGif() {
  const w = writer();
  w.ascii("GIF89a");
  w.short(2);
  w.short(1);
  w.byte(0xf7);
  w.byte(0);
  w.byte(0);
  w.bytes([0, 0, 0, 255, 0, 0, 0, 0, 255]);
  while (w.output.length < 13 + 256 * 3) w.byte(0);

  const frames = [
    { delay: 5, pixels: [1, 0] },
    { delay: 12, pixels: [0, 2] },
  ];

  frames.forEach((frame) => {
    w.byte(0x21); w.byte(0xf9); w.byte(0x04); w.byte(0x09);
    w.short(frame.delay); w.byte(0); w.byte(0);
    w.byte(0x2c); w.short(0); w.short(0); w.short(2); w.short(1); w.byte(0);
    w.byte(8);
    w.subBlocks(packFixedCodes([256, ...frame.pixels, 257], 9));
  });
  w.byte(0x3b);
  return new Uint8Array(w.output);
}

const decoded = decodeGifFrames(tinyAnimatedGif());
assert.equal(decoded.width, 2);
assert.equal(decoded.height, 1);
assert.equal(decoded.frameCount, 2);
assert.equal(decoded.frames[0].delayMs, 50);
assert.equal(decoded.frames[1].delayMs, 120);
assert.deepEqual(Array.from(decoded.frames[0].rgba.slice(0, 8)), [255, 0, 0, 255, 0, 0, 0, 0]);
assert.deepEqual(Array.from(decoded.frames[1].rgba.slice(0, 8)), [0, 0, 0, 0, 0, 0, 255, 255]);
