// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/CodeEditorParts/ResolveEditableNbtTag.mjs
// This module implements resolve editable nbt tag operations for CodeEditor, preserving the existing document and instance ownership contracts.

import { normalizeEditableNbtDocument, splitNbtTagPath, ensureEditableTagNode, normalizedEditableTagType, normalizedEditableListItemType, parseEditableNbtDocumentFromEditor, collectEditableNbtTagPaths, NBT_TAG_EDITOR_TYPES, labelNbtTagPath, defaultEditableTagValue } from "./SaveNbtCodeFile.mjs";
import { moduleState } from "./ModuleState.mjs";

export function resolveEditableNbtTag(doc, path = "/") {
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

export function coerceEditableTagValue(type, value) {
  const normalized = normalizedEditableTagType(type, "String");
  if (normalized === "Compound") return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  if (normalized === "List" || normalized.endsWith("_Array")) return Array.isArray(value) ? value : [];
  if (normalized === "String") return String(value ?? "");
  if (normalized === "Long") return String(value ?? "0");
  if (normalized === "Float" || normalized === "Double") return Number(value) || 0;
  return Math.trunc(Number(value) || 0);
}

export function retagEditableNbtNode(node, nextType) {
  const type = normalizedEditableTagType(nextType, "String");
  const current = ensureEditableTagNode(node, type);
  const next = { type, value: coerceEditableTagValue(type, current.value) };
  if (type === "List") next.itemType = normalizedEditableListItemType(current.itemType);
  return next;
}

export function nextCompoundChildName(children, base = "newTag") {
  let candidate = base;
  let index = 1;
  while (Object.prototype.hasOwnProperty.call(children, candidate)) {
    candidate = `${base}${index}`;
    index += 1;
  }
  return candidate;
}

export function getNbtTagEditorState() {
  if (moduleState.currentLoadedFileFormat !== "nbt" || !moduleState.editorInstance?.getValue) {
    return { id: "nbt-tags", title: "NBT Tag Properties", error: "Open an NBT file in the code editor to edit tags." };
  }
  try {
    const doc = parseEditableNbtDocumentFromEditor();
    const paths = collectEditableNbtTagPaths(doc.root);
    if (!paths.some((entry) => entry.path === moduleState.currentNbtTagPath)) moduleState.currentNbtTagPath = "/";
    const resolved = resolveEditableNbtTag(doc, moduleState.currentNbtTagPath) || resolveEditableNbtTag(doc, "/");
    const node = ensureEditableTagNode(resolved?.node, moduleState.currentNbtTagPath === "/" ? "Compound" : "String");
    const type = normalizedEditableTagType(node.type);
    const pathParts = splitNbtTagPath(moduleState.currentNbtTagPath);
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
      selectedPath: moduleState.currentNbtTagPath,
      selectedTag: {
        path: moduleState.currentNbtTagPath,
        label: labelNbtTagPath(moduleState.currentNbtTagPath),
        name: tagName,
        type,
        itemType: type === "List" ? normalizedEditableListItemType(node.itemType) : "String",
        valueText: JSON.stringify(node.value ?? defaultEditableTagValue(type), null, 2),
        canRename: moduleState.currentNbtTagPath !== "/" && resolved?.parent?.type === "Compound",
        canDelete: moduleState.currentNbtTagPath !== "/",
        canAddChild: type === "Compound" || type === "List",
      },
    };
  } catch (err) {
    return {
      id: "nbt-tags",
      title: "NBT Tag Properties",
      filePath: window.__nvCodeEditorActivePath || window.currentActiveFilePath || "",
      error: err?.message || "Invalid NBT tag JSON.",
      selectedPath: moduleState.currentNbtTagPath,
      paths: [],
      tagTypes: [...NBT_TAG_EDITOR_TYPES],
    };
  }
}

export function notifyNbtTagContext(reason = "change") {
  if (moduleState.currentLoadedFileFormat !== "nbt") return;
  const state = getNbtTagEditorState();
  for (const listener of moduleState.nbtTagContextListeners) listener(state);
  window.dispatchEvent(new CustomEvent("nv-nbt-context-changed", { detail: { ...state, reason } }));
}
