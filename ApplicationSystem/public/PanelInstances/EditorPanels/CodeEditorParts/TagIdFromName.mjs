// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/CodeEditorParts/TagIdFromName.mjs
// This module implements tag id from name operations for CodeEditor, preserving the existing document and instance ownership contracts.

import { TAG_STRING, NBT_TAG_NAME_BY_ID, normalizeTagName, NBT_TAG_ID_BY_NAME, TAG_LIST, TAG_COMPOUND, TAG_LONG, TAG_BYTE, TAG_INT, TAG_DOUBLE, TAG_END, TAG_BYTE_ARRAY, TAG_INT_ARRAY, TAG_LONG_ARRAY, TAG_SHORT, TAG_FLOAT, nbtNotebookUrl } from "./ModuleState.mjs";
import { parseNBT } from "../../ViewPanels/FileViewers/ViewNBT/parseNBT.mjs";

export function tagIdFromName(name, fallback = TAG_STRING) {
  if (typeof name === "number" && NBT_TAG_NAME_BY_ID[name]) return name;
  const normalized = normalizeTagName(name);
  return NBT_TAG_ID_BY_NAME[normalized] ?? fallback;
}

export function tagNameFromId(id) {
  return NBT_TAG_NAME_BY_ID[id] || "String";
}

export function attachNbtMeta(value, meta) {
  if (!value || typeof value !== "object") return value;
  Object.defineProperty(value, "__nbtMeta", {
    value: { ...(value.__nbtMeta || {}), ...meta },
    enumerable: false,
    configurable: true,
  });
  return value;
}

export function inferNbtTagType(value) {
  if (Array.isArray(value)) return value.__nbtMeta?.tagType || TAG_LIST;
  if (value && typeof value === "object") return TAG_COMPOUND;
  if (typeof value === "string") return TAG_STRING;
  if (typeof value === "bigint") return TAG_LONG;
  if (typeof value === "boolean") return TAG_BYTE;
  if (Number.isInteger(value)) return TAG_INT;
  if (typeof value === "number") return TAG_DOUBLE;
  return TAG_STRING;
}

export function inferNbtListItemType(values = []) {
  const metaType = values.__nbtMeta?.itemType;
  if (metaType !== undefined) return metaType;
  const first = values.find((value) => value !== undefined && value !== null);
  return first === undefined ? TAG_END : inferNbtTagType(first);
}

export function toTaggedNbtNode(value, forcedType = null) {
  const type = forcedType ?? value?.__nbtMeta?.tagType ?? inferNbtTagType(value);
  if (type === TAG_COMPOUND) {
    const tagTypes = value?.__nbtMeta?.tagTypes || {};
    const out = {};
    for (const [key, child] of Object.entries(value || {})) {
      if (child === undefined || typeof child === "function") continue;
      out[key] = toTaggedNbtNode(child, tagTypes[key] ?? null);
    }
    return { type: "Compound", value: out };
  }
  if (type === TAG_LIST) {
    const values = Array.isArray(value) ? value : [];
    const itemType = inferNbtListItemType(values);
    return {
      type: "List",
      itemType: tagNameFromId(itemType),
      value: values.map((item) => toTaggedNbtNode(item, itemType)),
    };
  }
  if (type === TAG_BYTE_ARRAY || type === TAG_INT_ARRAY || type === TAG_LONG_ARRAY) {
    return { type: tagNameFromId(type), value: Array.isArray(value) ? [...value] : [] };
  }
  return { type: tagNameFromId(type), value };
}

export function nbtToEditableJson(root) {
  return JSON.stringify({
    format: "Nodevision NBT Tags",
    rootName: root?.__nbtMeta?.rootName || "",
    littleEndian: Boolean(root?.__nbtMeta?.littleEndian),
    root: toTaggedNbtNode(root, TAG_COMPOUND),
  }, null, 2) + "\n";
}

export function coercePrimitiveNbtValue(type, value) {
  if (type === TAG_BYTE) return value === true ? 1 : Number(value) || 0;
  if (type === TAG_SHORT || type === TAG_INT) return Math.trunc(Number(value) || 0);
  if (type === TAG_LONG) return typeof value === "bigint" ? value : String(value ?? "0");
  if (type === TAG_FLOAT || type === TAG_DOUBLE) return Number(value) || 0;
  if (type === TAG_STRING) return String(value ?? "");
  return value;
}

export function taggedNbtNodeToValue(node, expectedType = null) {
  const isWrappedNode = node && typeof node === "object" && !Array.isArray(node) && Object.prototype.hasOwnProperty.call(node, "type");
  const type = expectedType !== null && expectedType !== undefined ? expectedType : tagIdFromName(isWrappedNode ? node.type : null, TAG_STRING);
  const rawValue = isWrappedNode ? node.value : node;

  if (type === TAG_COMPOUND) {
    const obj = {};
    const tagTypes = {};
    for (const [key, child] of Object.entries(rawValue || {})) {
      const childType = tagIdFromName(child?.type, inferNbtTagType(child?.value ?? child));
      tagTypes[key] = childType;
      obj[key] = taggedNbtNodeToValue(child, childType);
    }
    return attachNbtMeta(obj, { tagType: TAG_COMPOUND, tagTypes });
  }

  if (type === TAG_LIST) {
    const values = Array.isArray(rawValue) ? rawValue : [];
    let itemType = tagIdFromName(isWrappedNode ? node.itemType : null, values[0]?.type ? tagIdFromName(values[0].type) : TAG_END);
    if (itemType === TAG_END && values.length > 0) itemType = TAG_STRING;
    const arr = values.map((item) => taggedNbtNodeToValue(item, itemType));
    return attachNbtMeta(arr, { tagType: TAG_LIST, itemType });
  }

  if (type === TAG_BYTE_ARRAY || type === TAG_INT_ARRAY || type === TAG_LONG_ARRAY) {
    const arrayItemType = type === TAG_BYTE_ARRAY ? TAG_BYTE : (type === TAG_LONG_ARRAY ? TAG_LONG : TAG_INT);
    const arr = Array.isArray(rawValue) ? rawValue.map((item) => coercePrimitiveNbtValue(arrayItemType, item)) : [];
    return attachNbtMeta(arr, { tagType: type });
  }

  return coercePrimitiveNbtValue(type, rawValue);
}

export function editableJsonToNbt(text) {
  const doc = JSON.parse(text);
  const rootNode = doc?.root || doc;
  const root = taggedNbtNodeToValue(rootNode, TAG_COMPOUND);
  return attachNbtMeta(root, {
    rootName: String(doc?.rootName || ""),
    littleEndian: Boolean(doc?.littleEndian),
  });
}

export async function fetchNbtForCodeEditor(filePath) {
  const response = await fetch(nbtNotebookUrl(filePath));
  if (!response.ok) throw new Error(`Failed to load NBT file (${response.status})`);
  const blob = await response.blob();
  try {
    const ds = new DecompressionStream("gzip");
    const buffer = await new Response(blob.stream().pipeThrough(ds)).arrayBuffer();
    return { buffer, gzip: true };
  } catch {
    return { buffer: await blob.arrayBuffer(), gzip: false };
  }
}

export async function gzipNbtBuffer(buffer) {
  if (typeof CompressionStream === "undefined") return buffer;
  const stream = new Blob([buffer]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Response(stream).arrayBuffer();
}

export function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export async function loadNbtCodeContent(filePath) {
  const { buffer, gzip } = await fetchNbtForCodeEditor(filePath);
  const root = parseNBT(buffer);
  return { content: nbtToEditableJson(root), gzip };
}
