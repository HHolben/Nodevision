// Nodevision/ApplicationSystem/public/Voxels/BlockPng.mjs
// Decodes fixed 64 by 64 PNG voxel blocks without canvas color conversion or alpha premultiplication.
import { Reader, concat, integer, utf8, text, crc32, compressed } from './Binary.mjs';
const signature = new Uint8Array([137,80,78,71,13,10,26,10]);
function pngChunk(type, bytes) { const body = concat([utf8(type), bytes]); return concat([integer(bytes.length, false), body, integer(crc32(body), false)]); }
export async function decodeBlockPng(bytes) {
  const reader = new Reader(bytes); if (!reader.take(8).every((n, i) => n === signature[i])) throw Error('Invalid block PNG signature');
  let channels = 0, ended = false; const parts = [];
  while (reader.remaining) {
    const size = reader.int(false); if (size > 1048576) throw Error('PNG chunk too large');
    const typeBytes = reader.take(4), type = text.decode(typeBytes), data = reader.take(size), crc = reader.int(false) >>> 0;
    if (crc32(concat([typeBytes, data])) !== crc) throw Error('Corrupt PNG checksum');
    if (type === 'IHDR') { if (channels || data.length !== 13) throw Error('Invalid PNG header'); const header = new Reader(data); if (header.int(false) !== 64 || header.int(false) !== 64 || data[8] !== 8 || ![2,6].includes(data[9]) || data[10] || data[11] || data[12]) throw Error('Unsupported block PNG layout'); channels = data[9] === 6 ? 4 : 3; }
    else if (type === 'IDAT') { if (!channels) throw Error('PNG data before header'); parts.push(data); }
    else if (type === 'IEND') { if (data.length || reader.remaining) throw Error('Invalid PNG end'); ended = true; break; }
    else if (type[0] === type[0].toUpperCase() || type === 'tRNS') throw Error('Unsupported PNG chunk');
  }
  if (!ended || !channels || !parts.length) throw Error('Incomplete PNG');
  const stride = 64 * channels, raw = await compressed(concat(parts), true, (stride + 1) * 64);
  if (raw.length !== (stride + 1) * 64) throw Error('Invalid decoded PNG length');
  const pixels = new Uint8Array(stride * 64), rgba = new Uint8Array(16384);
  for (let y = 0; y < 64; y++) {
    const filter = raw[y * (stride + 1)]; if (filter > 4) throw Error('Invalid PNG filter');
    for (let x = 0; x < stride; x++) {
      const i = y * stride + x, a = x >= channels ? pixels[i - channels] : 0, b = y ? pixels[i - stride] : 0, c = y && x >= channels ? pixels[i - stride - channels] : 0;
      const p = a + b - c, pa = Math.abs(p-a), pb = Math.abs(p-b), pc = Math.abs(p-c);
      const predictor = [0,a,b,Math.floor((a+b)/2),pa <= pb && pa <= pc ? a : pb <= pc ? b : c][filter];
      pixels[i] = raw[y * (stride + 1) + 1 + x] + predictor;
    }
  }
  for (let i = 0; i < 4096; i++) { rgba.set(pixels.subarray(i * channels, i * channels + 3), i * 4); rgba[i * 4 + 3] = channels === 4 ? pixels[i * 4 + 3] : 255; }
  return rgba;
}
export async function encodeBlockPng(rgba) {
  if (rgba.length !== 16384) throw Error('Invalid voxel block'); const raw = new Uint8Array(64 * 257);
  for (let row = 0; row < 64; row++) raw.set(rgba.subarray(row * 256, row * 256 + 256), row * 257 + 1);
  return concat([signature, pngChunk('IHDR', concat([integer(64,false),integer(64,false),new Uint8Array([8,6,0,0,0])])), pngChunk('IDAT', await compressed(raw)), pngChunk('IEND', new Uint8Array())]);
}
