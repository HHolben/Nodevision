// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/ViewNBT/parseNBT.mjs
// This file defines a minimal NBT parser used by the ViewNBT file viewer in Nodevision. It reads common tag types from an ArrayBuffer and returns a JavaScript object.

export function parseNBT(buffer) {
  const view = new DataView(buffer);
  let offset = 0;

  function readByte() {
    return view.getInt8(offset++);
  }
  function readShort() {
    const v = view.getInt16(offset, false);
    offset += 2;
    return v;
  }
  function readInt() {
    const v = view.getInt32(offset, false);
    offset += 4;
    return v;
  }
  function readString() {
    const len = readShort();
    let s = "";
    for (let i = 0; i < len; i += 1) s += String.fromCharCode(view.getUint8(offset++));
    return s;
  }

  function readTag(type) {
    switch (type) {
      case 1:
        return readByte();
      case 2:
        return readShort();
      case 3:
        return readInt();
      case 8:
        return readString();
      case 9:
        return readList();
      case 10:
        return readCompound();
      default:
        return null;
    }
  }

  function readList() {
    const type = readByte();
    const len = readInt();
    const arr = [];
    for (let i = 0; i < len; i += 1) arr.push(readTag(type));
    return arr;
  }

  function readCompound() {
    const obj = {};
    while (true) {
      const type = readByte();
      if (type === 0) break;
      const name = readString();
      obj[name] = readTag(type);
    }
    return obj;
  }

  const rootType = readByte();
  if (rootType !== 10) throw new Error("Root is not Compound (Check GZip/Buffer)");
  readString();
  return readCompound();
}

