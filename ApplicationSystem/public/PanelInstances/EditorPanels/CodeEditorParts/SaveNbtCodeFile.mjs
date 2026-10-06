// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/CodeEditorParts/SaveNbtCodeFile.mjs
// This module implements save nbt code file operations for CodeEditor, preserving the existing document and instance ownership contracts.

import { moduleState, TAG_STRING } from "./ModuleState.mjs";
import { editableJsonToNbt, gzipNbtBuffer, arrayBufferToBase64, tagNameFromId, tagIdFromName } from "./TagIdFromName.mjs";
import { serializeNBT } from "../../ViewPanels/FileViewers/ViewNBT/serializeNBT.mjs";
import { markEditorClean, updateDirtyState } from "./ShowCommonVarOverlay.mjs";
import { setStatus } from "/StatusBar.mjs";

export async function saveNbtCodeFile(path = window.__nvCodeEditorActivePath || window.currentActiveFilePath) {
  if (!moduleState.editorInstance?.getValue) throw new Error("NBT code editor is not ready.");
  const root = editableJsonToNbt(moduleState.editorInstance.getValue());
  let buffer = serializeNBT(root);
  if (moduleState.currentLoadedNbtWasGzip) buffer = await gzipNbtBuffer(buffer);
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

export const NBT_TAG_EDITOR_TYPES = [
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

export function normalizedEditableTagType(type, fallback = "String") {
  return tagNameFromId(tagIdFromName(type, tagIdFromName(fallback, TAG_STRING)));
}

export function normalizedEditableListItemType(type) {
  const normalized = normalizedEditableTagType(type, "String");
  return normalized === "End" ? "String" : normalized;
}

export function escapeNbtTagPathPart(part) {
  return String(part).replace(/~/g, "~0").replace(/\//g, "~1");
}

export function unescapeNbtTagPathPart(part) {
  return String(part).replace(/~1/g, "/").replace(/~0/g, "~");
}

export function splitNbtTagPath(path = "/") {
  const clean = String(path || "/");
  if (clean === "/") return [];
  return clean.replace(/^\//, "").split("/").map(unescapeNbtTagPathPart);
}

export function joinNbtTagPath(parts = []) {
  return parts.length ? "/" + parts.map(escapeNbtTagPathPart).join("/") : "/";
}

export function parentNbtTagPath(path = "/") {
  const parts = splitNbtTagPath(path);
  parts.pop();
  return joinNbtTagPath(parts);
}

export function labelNbtTagPath(path = "/") {
  const parts = splitNbtTagPath(path);
  return parts.length ? `root/${parts.join("/")}` : "root";
}

export function defaultEditableTagValue(type) {
  const normalized = normalizedEditableTagType(type, "String");
  if (normalized === "Compound") return {};
  if (normalized === "List" || normalized.endsWith("_Array")) return [];
  if (normalized === "String") return "";
  if (normalized === "Long") return "0";
  return 0;
}

export function ensureEditableTagNode(node, fallbackType = "String") {
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

export function defaultEditableTagNode(type = "String") {
  const normalized = normalizedEditableTagType(type, "String");
  const node = { type: normalized, value: defaultEditableTagValue(normalized) };
  if (normalized === "List") node.itemType = "String";
  return node;
}

export function normalizeEditableNbtDocument(doc) {
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

export function parseEditableNbtDocumentFromEditor() {
  const text = moduleState.editorInstance?.getValue?.() || "{}";
  return normalizeEditableNbtDocument(JSON.parse(text));
}

export function setEditableNbtDocumentInEditor(doc) {
  if (!moduleState.editorInstance?.setValue) return;
  moduleState.editorInstance.setValue(JSON.stringify(normalizeEditableNbtDocument(doc), null, 2) + "\n");
  updateDirtyState();
}

export function collectEditableNbtTagPaths(node, path = "/", out = []) {
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
