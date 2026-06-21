// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/ViewNBT/serializeNBT.mjs
// Serializes JavaScript NBT objects back into binary NBT for the graphical NBT editor.

const TAG_END = 0;
const TAG_BYTE = 1;
const TAG_SHORT = 2;
const TAG_INT = 3;
const TAG_LONG = 4;
const TAG_FLOAT = 5;
const TAG_DOUBLE = 6;
const TAG_BYTE_ARRAY = 7;
const TAG_STRING = 8;
const TAG_LIST = 9;
const TAG_COMPOUND = 10;
const TAG_INT_ARRAY = 11;
const TAG_LONG_ARRAY = 12;

class NBTWriter {
  constructor({ littleEndian = false } = {}) {
    this.bytes = [];
    this.littleEndian = littleEndian;
  }

  pushUint8(value) {
    this.bytes.push(value & 0xff);
  }

  pushDataView(size, setter, value) {
    const buffer = new ArrayBuffer(size);
    const view = new DataView(buffer);
    view[setter](0, value, this.littleEndian);
    this.bytes.push(...new Uint8Array(buffer));
  }

  int8(value) { this.pushDataView(1, "setInt8", Number(value) || 0); }
  int16(value) { this.pushDataView(2, "setInt16", Number(value) || 0); }
  uint16(value) { this.pushDataView(2, "setUint16", Number(value) || 0); }
  int32(value) { this.pushDataView(4, "setInt32", Number(value) || 0); }
  float32(value) { this.pushDataView(4, "setFloat32", Number(value) || 0); }
  float64(value) { this.pushDataView(8, "setFloat64", Number(value) || 0); }

  int64(value) {
    const buffer = new ArrayBuffer(8);
    const view = new DataView(buffer);
    if (typeof view.setBigInt64 === "function") {
      view.setBigInt64(0, BigInt(value || 0), this.littleEndian);
    } else {
      const number = Number(value) || 0;
      const high = Math.trunc(number / 4294967296);
      const low = number >>> 0;
      view.setInt32(this.littleEndian ? 4 : 0, high, this.littleEndian);
      view.setUint32(this.littleEndian ? 0 : 4, low, this.littleEndian);
    }
    this.bytes.push(...new Uint8Array(buffer));
  }

  string(value) {
    const encoded = new TextEncoder().encode(String(value || ""));
    this.uint16(encoded.byteLength);
    this.bytes.push(...encoded);
  }

  arrayBuffer() {
    return new Uint8Array(this.bytes).buffer;
  }
}

function inferTagType(value) {
  if (Array.isArray(value)) return value.__nbtMeta?.tagType || TAG_LIST;
  if (value && typeof value === "object") return TAG_COMPOUND;
  if (typeof value === "string") return TAG_STRING;
  if (typeof value === "boolean") return TAG_BYTE;
  if (typeof value === "bigint") return TAG_LONG;
  if (Number.isInteger(value)) return TAG_INT;
  if (typeof value === "number") return TAG_DOUBLE;
  return TAG_STRING;
}

function inferListItemType(values) {
  const metaType = values?.__nbtMeta?.itemType;
  if (metaType !== undefined) return metaType;
  const first = values.find((value) => value !== undefined && value !== null);
  if (first === undefined) return TAG_END;
  return inferTagType(first);
}

function writeNamedTag(writer, name, value, type) {
  writer.pushUint8(type);
  writer.string(name);
  writePayload(writer, type, value);
}

function writeCompoundPayload(writer, value) {
  const tagTypes = value?.__nbtMeta?.tagTypes || {};
  for (const [key, child] of Object.entries(value || {})) {
    if (child === undefined || typeof child === "function") continue;
    writeNamedTag(writer, key, child, tagTypes[key] || inferTagType(child));
  }
  writer.pushUint8(TAG_END);
}

function writeListPayload(writer, value) {
  const values = Array.isArray(value) ? value : [];
  const itemType = inferListItemType(values);
  writer.pushUint8(itemType);
  writer.int32(values.length);
  for (const item of values) writePayload(writer, itemType, item);
}

function writeByteArrayPayload(writer, value) {
  const values = Array.isArray(value) ? value : [];
  writer.int32(values.length);
  for (const item of values) writer.int8(item);
}

function writeIntArrayPayload(writer, value) {
  const values = Array.isArray(value) ? value : [];
  writer.int32(values.length);
  for (const item of values) writer.int32(item);
}

function writeLongArrayPayload(writer, value) {
  const values = Array.isArray(value) ? value : [];
  writer.int32(values.length);
  for (const item of values) writer.int64(item);
}

function writePayload(writer, type, value) {
  switch (type) {
    case TAG_BYTE: writer.int8(value === true ? 1 : value); break;
    case TAG_SHORT: writer.int16(value); break;
    case TAG_INT: writer.int32(value); break;
    case TAG_LONG: writer.int64(value); break;
    case TAG_FLOAT: writer.float32(value); break;
    case TAG_DOUBLE: writer.float64(value); break;
    case TAG_BYTE_ARRAY: writeByteArrayPayload(writer, value); break;
    case TAG_STRING: writer.string(value); break;
    case TAG_LIST: writeListPayload(writer, value); break;
    case TAG_COMPOUND: writeCompoundPayload(writer, value); break;
    case TAG_INT_ARRAY: writeIntArrayPayload(writer, value); break;
    case TAG_LONG_ARRAY: writeLongArrayPayload(writer, value); break;
    default: throw new Error(`Cannot serialize unsupported NBT tag type ${type}`);
  }
}

export function serializeNBT(root) {
  const writer = new NBTWriter({ littleEndian: Boolean(root?.__nbtMeta?.littleEndian) });
  writer.pushUint8(TAG_COMPOUND);
  writer.string(root?.__nbtMeta?.rootName || "");
  writeCompoundPayload(writer, root);
  return writer.arrayBuffer();
}
