// Nodevision/ApplicationSystem/public/Voxels/Binary.mjs
// Independent bounded binary primitives shared by the GOX and PNG codecs.
export const text = new TextDecoder('utf-8', { fatal: true });
export const utf8 = value => new TextEncoder().encode(value);
export function concat(parts) { const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0)); let offset = 0; for (const part of parts) { out.set(part, offset); offset += part.length; } return out; }
export function integer(value, little = true) { const out = new Uint8Array(4); new DataView(out.buffer).setInt32(0, value, little); return out; }
export class Reader {
  constructor(bytes) { this.bytes = bytes; this.offset = 0; this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength); }
  take(length) { if (!Number.isInteger(length) || length < 0 || length > this.bytes.length - this.offset) throw Error('Truncated or invalid binary length'); const part = this.bytes.slice(this.offset, this.offset + length); this.offset += length; return part; }
  int(little = true) { const offset = this.offset; this.take(4); return this.view.getInt32(offset, little); }
  get remaining() { return this.bytes.length - this.offset; }
}
export function crc32(bytes) { let crc = -1; for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); } return (crc ^ -1) >>> 0; }
export async function compressed(bytes, decode = false, limit = 100000) {
  const stream = new Blob([bytes]).stream().pipeThrough(decode ? new DecompressionStream('deflate') : new CompressionStream('deflate'));
  const reader = stream.getReader(); const parts = []; let size = 0;
  try { for (;;) { const { value, done } = await reader.read(); if (done) break; size += value.length; if (size > limit) throw Error('Embedded image exceeds decoded size limit'); parts.push(value); } }
  finally { await reader.cancel().catch(() => {}); }
  return concat(parts);
}
export function dictionary(bytes) {
  const reader = new Reader(bytes), result = new Map();
  while (reader.remaining) { const n = reader.int(); if (!n) { if (reader.remaining) throw Error('Unexpected dictionary tail'); break; } if (n > 255) throw Error('Invalid dictionary key'); const key = text.decode(reader.take(n)); if (result.has(key)) throw Error('Duplicate dictionary key'); result.set(key, reader.take(reader.int())); }
  return result;
}
export function writeDictionary(map) { return concat([...map].flatMap(([key, value]) => [integer(utf8(key).length), utf8(key), integer(value.length), value])); }
