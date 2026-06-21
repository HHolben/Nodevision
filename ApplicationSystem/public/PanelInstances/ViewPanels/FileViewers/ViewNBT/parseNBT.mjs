// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/ViewNBT/parseNBT.mjs
// This file defines a defensive NBT parser used by the ViewNBT file viewer.

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

const TAG_NAMES = Object.freeze({
  [TAG_END]: "End",
  [TAG_BYTE]: "Byte",
  [TAG_SHORT]: "Short",
  [TAG_INT]: "Int",
  [TAG_LONG]: "Long",
  [TAG_FLOAT]: "Float",
  [TAG_DOUBLE]: "Double",
  [TAG_BYTE_ARRAY]: "Byte_Array",
  [TAG_STRING]: "String",
  [TAG_LIST]: "List",
  [TAG_COMPOUND]: "Compound",
  [TAG_INT_ARRAY]: "Int_Array",
  [TAG_LONG_ARRAY]: "Long_Array",
});

const MAX_NBT_DEPTH = 512;

function createDataView(input) {
  if (input instanceof DataView) return input;
  if (ArrayBuffer.isView(input)) {
    return new DataView(input.buffer, input.byteOffset, input.byteLength);
  }
  if (input instanceof ArrayBuffer) return new DataView(input);
  throw new TypeError("parseNBT expects an ArrayBuffer or typed array view.");
}

function decodeUtf8(bytes) {
  if (typeof TextDecoder !== "undefined") {
    return new TextDecoder("utf-8").decode(bytes);
  }
  let text = "";
  for (const byte of bytes) text += String.fromCharCode(byte);
  return text;
}

function normalizeLong(value) {
  const max = BigInt(Number.MAX_SAFE_INTEGER);
  const min = BigInt(Number.MIN_SAFE_INTEGER);
  return value <= max && value >= min ? Number(value) : value.toString();
}

function inferLittleEndian(view) {
  if (view.byteLength < 3 || view.getUint8(0) !== TAG_COMPOUND) return false;
  const remaining = view.byteLength - 3;
  const bigLength = view.getUint16(1, false);
  const littleLength = view.getUint16(1, true);
  return bigLength > remaining && littleLength <= remaining;
}

function attachNbtMeta(value, meta) {
  if (!value || typeof value !== "object") return value;
  Object.defineProperty(value, "__nbtMeta", {
    value: { ...(value.__nbtMeta || {}), ...meta },
    enumerable: false,
    configurable: true,
  });
  return value;
}

export function parseNBT(buffer, options = {}) {
  const view = createDataView(buffer);
  const littleEndian = typeof options.littleEndian === "boolean"
    ? options.littleEndian
    : inferLittleEndian(view);
  let offset = 0;

  function fail(message) {
    throw new Error(`NBT parse failed at offset ${offset}/${view.byteLength}: ${message}`);
  }

  function requireBytes(size, label) {
    if (offset + size > view.byteLength) {
      fail(`expected ${size} byte(s) for ${label}, but only ${view.byteLength - offset} remain`);
    }
  }

  function readTagType(label = "tag type") {
    requireBytes(1, label);
    const value = view.getUint8(offset);
    offset += 1;
    return value;
  }

  function readByte() {
    requireBytes(1, "Byte");
    const value = view.getInt8(offset);
    offset += 1;
    return value;
  }

  function readShort() {
    requireBytes(2, "Short");
    const value = view.getInt16(offset, littleEndian);
    offset += 2;
    return value;
  }

  function readUnsignedShort(label = "unsigned Short") {
    requireBytes(2, label);
    const value = view.getUint16(offset, littleEndian);
    offset += 2;
    return value;
  }

  function readInt() {
    requireBytes(4, "Int");
    const value = view.getInt32(offset, littleEndian);
    offset += 4;
    return value;
  }

  function readLong() {
    requireBytes(8, "Long");
    let value;
    if (typeof view.getBigInt64 === "function") {
      value = normalizeLong(view.getBigInt64(offset, littleEndian));
    } else {
      const high = view.getInt32(offset + (littleEndian ? 4 : 0), littleEndian);
      const low = view.getUint32(offset + (littleEndian ? 0 : 4), littleEndian);
      value = high * 4294967296 + low;
    }
    offset += 8;
    return value;
  }

  function readFloat() {
    requireBytes(4, "Float");
    const value = view.getFloat32(offset, littleEndian);
    offset += 4;
    return value;
  }

  function readDouble() {
    requireBytes(8, "Double");
    const value = view.getFloat64(offset, littleEndian);
    offset += 8;
    return value;
  }

  function readString(label = "String") {
    const length = readUnsignedShort(`${label} length`);
    requireBytes(length, label);
    const bytes = new Uint8Array(view.buffer, view.byteOffset + offset, length);
    offset += length;
    return decodeUtf8(bytes);
  }

  function readByteArray() {
    const length = readInt();
    if (length < 0) fail("negative Byte_Array length " + length);
    requireBytes(length, "Byte_Array payload");
    const value = new Int8Array(view.buffer, view.byteOffset + offset, length);
    offset += length;
    return attachNbtMeta(Array.from(value), { tagType: TAG_BYTE_ARRAY });
  }

  function readIntArray() {
    const length = readInt();
    if (length < 0) fail("negative Int_Array length " + length);
    requireBytes(length * 4, "Int_Array payload");
    const values = [];
    values.length = length;
    for (let i = 0; i < length; i += 1) values[i] = readInt();
    return attachNbtMeta(values, { tagType: TAG_INT_ARRAY });
  }

  function readLongArray() {
    const length = readInt();
    if (length < 0) fail("negative Long_Array length " + length);
    requireBytes(length * 8, "Long_Array payload");
    const values = [];
    values.length = length;
    for (let i = 0; i < length; i += 1) values[i] = readLong();
    return attachNbtMeta(values, { tagType: TAG_LONG_ARRAY });
  }

  function minimumPayloadSize(type) {
    switch (type) {
      case TAG_BYTE:
        return 1;
      case TAG_SHORT:
        return 2;
      case TAG_INT:
      case TAG_FLOAT:
      case TAG_BYTE_ARRAY:
      case TAG_INT_ARRAY:
      case TAG_LONG_ARRAY:
        return 4;
      case TAG_LONG:
      case TAG_DOUBLE:
        return 8;
      case TAG_STRING:
        return 2;
      case TAG_LIST:
        return 5;
      case TAG_COMPOUND:
        return 1;
      default:
        return 0;
    }
  }

  function readList(depth) {
    const itemType = readTagType("List item type");
    const length = readInt();
    if (length < 0) fail("negative List length " + length);
    if (length === 0) return attachNbtMeta([], { tagType: TAG_LIST, itemType });
    if (!TAG_NAMES[itemType] || itemType === TAG_END) {
      fail("unknown List item tag type " + itemType);
    }
    const minimumBytes = minimumPayloadSize(itemType) * length;
    requireBytes(minimumBytes, "List payload");
    const values = [];
    values.length = length;
    for (let i = 0; i < length; i += 1) values[i] = readPayload(itemType, depth + 1);
    return attachNbtMeta(values, { tagType: TAG_LIST, itemType });
  }

  function readCompound(depth) {
    if (depth > MAX_NBT_DEPTH) fail(`compound nesting exceeds ${MAX_NBT_DEPTH}`);
    const obj = {};
    const tagTypes = {};
    while (true) {
      const type = readTagType("Compound child tag type");
      if (type === TAG_END) break;
      if (!TAG_NAMES[type]) fail("unknown tag type " + type);
      const name = readString("tag name");
      tagTypes[name] = type;
      obj[name] = readPayload(type, depth + 1);
    }
    return attachNbtMeta(obj, { tagType: TAG_COMPOUND, tagTypes });
  }

  function readPayload(type, depth) {
    switch (type) {
      case TAG_BYTE:
        return readByte();
      case TAG_SHORT:
        return readShort();
      case TAG_INT:
        return readInt();
      case TAG_LONG:
        return readLong();
      case TAG_FLOAT:
        return readFloat();
      case TAG_DOUBLE:
        return readDouble();
      case TAG_BYTE_ARRAY:
        return readByteArray();
      case TAG_STRING:
        return readString();
      case TAG_LIST:
        return readList(depth);
      case TAG_COMPOUND:
        return readCompound(depth);
      case TAG_INT_ARRAY:
        return readIntArray();
      case TAG_LONG_ARRAY:
        return readLongArray();
      default:
        fail(`unsupported tag type ${type}`);
    }
  }

  const rootType = readTagType("root tag type");
  if (rootType !== TAG_COMPOUND) {
    throw new Error(`Root is not Compound. Found tag ${rootType} (${TAG_NAMES[rootType] || "Unknown"}).`);
  }

  const rootName = readString("root name");
  const root = readCompound(0);
  attachNbtMeta(root, { rootName, littleEndian });
  return root;
}
