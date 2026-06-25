// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/CodeEditor.mjs
// This file defines browser-side Code Editor logic for the Nodevision UI. It renders interface components and handles user interactions.
import saveCurrentFile from "/ToolbarCallbacks/file/saveFile.mjs";
import { updateToolbarState } from "/panels/createToolbar.mjs";
import { setStatus, setWordCountVisibility } from "/StatusBar.mjs";
import { normalizeNotebookRelativePath, toNotebookAssetUrl } from "/utils/notebookPath.mjs";
import { parseNBT } from "../ViewPanels/FileViewers/ViewNBT/parseNBT.mjs";
import { serializeNBT } from "../ViewPanels/FileViewers/ViewNBT/serializeNBT.mjs";

let editorInstance = null;
let editorContainer = null;
let editorInstanceContainer = null;
let lastEditedPath = null;
let currentLoadedEncoding = "utf8";
let currentLoadedBom = false;
let currentLoadedIsBinary = false;
let currentLoadedFileFormat = "text";
let currentLoadedNbtWasGzip = false;
let currentNbtTagPath = "/";
let nbtTagContextListeners = new Set();
let previewOutputEl = null;
let previewStatusEl = null;
let commonVarOverlay = null;
let commonVarData = [];
let savedVersionId = null;
let unsavedPromptEl = null;
let unsavedPromptOpen = false;
let editorLoadRequestId = 0;
let pendingEditedPath = null;

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

const NBT_TAG_NAME_BY_ID = Object.freeze({
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

const NBT_TAG_ID_BY_NAME = Object.freeze({
  end: TAG_END,
  byte: TAG_BYTE,
  short: TAG_SHORT,
  int: TAG_INT,
  integer: TAG_INT,
  long: TAG_LONG,
  float: TAG_FLOAT,
  double: TAG_DOUBLE,
  bytearray: TAG_BYTE_ARRAY,
  string: TAG_STRING,
  list: TAG_LIST,
  compound: TAG_COMPOUND,
  intarray: TAG_INT_ARRAY,
  integerarray: TAG_INT_ARRAY,
  longarray: TAG_LONG_ARRAY,
});

function isNbtFilePath(filePath) {
  return String(filePath || "").trim().replace(/[?#].*$/, "").toLowerCase().endsWith(".nbt");
}

function normalizeEditorPath(filePath) {
  return String(filePath || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/[?#].*$/, "")
    .replace(/^\/+/, "");
}

function isLatestEditorLoad(requestId, filePath) {
  return requestId === editorLoadRequestId && normalizeEditorPath(pendingEditedPath) === normalizeEditorPath(filePath);
}

function nbtNotebookUrl(filePath) {
  return toNotebookAssetUrl(normalizeNotebookRelativePath(filePath));
}

function normalizeTagName(name) {
  return String(name || "")
    .trim()
    .replace(/[\s_-]+/g, "")
    .toLowerCase();
}

function tagIdFromName(name, fallback = TAG_STRING) {
  if (typeof name === "number" && NBT_TAG_NAME_BY_ID[name]) return name;
  const normalized = normalizeTagName(name);
  return NBT_TAG_ID_BY_NAME[normalized] ?? fallback;
}

function tagNameFromId(id) {
  return NBT_TAG_NAME_BY_ID[id] || "String";
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

function inferNbtTagType(value) {
  if (Array.isArray(value)) return value.__nbtMeta?.tagType || TAG_LIST;
  if (value && typeof value === "object") return TAG_COMPOUND;
  if (typeof value === "string") return TAG_STRING;
  if (typeof value === "bigint") return TAG_LONG;
  if (typeof value === "boolean") return TAG_BYTE;
  if (Number.isInteger(value)) return TAG_INT;
  if (typeof value === "number") return TAG_DOUBLE;
  return TAG_STRING;
}

function inferNbtListItemType(values = []) {
  const metaType = values.__nbtMeta?.itemType;
  if (metaType !== undefined) return metaType;
  const first = values.find((value) => value !== undefined && value !== null);
  return first === undefined ? TAG_END : inferNbtTagType(first);
}

function toTaggedNbtNode(value, forcedType = null) {
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

function nbtToEditableJson(root) {
  return JSON.stringify({
    format: "Nodevision NBT Tags",
    rootName: root?.__nbtMeta?.rootName || "",
    littleEndian: Boolean(root?.__nbtMeta?.littleEndian),
    root: toTaggedNbtNode(root, TAG_COMPOUND),
  }, null, 2) + "\n";
}

function coercePrimitiveNbtValue(type, value) {
  if (type === TAG_BYTE) return value === true ? 1 : Number(value) || 0;
  if (type === TAG_SHORT || type === TAG_INT) return Math.trunc(Number(value) || 0);
  if (type === TAG_LONG) return typeof value === "bigint" ? value : String(value ?? "0");
  if (type === TAG_FLOAT || type === TAG_DOUBLE) return Number(value) || 0;
  if (type === TAG_STRING) return String(value ?? "");
  return value;
}

function taggedNbtNodeToValue(node, expectedType = null) {
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

function editableJsonToNbt(text) {
  const doc = JSON.parse(text);
  const rootNode = doc?.root || doc;
  const root = taggedNbtNodeToValue(rootNode, TAG_COMPOUND);
  return attachNbtMeta(root, {
    rootName: String(doc?.rootName || ""),
    littleEndian: Boolean(doc?.littleEndian),
  });
}

async function fetchNbtForCodeEditor(filePath) {
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

async function gzipNbtBuffer(buffer) {
  if (typeof CompressionStream === "undefined") return buffer;
  const stream = new Blob([buffer]).stream().pipeThrough(new CompressionStream("gzip"));
  return new Response(stream).arrayBuffer();
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function loadNbtCodeContent(filePath) {
  const { buffer, gzip } = await fetchNbtForCodeEditor(filePath);
  const root = parseNBT(buffer);
  return { content: nbtToEditableJson(root), gzip };
}

async function saveNbtCodeFile(path = window.__nvCodeEditorActivePath || window.currentActiveFilePath) {
  if (!editorInstance?.getValue) throw new Error("NBT code editor is not ready.");
  const root = editableJsonToNbt(editorInstance.getValue());
  let buffer = serializeNBT(root);
  if (currentLoadedNbtWasGzip) buffer = await gzipNbtBuffer(buffer);
  const response = await fetch("/api/save", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      path,
      content: arrayBufferToBase64(buffer),
      encoding: "base64",
      mimeType: "application/x-nbt",
    }),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.success) {
    throw new Error(data?.error || data?.message || `Failed to save NBT file (${response.status})`);
  }
  markEditorClean();
  window.dispatchEvent(new CustomEvent("nodevision-file-saved", { detail: { filePath: path } }));
  setStatus("NBT", "Tags saved");
  return true;
}


const NBT_TAG_EDITOR_TYPES = [
  "Byte",
  "Short",
  "Int",
  "Long",
  "Float",
  "Double",
  "Byte_Array",
  "String",
  "List",
  "Compound",
  "Int_Array",
  "Long_Array",
];

function normalizedEditableTagType(type, fallback = "String") {
  return tagNameFromId(tagIdFromName(type, tagIdFromName(fallback, TAG_STRING)));
}

function normalizedEditableListItemType(type) {
  const normalized = normalizedEditableTagType(type, "String");
  return normalized === "End" ? "String" : normalized;
}

function escapeNbtTagPathPart(part) {
  return String(part).replace(/~/g, "~0").replace(/\//g, "~1");
}

function unescapeNbtTagPathPart(part) {
  return String(part).replace(/~1/g, "/").replace(/~0/g, "~");
}

function splitNbtTagPath(path = "/") {
  const clean = String(path || "/");
  if (clean === "/") return [];
  return clean.replace(/^\//, "").split("/").map(unescapeNbtTagPathPart);
}

function joinNbtTagPath(parts = []) {
  return parts.length ? "/" + parts.map(escapeNbtTagPathPart).join("/") : "/";
}

function parentNbtTagPath(path = "/") {
  const parts = splitNbtTagPath(path);
  parts.pop();
  return joinNbtTagPath(parts);
}

function labelNbtTagPath(path = "/") {
  const parts = splitNbtTagPath(path);
  return parts.length ? `root/${parts.join("/")}` : "root";
}

function defaultEditableTagValue(type) {
  const normalized = normalizedEditableTagType(type, "String");
  if (normalized === "Compound") return {};
  if (normalized === "List" || normalized.endsWith("_Array")) return [];
  if (normalized === "String") return "";
  if (normalized === "Long") return "0";
  return 0;
}

function ensureEditableTagNode(node, fallbackType = "String") {
  if (node && typeof node === "object" && !Array.isArray(node) && Object.prototype.hasOwnProperty.call(node, "type")) {
    const type = normalizedEditableTagType(node.type, fallbackType);
    const next = { ...node, type };
    if (type === "List") next.itemType = normalizedEditableListItemType(node.itemType);
    if (next.value === undefined) next.value = defaultEditableTagValue(type);
    return next;
  }
  const type = normalizedEditableTagType(fallbackType, "String");
  return { type, value: node ?? defaultEditableTagValue(type) };
}

function defaultEditableTagNode(type = "String") {
  const normalized = normalizedEditableTagType(type, "String");
  const node = { type: normalized, value: defaultEditableTagValue(normalized) };
  if (normalized === "List") node.itemType = "String";
  return node;
}

function normalizeEditableNbtDocument(doc) {
  const normalized = doc && typeof doc === "object" && !Array.isArray(doc) ? doc : {};
  normalized.format = normalized.format || "Nodevision NBT Tags";
  normalized.rootName = String(normalized.rootName || "");
  normalized.littleEndian = Boolean(normalized.littleEndian);
  normalized.root = ensureEditableTagNode(normalized.root, "Compound");
  normalized.root.type = "Compound";
  if (!normalized.root.value || typeof normalized.root.value !== "object" || Array.isArray(normalized.root.value)) {
    normalized.root.value = {};
  }
  return normalized;
}

function parseEditableNbtDocumentFromEditor() {
  const text = editorInstance?.getValue?.() || "{}";
  return normalizeEditableNbtDocument(JSON.parse(text));
}

function setEditableNbtDocumentInEditor(doc) {
  if (!editorInstance?.setValue) return;
  editorInstance.setValue(JSON.stringify(normalizeEditableNbtDocument(doc), null, 2) + "\n");
  updateDirtyState();
}

function collectEditableNbtTagPaths(node, path = "/", out = []) {
  const tagNode = ensureEditableTagNode(node, path === "/" ? "Compound" : "String");
  const type = normalizedEditableTagType(tagNode.type);
  out.push({ path, label: labelNbtTagPath(path), type });
  if (type === "Compound") {
    const children = tagNode.value && typeof tagNode.value === "object" && !Array.isArray(tagNode.value) ? tagNode.value : {};
    for (const key of Object.keys(children)) {
      collectEditableNbtTagPaths(children[key], joinNbtTagPath([...splitNbtTagPath(path), key]), out);
    }
  } else if (type === "List") {
    const children = Array.isArray(tagNode.value) ? tagNode.value : [];
    children.forEach((child, index) => {
      collectEditableNbtTagPaths(child, joinNbtTagPath([...splitNbtTagPath(path), String(index)]), out);
    });
  }
  return out;
}

function resolveEditableNbtTag(doc, path = "/") {
  const normalized = normalizeEditableNbtDocument(doc);
  const parts = splitNbtTagPath(path);
  let node = normalized.root;
  let parent = null;
  let parentContainer = null;
  let key = null;
  for (const part of parts) {
    const parentNode = ensureEditableTagNode(node, "Compound");
    const type = normalizedEditableTagType(parentNode.type);
    parent = parentNode;
    key = part;
    if (type === "Compound") {
      parentContainer = parentNode.value && typeof parentNode.value === "object" && !Array.isArray(parentNode.value) ? parentNode.value : {};
      parentNode.value = parentContainer;
      node = parentContainer[part];
    } else if (type === "List") {
      parentContainer = Array.isArray(parentNode.value) ? parentNode.value : [];
      parentNode.value = parentContainer;
      node = parentContainer[Number(part)];
    } else {
      return null;
    }
    if (!node) return null;
  }
  return { doc: normalized, node: ensureEditableTagNode(node, parts.length ? "String" : "Compound"), parent, parentContainer, key, path };
}

function coerceEditableTagValue(type, value) {
  const normalized = normalizedEditableTagType(type, "String");
  if (normalized === "Compound") return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  if (normalized === "List" || normalized.endsWith("_Array")) return Array.isArray(value) ? value : [];
  if (normalized === "String") return String(value ?? "");
  if (normalized === "Long") return String(value ?? "0");
  if (normalized === "Float" || normalized === "Double") return Number(value) || 0;
  return Math.trunc(Number(value) || 0);
}

function retagEditableNbtNode(node, nextType) {
  const type = normalizedEditableTagType(nextType, "String");
  const current = ensureEditableTagNode(node, type);
  const next = { type, value: coerceEditableTagValue(type, current.value) };
  if (type === "List") next.itemType = normalizedEditableListItemType(current.itemType);
  return next;
}

function nextCompoundChildName(children, base = "newTag") {
  let candidate = base;
  let index = 1;
  while (Object.prototype.hasOwnProperty.call(children, candidate)) {
    candidate = `${base}${index}`;
    index += 1;
  }
  return candidate;
}

function getNbtTagEditorState() {
  if (currentLoadedFileFormat !== "nbt" || !editorInstance?.getValue) {
    return { id: "nbt-tags", title: "NBT Tag Properties", error: "Open an NBT file in the code editor to edit tags." };
  }
  try {
    const doc = parseEditableNbtDocumentFromEditor();
    const paths = collectEditableNbtTagPaths(doc.root);
    if (!paths.some((entry) => entry.path === currentNbtTagPath)) currentNbtTagPath = "/";
    const resolved = resolveEditableNbtTag(doc, currentNbtTagPath) || resolveEditableNbtTag(doc, "/");
    const node = ensureEditableTagNode(resolved?.node, currentNbtTagPath === "/" ? "Compound" : "String");
    const type = normalizedEditableTagType(node.type);
    const pathParts = splitNbtTagPath(currentNbtTagPath);
    const tagName = pathParts.length ? pathParts[pathParts.length - 1] : "root";
    return {
      id: "nbt-tags",
      title: "NBT Tag Properties",
      mode: "tags",
      filePath: window.__nvCodeEditorActivePath || window.currentActiveFilePath || "",
      rootName: doc.rootName || "",
      littleEndian: Boolean(doc.littleEndian),
      paths,
      tagTypes: [...NBT_TAG_EDITOR_TYPES],
      selectedPath: currentNbtTagPath,
      selectedTag: {
        path: currentNbtTagPath,
        label: labelNbtTagPath(currentNbtTagPath),
        name: tagName,
        type,
        itemType: type === "List" ? normalizedEditableListItemType(node.itemType) : "String",
        valueText: JSON.stringify(node.value ?? defaultEditableTagValue(type), null, 2),
        canRename: currentNbtTagPath !== "/" && resolved?.parent?.type === "Compound",
        canDelete: currentNbtTagPath !== "/",
        canAddChild: type === "Compound" || type === "List",
      },
    };
  } catch (err) {
    return {
      id: "nbt-tags",
      title: "NBT Tag Properties",
      filePath: window.__nvCodeEditorActivePath || window.currentActiveFilePath || "",
      error: err?.message || "Invalid NBT tag JSON.",
      selectedPath: currentNbtTagPath,
      paths: [],
      tagTypes: [...NBT_TAG_EDITOR_TYPES],
    };
  }
}

function notifyNbtTagContext(reason = "change") {
  if (currentLoadedFileFormat !== "nbt") return;
  const state = getNbtTagEditorState();
  for (const listener of nbtTagContextListeners) listener(state);
  window.dispatchEvent(new CustomEvent("nv-nbt-context-changed", { detail: { ...state, reason } }));
}

function applyNbtTagEditorPatch(patch = {}) {
  const doc = parseEditableNbtDocumentFromEditor();
  if (patch.rootName !== undefined) doc.rootName = String(patch.rootName || "");
  if (patch.littleEndian !== undefined) doc.littleEndian = Boolean(patch.littleEndian);
  const resolved = resolveEditableNbtTag(doc, currentNbtTagPath) || resolveEditableNbtTag(doc, "/");
  if (!resolved) return { ok: false, reason: "Selected tag was not found." };
  let node = ensureEditableTagNode(resolved.node, currentNbtTagPath === "/" ? "Compound" : "String");
  let nextPath = currentNbtTagPath;
  if (currentNbtTagPath !== "/" && patch.name !== undefined && resolved.parent?.type === "Compound") {
    const nextName = String(patch.name || "").trim();
    if (!nextName) return { ok: false, reason: "Tag name is required." };
    if (nextName !== resolved.key && Object.prototype.hasOwnProperty.call(resolved.parentContainer, nextName)) {
      return { ok: false, reason: `A tag named "${nextName}" already exists here.` };
    }
    if (nextName !== resolved.key) {
      delete resolved.parentContainer[resolved.key];
      resolved.parentContainer[nextName] = node;
      const parts = splitNbtTagPath(currentNbtTagPath);
      parts[parts.length - 1] = nextName;
      nextPath = joinNbtTagPath(parts);
    }
  }
  if (patch.type !== undefined && currentNbtTagPath !== "/") node = retagEditableNbtNode(node, patch.type);
  if (normalizedEditableTagType(node.type) === "List" && patch.itemType !== undefined) node.itemType = normalizedEditableTagType(patch.itemType, "String");
  if (patch.valueText !== undefined) {
    let parsedValue;
    try {
      parsedValue = JSON.parse(patch.valueText || "null");
    } catch (err) {
      return { ok: false, reason: err?.message || "Value must be valid JSON." };
    }
    node.value = coerceEditableTagValue(node.type, parsedValue);
  }
  if (currentNbtTagPath === "/") {
    doc.root = node;
    doc.root.type = "Compound";
  } else if (Array.isArray(resolved.parentContainer)) {
    resolved.parentContainer[Number(resolved.key)] = node;
  } else {
    const nextParts = splitNbtTagPath(nextPath);
    const lastKey = nextParts[nextParts.length - 1];
    resolved.parentContainer[lastKey] = node;
  }
  currentNbtTagPath = nextPath;
  setEditableNbtDocumentInEditor(doc);
  notifyNbtTagContext("tag-updated");
  return { ok: true };
}

function addNbtTagChild() {
  const doc = parseEditableNbtDocumentFromEditor();
  const resolved = resolveEditableNbtTag(doc, currentNbtTagPath) || resolveEditableNbtTag(doc, "/");
  if (!resolved) return { ok: false, reason: "Selected tag was not found." };
  const node = ensureEditableTagNode(resolved.node, "Compound");
  const type = normalizedEditableTagType(node.type);
  if (type === "Compound") {
    const children = node.value && typeof node.value === "object" && !Array.isArray(node.value) ? node.value : {};
    node.value = children;
    const key = nextCompoundChildName(children);
    children[key] = defaultEditableTagNode("String");
    currentNbtTagPath = joinNbtTagPath([...splitNbtTagPath(currentNbtTagPath), key]);
  } else if (type === "List") {
    const children = Array.isArray(node.value) ? node.value : [];
    node.value = children;
    const childType = normalizedEditableListItemType(node.itemType);
    children.push(defaultEditableTagNode(childType));
    currentNbtTagPath = joinNbtTagPath([...splitNbtTagPath(currentNbtTagPath), String(children.length - 1)]);
  } else {
    return { ok: false, reason: "Only Compound and List tags can contain child tags." };
  }
  setEditableNbtDocumentInEditor(doc);
  notifyNbtTagContext("tag-added");
  return { ok: true };
}

function deleteSelectedNbtTag() {
  if (currentNbtTagPath === "/") return { ok: false, reason: "The root tag cannot be deleted." };
  const doc = parseEditableNbtDocumentFromEditor();
  const resolved = resolveEditableNbtTag(doc, currentNbtTagPath);
  if (!resolved?.parentContainer) return { ok: false, reason: "Selected tag was not found." };
  const previousParentPath = parentNbtTagPath(currentNbtTagPath);
  if (Array.isArray(resolved.parentContainer)) {
    resolved.parentContainer.splice(Number(resolved.key), 1);
  } else {
    delete resolved.parentContainer[resolved.key];
  }
  currentNbtTagPath = previousParentPath;
  setEditableNbtDocumentInEditor(doc);
  notifyNbtTagContext("tag-deleted");
  return { ok: true };
}

function formatNbtTagDocument() {
  const doc = parseEditableNbtDocumentFromEditor();
  setEditableNbtDocumentInEditor(doc);
  notifyNbtTagContext("format");
  return { ok: true };
}

function installNbtTagEditorContext(filePath) {
  currentNbtTagPath = "/";
  const context = {
    id: "nbt-tags",
    title: "NBT Tag Properties",
    getState: getNbtTagEditorState,
    setSelectedTagPath(path) {
      currentNbtTagPath = String(path || "/");
      notifyNbtTagContext("selection");
    },
    updateSelectedTag(patch) {
      return applyNbtTagEditorPatch(patch);
    },
    addChild() {
      return addNbtTagChild();
    },
    deleteSelectedTag() {
      return deleteSelectedNbtTag();
    },
    formatTags() {
      return formatNbtTagDocument();
    },
    save(path = filePath) {
      return saveNbtCodeFile(path);
    },
    subscribe(listener) {
      if (typeof listener !== "function") return () => {};
      nbtTagContextListeners.add(listener);
      listener(getNbtTagEditorState());
      return () => nbtTagContextListeners.delete(listener);
    },
  };
  window.NBTTagEditorContext = context;
  window.dispatchEvent(new CustomEvent("nv-nbt-context-ready", { detail: getNbtTagEditorState() }));
  updateToolbarState({ nbtTagEditorActive: true, activeEditorFilePath: filePath, selectedFile: filePath });
}

function clearNbtTagEditorContext() {
  if (window.NBTTagEditorContext) delete window.NBTTagEditorContext;
  nbtTagContextListeners = new Set();
  currentNbtTagPath = "/";
  window.dispatchEvent(new CustomEvent("nv-nbt-context-cleared", { detail: { mode: "tags" } }));
  updateToolbarState({ nbtTagEditorActive: false });
}

function inferPreviewLanguage(filePath) {
  const lower = String(filePath || "").toLowerCase();
  if (lower.endsWith(".py")) return "python";
  if (lower.endsWith(".java")) return "java";
  if (lower.endsWith(".cpp")) return "cpp";
  return null;
}

function setPreviewOutput(text) {
  if (!previewOutputEl) return;
  previewOutputEl.textContent = text;
}

function setPreviewStatus(text) {
  if (!previewStatusEl) return;
  previewStatusEl.textContent = text;
}

async function runPreview(filePath) {
  const language = inferPreviewLanguage(filePath);
  if (!language) {
    alert("Preview Run supports .py, .java, .cpp files only.");
    return;
  }

  setPreviewStatus("Running preview...");
  setPreviewOutput("");

  try {
    const res = await fetch("/api/preview/run", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filePath,
        language,
        timeoutMs: 5000,
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data) {
      setPreviewStatus("Preview failed");
      setPreviewOutput(JSON.stringify(data || { error: "Preview failed" }, null, 2));
      return;
    }

    const lines = [];
    lines.push(`runner: ${data.runner || "local-dev"}`);
    lines.push(`ok: ${Boolean(data.ok)} timedOut: ${Boolean(data.timedOut)} exitCode: ${data.exitCode}`);

    if (data.stdout) {
      lines.push("");
      lines.push("=== stdout ===");
      lines.push(String(data.stdout));
    }
    if (data.stderr) {
      lines.push("");
      lines.push("=== stderr ===");
      lines.push(String(data.stderr));
    }

    setPreviewStatus("Preview complete");
    setPreviewOutput(lines.join("\n"));
  } catch (err) {
    setPreviewStatus("Preview error");
    setPreviewOutput(String(err?.message || err));
  }
}

/**
 * Opens or replaces a Code Editor panel in the active cell.
 */
export async function openCodeEditor(filePath) {
  if (!filePath) {
    alert("No file selected to open in Code Editor.");
    return;
  }

  // Code editor is not a publication-focused editor; hide word counter.
  setWordCountVisibility(false);

  const workspace = document.getElementById("workspace");
  if (!workspace) {
    console.error("[CodeEditor] Workspace not found!");
    return;
  }

  let targetCell = window.activeCell;

  // 🟥 No active cell selected
  if (!targetCell || !workspace.contains(targetCell)) {
    alert("Please click a panel before opening the Code Editor.");
    return;
  }

  console.log("[CodeEditor] Replacing active cell with Code Editor:", filePath);
  targetCell.dataset.currentFilePath = filePath;

  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.selectedFile = filePath;
  window.NodevisionState.activeEditorFilePath = filePath;
  window.NodevisionState.currentMode = "CodeEditing";
  window.NodevisionState.activeActionHandler = null;
  updateToolbarState({ currentMode: "CodeEditing", selectedFile: filePath, activeEditorFilePath: filePath, activeActionHandler: null });

  // 🧹 Clear existing content of the selected cell (but keep the element itself)
  targetCell.innerHTML = "";
  targetCell.dataset.id = "CodeEditorPanel";

  // 🧩 Create header + editor container
  const header = document.createElement("div");
  header.className = "panel-header";
  header.textContent = `Code Editor — ${filePath}`;
  Object.assign(header.style, {
    padding: "4px",
    background: "#e0e0e0",
    borderBottom: "1px solid #ccc",
    fontWeight: "bold",
    display: "flex",
    alignItems: "center",
    gap: "8px",
  });

  const headerSpacer = document.createElement("div");
  headerSpacer.style.flex = "1";
  header.appendChild(headerSpacer);

  const previewBtn = document.createElement("button");
  previewBtn.textContent = "Preview Run";
  previewBtn.onclick = () => runPreview(filePath);
  header.appendChild(previewBtn);

  const clearBtn = document.createElement("button");
  clearBtn.textContent = "Clear Output";
  clearBtn.onclick = () => {
    setPreviewStatus("");
    setPreviewOutput("");
  };
  header.appendChild(clearBtn);

  previewStatusEl = document.createElement("span");
  previewStatusEl.style.fontWeight = "normal";
  previewStatusEl.style.opacity = "0.8";
  header.appendChild(previewStatusEl);

  editorContainer = document.createElement("div");
  editorContainer.className = "monaco-editor-container";
  Object.assign(editorContainer.style, {
    flex: "1",
    position: "relative",
    width: "100%",
    height: "100%",
  });

  // 🧩 Assemble cell
  targetCell.appendChild(header);
  targetCell.appendChild(editorContainer);
  const outputWrap = document.createElement("div");
  Object.assign(outputWrap.style, {
    borderTop: "1px solid #ccc",
    background: "#0b1020",
    color: "#d6e2ff",
    fontFamily: "monospace",
    fontSize: "12px",
    padding: "8px",
    maxHeight: "180px",
    overflow: "auto",
    whiteSpace: "pre-wrap",
  });
  previewOutputEl = outputWrap;
  targetCell.appendChild(outputWrap);
  targetCell.style.display = "flex";
  targetCell.style.flexDirection = "column";

  // 🪄 Load file content
  await updateEditorPanel(filePath);
}

/**
 * Loads the file into the Monaco editor.
 */
function hasLiveEditorForPath(filePath) {
  const editorDom = editorInstance?.getDomNode?.();
  const model = editorInstance?.getModel?.();
  return Boolean(
    filePath &&
    editorInstance &&
    model &&
    editorContainer &&
    editorContainer.isConnected &&
    editorInstanceContainer === editorContainer &&
    editorDom &&
    editorContainer.contains(editorDom) &&
    normalizeEditorPath(lastEditedPath) === normalizeEditorPath(filePath)
  );
}

export async function updateEditorPanel(filePath) {
  if (!filePath) return;
  if (normalizeEditorPath(filePath) === normalizeEditorPath(lastEditedPath) && hasLiveEditorForPath(filePath)) return;
  const loadRequestId = ++editorLoadRequestId;
  pendingEditedPath = filePath;

  console.log("📝 Loading file in editor:", filePath);

  try {
    if (isNbtFilePath(filePath)) {
      const nbtData = await loadNbtCodeContent(filePath);
      if (!isLatestEditorLoad(loadRequestId, filePath)) {
        console.warn("[CodeEditor] Ignoring stale NBT load for:", filePath);
        return;
      }
      currentLoadedEncoding = "utf8";
      currentLoadedBom = false;
      currentLoadedIsBinary = false;
      currentLoadedFileFormat = "nbt";
      currentLoadedNbtWasGzip = nbtData.gzip;
      window.currentFileEncoding = currentLoadedEncoding;
      window.currentFileBom = currentLoadedBom;
      initializeMonaco(filePath, nbtData.content, loadRequestId);
      return;
    }

    currentLoadedFileFormat = "text";
    currentLoadedNbtWasGzip = false;
    clearNbtTagEditorContext();

    const res = await fetch(`/api/fileCodeContent?path=${encodeURIComponent(filePath)}`);
    if (!res.ok) throw new Error(`Failed to load file: ${res.status}`);
    const data = await res.json();
    if (!isLatestEditorLoad(loadRequestId, filePath)) {
      console.warn("[CodeEditor] Ignoring stale file load for:", filePath);
      return;
    }
    currentLoadedEncoding = data.encoding || "utf8";
    currentLoadedBom = Boolean(data.bom);
    currentLoadedIsBinary = Boolean(data.isBinary);
    window.currentFileEncoding = currentLoadedEncoding;
    window.currentFileBom = currentLoadedBom;
    initializeMonaco(filePath, data.content, loadRequestId);
  } catch (err) {
    if (!isLatestEditorLoad(loadRequestId, filePath)) {
      console.warn("[CodeEditor] Ignoring stale load error for:", filePath, err);
      return;
    }
    console.error("[CodeEditor] Error loading file:", err);
    if (editorContainer)
      editorContainer.innerHTML = `<pre style="color:red;">${err.message}</pre>`;
  }
}

/**
 * Initializes Monaco Editor inside the existing editorContainer.
 */
function toggleEditorWordWrap(editor = editorInstance) {
  if (!editor?.getOption || !editor?.updateOptions) return;
  const isWrapped = editor.getOption(monaco.editor.EditorOption.wordWrap) === "on";
  const nextWordWrap = isWrapped ? "off" : "on";
  editor.updateOptions({ wordWrap: nextWordWrap });
  setStatus(nextWordWrap === "on" ? "Code editor word wrap on." : "Code editor word wrap off.");
}

function initializeMonaco(filePath, content, loadRequestId = editorLoadRequestId) {
  const targetContainer = editorContainer;
  if (!targetContainer) {
    console.error("[CodeEditor] Editor container not found.");
    return;
  }
  if (!isLatestEditorLoad(loadRequestId, filePath)) {
    console.warn("[CodeEditor] Skipping stale Monaco initialization for:", filePath);
    return;
  }

  // 1. Clean up existing editor instance
  if (editorInstance) {
    editorInstance.dispose();
    editorInstance = null;
  }
  editorInstanceContainer = null;
  commonVarOverlay = null;
  savedVersionId = null;
  if (window.monacoEditor && window.monacoEditor !== editorInstance) window.monacoEditor = null;

  if (typeof require === "undefined") {
    targetContainer.innerHTML = "<p style='color:red;'>Monaco Editor not loaded.</p>";
    return;
  }

  // 2. Configure and load Monaco
  require.config({ paths: { vs: "/lib/monaco/vs" } });

  window.MonacoEnvironment = {
    getWorker(moduleId, label) {
      const base = window.location.origin + "/lib/monaco/vs/";
      const paths = {
        json: base + "language/json/json.worker.js",
        css: base + "language/css/css.worker.js",
        html: base + "language/html/html.worker.js",
        typescript: base + "language/typescript/ts.worker.js",
        javascript: base + "language/typescript/ts.worker.js",
      };
      return new Worker(paths[label] || base + "editor/editor.worker.js", { type: "module" });
    },
  };

  require(["vs/editor/editor.main"], function () {
    if (editorContainer !== targetContainer || !targetContainer.isConnected || !isLatestEditorLoad(loadRequestId, filePath)) {
      console.warn("[CodeEditor] Ignoring stale Monaco initialization for:", filePath);
      return;
    }

    // 3. Create the editor instance
    editorInstance = monaco.editor.create(targetContainer, {
      value: content || "",
      language: detectLanguage(filePath),
      theme: "vs-dark",
      automaticLayout: true,
      folding: true,
      foldingHighlight: true,
      wordWrap: "off",
    });

    // 4. Register globals for the SaveFile.mjs router
    // These variables are critical for the main save function to recognize the active editor.
    editorInstanceContainer = targetContainer;
    window.monacoEditor = editorInstance;
    window.currentActiveFilePath = filePath;
    window.currentFileEncoding = currentLoadedEncoding;
    window.currentFileBom = currentLoadedBom;
    if (currentLoadedFileFormat === "nbt") {
      window.saveCodeFile = saveNbtCodeFile;
      window.__nvCodeEditorSaveFormat = "nbt";
      installNbtTagEditorContext(filePath);
      setStatus("NBT", "Tags loaded as editable JSON");
    } else if (window.__nvCodeEditorSaveFormat === "nbt") {
      window.saveCodeFile = null;
      window.__nvCodeEditorSaveFormat = null;
      clearNbtTagEditorContext();
    }
    console.log("🧠 Monaco editor registered globally for saving:", filePath);

    if (currentLoadedIsBinary) {
      console.warn(`[CodeEditor] "${filePath}" looks binary; text rendering may be lossy.`);
    }

    // 5. Add Keyboard Shortcut Listener (The Fix!)
    // We use Monaco's built-in command system to listen for Ctrl+S / Cmd+S.
    editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, function() {
        // Monaco handles preventing browser default when command is registered.
        saveCurrentFile({ path: filePath });
    });

    // Folding markers (#region / #endregion) across common languages
    configureFoldingMarkers();

    // Quick fold/unfold actions for current region
    editorInstance.addAction({
      id: "nv.foldHere",
      label: "Fold Region Here",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.BracketLeft],
      run: () => editorInstance.getAction("editor.fold")?.run(),
    });
    editorInstance.addAction({
      id: "nv.unfoldHere",
      label: "Unfold Region Here",
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Alt | monaco.KeyCode.BracketRight],
      run: () => editorInstance.getAction("editor.unfold")?.run(),
    });
    editorInstance.addAction({
      id: "nv.foldAllRegions",
      label: "Fold All Marker Regions",
      run: () => editorInstance.getAction("editor.foldAllMarkerRegions")?.run(),
    });

    editorInstance.addAction({
      id: "nv.toggleWordWrap",
      label: "Toggle Word Wrap",
      keybindings: [monaco.KeyMod.Alt | monaco.KeyCode.KeyZ],
      run: () => toggleEditorWordWrap(editorInstance),
    });

    // Ctrl/Cmd+F: show common identifiers helper + default find
    editorInstance.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyF, () => {
      showCommonVarOverlay();
      editorInstance.getAction("actions.find")?.run();
    });

    // Keep overlay data fresh as user types
    editorInstance.onDidChangeModelContent(() => {
      if (commonVarOverlay?.style.display === "block") {
        refreshCommonVarOverlay();
      }
      updateDirtyState();
      if (currentLoadedFileFormat === "nbt") notifyNbtTagContext("content");
    });

    const model = editorInstance.getModel();
    savedVersionId = model?.getAlternativeVersionId?.() || null;
    window.__nvCodeEditorDirty = false;
    window.__nvCodeEditorActivePath = filePath;
    lastEditedPath = filePath;

    window.addEventListener("nodevision-file-saved", (evt) => {
      const savedPath = evt?.detail?.filePath;
      if (!savedPath || savedPath !== window.__nvCodeEditorActivePath) return;
      markEditorClean();
    });

  });
}

/**
 * Detects language from file extension.
 */
function detectLanguage(filePath) {
  const ext = filePath.split(".").pop().toLowerCase();
  return (
    {
      js: "javascript",
      mjs: "javascript",
      ts: "typescript",
      html: "html",
      css: "css",
      json: "json",
      nbt: "json",
      py: "python",
      cpp: "cpp",
      cc: "cpp",
      h: "cpp",
      hpp: "cpp",
    }[ext] || "plaintext"
  );
}

function configureFoldingMarkers() {
  const markers = {
    start: /^\s*#region\b/i,
    end: /^\s*#endregion\b/i,
  };
  ["javascript", "typescript", "html", "css", "python", "cpp", "json", "plaintext"].forEach((lang) => {
    try {
      monaco.languages.setLanguageConfiguration(lang, { folding: { markers } });
    } catch (err) {
      console.warn("Folding marker config failed for", lang, err);
    }
  });
}

function collectCommonIdentifiers(model, max = 8) {
  if (!model) return [];
  const text = model.getValue();
  const re = /\b[A-Za-z_][A-Za-z0-9_]*\b/g;
  const counts = new Map();
  const keywords = new Set([
    "function","return","const","let","var","if","else","for","while","switch","case","break","continue",
    "class","extends","import","from","export","default","try","catch","finally","throw","new","this",
    "true","false","null","undefined","async","await","def","lambda","pass","None","in","and","or","not",
    "int","float","double","char","void","public","private","protected","static","final","enum","struct"
  ]);
  let m;
  while ((m = re.exec(text)) !== null) {
    const word = m[0];
    if (keywords.has(word)) continue;
    counts.set(word, (counts.get(word) || 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([name, count]) => ({ name, count }));
}

function ensureCommonVarOverlay() {
  if (commonVarOverlay) return commonVarOverlay;
  const div = document.createElement("div");
  commonVarOverlay = div;
  Object.assign(div.style, {
    position: "absolute",
    top: "8px",
    right: "8px",
    background: "rgba(20,20,20,0.9)",
    color: "#fff",
    padding: "8px",
    borderRadius: "6px",
    boxShadow: "0 4px 14px rgba(0,0,0,0.35)",
    fontSize: "12px",
    display: "none",
    maxWidth: "260px",
    zIndex: 50,
  });
  const title = document.createElement("div");
  title.textContent = "Common identifiers (click to jump)";
  title.style.fontWeight = "700";
  title.style.marginBottom = "6px";
  div.appendChild(title);

  const list = document.createElement("div");
  list.id = "nv-common-var-list";
  list.style.display = "grid";
  list.style.gridTemplateColumns = "repeat(auto-fit, minmax(90px, 1fr))";
  list.style.gap = "6px";
  div.appendChild(list);

  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "×";
  Object.assign(close.style, {
    position: "absolute",
    top: "4px",
    right: "6px",
    background: "transparent",
    color: "#fff",
    border: "none",
    fontSize: "14px",
    cursor: "pointer",
  });
  close.addEventListener("click", () => {
    commonVarOverlay.style.display = "none";
  });
  div.appendChild(close);

  editorContainer.appendChild(div);
  return div;
}

function refreshCommonVarOverlay() {
  if (!editorInstance || !commonVarOverlay) return;
  const list = commonVarOverlay.querySelector("#nv-common-var-list");
  if (!list) return;
  commonVarData = collectCommonIdentifiers(editorInstance.getModel());
  list.innerHTML = "";
  if (!commonVarData.length) {
    const empty = document.createElement("div");
    empty.textContent = "No identifiers yet.";
    empty.style.opacity = "0.8";
    list.appendChild(empty);
    return;
  }
  commonVarData.forEach(({ name, count }) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.textContent = `${name} (${count})`;
    Object.assign(btn.style, {
      padding: "4px 6px",
      border: "1px solid #444",
      background: "#1e1e1e",
      color: "#fff",
      borderRadius: "4px",
      cursor: "pointer",
      textAlign: "left",
    });
    btn.addEventListener("click", () => jumpToIdentifier(name));
    list.appendChild(btn);
  });
}

function jumpToIdentifier(name) {
  if (!editorInstance || !name) return;
  const model = editorInstance.getModel();
  if (!model) return;
  const matches = model.findMatches(name, true, false, false, null, true);
  if (!matches.length) return;
  const pos = matches[0].range;
  editorInstance.setSelection(pos);
  editorInstance.revealRangeInCenter(pos);
  commonVarOverlay.style.display = "none";
}

function showCommonVarOverlay() {
  ensureCommonVarOverlay();
  refreshCommonVarOverlay();
  commonVarOverlay.style.display = "block";
}

function updateDirtyState() {
  const model = editorInstance?.getModel?.();
  if (!model) return;
  const currentId = model.getAlternativeVersionId?.();
  window.__nvCodeEditorDirty = savedVersionId !== null && currentId !== savedVersionId;
}

function markEditorClean() {
  const model = editorInstance?.getModel?.();
  if (!model) return;
  savedVersionId = model.getAlternativeVersionId?.() || null;
  window.__nvCodeEditorDirty = false;
}

function ensureUnsavedPrompt() {
  if (unsavedPromptEl) return unsavedPromptEl;
  const backdrop = document.createElement("div");
  Object.assign(backdrop.style, {
    position: "fixed",
    inset: "0",
    background: "rgba(0,0,0,0.35)",
    display: "none",
    zIndex: "1199",
  });

  const panel = document.createElement("div");
  panel.className = "panel overlay";
  panel.dataset.instanceName = "UnsavedPrompt";
  panel.dataset.panelClass = "InfoPanel";
  Object.assign(panel.style, {
    position: "fixed",
    top: `${Math.max(56, (window.__nvGlobalToolbarHeight || 64))}px`,
    left: "50%",
    transform: "translateX(-50%)",
    width: "min(520px, 92vw)",
    maxHeight: "80vh",
    zIndex: "1200",
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 14px 40px rgba(0,0,0,0.3)",
  });

  const header = document.createElement("div");
  header.className = "panel-header";
  header.textContent = "Unsaved changes";
  header.style.display = "flex";
  header.style.justifyContent = "space-between";
  header.style.alignItems = "center";
  header.style.padding = "8px 10px";
  header.style.background = "#e2e8f0";
  header.style.fontWeight = "700";

  const closeBtn = document.createElement("button");
  closeBtn.textContent = "×";
  Object.assign(closeBtn.style, {
    border: "none",
    background: "transparent",
    fontSize: "16px",
    cursor: "pointer",
  });
  header.appendChild(closeBtn);

  const content = document.createElement("div");
  content.className = "panel-content";
  Object.assign(content.style, {
    padding: "14px 14px 10px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  });

  const message = document.createElement("div");
  message.id = "nv-unsaved-message";
  message.style.fontSize = "14px";
  content.appendChild(message);

  const buttons = document.createElement("div");
  Object.assign(buttons.style, {
    display: "flex",
    gap: "10px",
    justifyContent: "flex-end",
    marginTop: "4px",
  });
  const cancelBtn = document.createElement("button");
  cancelBtn.textContent = "Cancel";
  const discardBtn = document.createElement("button");
  discardBtn.textContent = "Discard";
  const saveBtn = document.createElement("button");
  saveBtn.textContent = "Save";
  [cancelBtn, discardBtn, saveBtn].forEach((btn) => {
    Object.assign(btn.style, {
      padding: "9px 14px",
      borderRadius: "8px",
      border: "1px solid #cbd5e1",
      background: "#fff",
      cursor: "pointer",
      fontWeight: "600",
    });
  });
  saveBtn.style.background = "#2563eb";
  saveBtn.style.color = "#fff";
  buttons.append(cancelBtn, discardBtn, saveBtn);
  content.appendChild(buttons);

  panel.appendChild(header);
  panel.appendChild(content);

  const mount = document.body;
  mount.appendChild(backdrop);
  mount.appendChild(panel);

  unsavedPromptEl = panel;
  panel._backdrop = backdrop;
  panel._setHandlers = (handlers = {}) => {
    const close = () => panel._hide();
    closeBtn.onclick = handlers.onCancel || close;
    cancelBtn.onclick = handlers.onCancel || close;
    discardBtn.onclick = handlers.onDiscard || close;
    saveBtn.onclick = handlers.onSave || close;
  };
  panel._setMessage = (text) => {
    message.textContent = text;
  };
  panel._show = () => {
    backdrop.style.display = "block";
    panel.style.display = "flex";
    unsavedPromptOpen = true;
  };
  panel._hide = () => {
    backdrop.style.display = "none";
    panel.style.display = "none";
    unsavedPromptOpen = false;
  };
  return panel;
}

function isCodeEditorActive() {
  const activePanel = (window.activePanel || window.NodevisionState?.activePanelType || "").toLowerCase();
  return activePanel.includes("codeeditor") || !!document.querySelector('[data-id="CodeEditorPanel"]');
}

function guardFileSwitch(nextPath, proceed) {
  if (!isCodeEditorActive()) {
    proceed();
    return;
  }
  if (!window.__nvCodeEditorDirty) {
    proceed();
    return;
  }

  const prompt = ensureUnsavedPrompt();
  prompt._setMessage(`Save changes to ${window.__nvCodeEditorActivePath || "current file"}?`);
  prompt._setHandlers({
    onCancel: () => prompt._hide(),
    onDiscard: () => {
      prompt._hide();
      proceed();
    },
    onSave: async () => {
      try {
        await saveCurrentFile({ path: window.__nvCodeEditorActivePath });
        markEditorClean();
        prompt._hide();
        proceed();
      } catch (err) {
        alert(`Save failed: ${err?.message || err}`);
      }
    },
  });
  prompt._show();
}

if (typeof window !== "undefined") {
  window.__nvGuardFileSwitch = guardFileSwitch;
  window.isCodeEditorDirty = () => Boolean(window.__nvCodeEditorDirty);
  window.isCodeEditorActive = isCodeEditorActive;
}

/**
 * Integrates with panelManager.mjs to allow the Code Editor to be loaded as a panel.
 */
export async function setupPanel(panelElem, panelVars = {}) {
  console.log("[CodeEditor] setupPanel() invoked from panelManager.");

  // Determine file to open (if passed)
  const filePath = panelVars.filePath || panelVars.path || window.selectedFilePath || null;

  // Treat this panelElem as the active cell
  window.activeCell = panelElem;

  // Now reuse your existing logic
  await openCodeEditor(filePath || "Untitled");
}

// Expose globally
window.openCodeEditor = openCodeEditor;
window.updateEditorPanel = updateEditorPanel;
