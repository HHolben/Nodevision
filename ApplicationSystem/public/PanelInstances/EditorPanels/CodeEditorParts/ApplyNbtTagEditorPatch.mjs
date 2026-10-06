// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/CodeEditorParts/ApplyNbtTagEditorPatch.mjs
// This module implements apply nbt tag editor patch operations for CodeEditor, preserving the existing document and instance ownership contracts.

import { parseEditableNbtDocumentFromEditor, ensureEditableTagNode, splitNbtTagPath, joinNbtTagPath, normalizedEditableTagType, setEditableNbtDocumentInEditor, defaultEditableTagNode, normalizedEditableListItemType, parentNbtTagPath, saveNbtCodeFile } from "./SaveNbtCodeFile.mjs";
import { resolveEditableNbtTag, retagEditableNbtNode, coerceEditableTagValue, notifyNbtTagContext, nextCompoundChildName, getNbtTagEditorState } from "./ResolveEditableNbtTag.mjs";
import { moduleState } from "./ModuleState.mjs";
import { updateToolbarState } from "/panels/createToolbar.mjs";

export function applyNbtTagEditorPatch(patch = {}) {
  const doc = parseEditableNbtDocumentFromEditor();
  if (patch.rootName !== undefined) doc.rootName = String(patch.rootName || "");
  if (patch.littleEndian !== undefined) doc.littleEndian = Boolean(patch.littleEndian);
  const resolved = resolveEditableNbtTag(doc, moduleState.currentNbtTagPath) || resolveEditableNbtTag(doc, "/");
  if (!resolved) return { ok: false, reason: "Selected tag was not found." };
  let node = ensureEditableTagNode(resolved.node, moduleState.currentNbtTagPath === "/" ? "Compound" : "String");
  let nextPath = moduleState.currentNbtTagPath;
  if (moduleState.currentNbtTagPath !== "/" && patch.name !== undefined && resolved.parent?.type === "Compound") {
    const nextName = String(patch.name || "").trim();
    if (!nextName) return { ok: false, reason: "Tag name is required." };
    if (nextName !== resolved.key && Object.prototype.hasOwnProperty.call(resolved.parentContainer, nextName)) {
      return { ok: false, reason: `A tag named "${nextName}" already exists here.` };
    }
    if (nextName !== resolved.key) {
      delete resolved.parentContainer[resolved.key];
      resolved.parentContainer[nextName] = node;
      const parts = splitNbtTagPath(moduleState.currentNbtTagPath);
      parts[parts.length - 1] = nextName;
      nextPath = joinNbtTagPath(parts);
    }
  }
  if (patch.type !== undefined && moduleState.currentNbtTagPath !== "/") node = retagEditableNbtNode(node, patch.type);
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
  if (moduleState.currentNbtTagPath === "/") {
    doc.root = node;
    doc.root.type = "Compound";
  } else if (Array.isArray(resolved.parentContainer)) {
    resolved.parentContainer[Number(resolved.key)] = node;
  } else {
    const nextParts = splitNbtTagPath(nextPath);
    const lastKey = nextParts[nextParts.length - 1];
    resolved.parentContainer[lastKey] = node;
  }
  moduleState.currentNbtTagPath = nextPath;
  setEditableNbtDocumentInEditor(doc);
  notifyNbtTagContext("tag-updated");
  return { ok: true };
}

export function addNbtTagChild() {
  const doc = parseEditableNbtDocumentFromEditor();
  const resolved = resolveEditableNbtTag(doc, moduleState.currentNbtTagPath) || resolveEditableNbtTag(doc, "/");
  if (!resolved) return { ok: false, reason: "Selected tag was not found." };
  const node = ensureEditableTagNode(resolved.node, "Compound");
  const type = normalizedEditableTagType(node.type);
  if (type === "Compound") {
    const children = node.value && typeof node.value === "object" && !Array.isArray(node.value) ? node.value : {};
    node.value = children;
    const key = nextCompoundChildName(children);
    children[key] = defaultEditableTagNode("String");
    moduleState.currentNbtTagPath = joinNbtTagPath([...splitNbtTagPath(moduleState.currentNbtTagPath), key]);
  } else if (type === "List") {
    const children = Array.isArray(node.value) ? node.value : [];
    node.value = children;
    const childType = normalizedEditableListItemType(node.itemType);
    children.push(defaultEditableTagNode(childType));
    moduleState.currentNbtTagPath = joinNbtTagPath([...splitNbtTagPath(moduleState.currentNbtTagPath), String(children.length - 1)]);
  } else {
    return { ok: false, reason: "Only Compound and List tags can contain child tags." };
  }
  setEditableNbtDocumentInEditor(doc);
  notifyNbtTagContext("tag-added");
  return { ok: true };
}

export function deleteSelectedNbtTag() {
  if (moduleState.currentNbtTagPath === "/") return { ok: false, reason: "The root tag cannot be deleted." };
  const doc = parseEditableNbtDocumentFromEditor();
  const resolved = resolveEditableNbtTag(doc, moduleState.currentNbtTagPath);
  if (!resolved?.parentContainer) return { ok: false, reason: "Selected tag was not found." };
  const previousParentPath = parentNbtTagPath(moduleState.currentNbtTagPath);
  if (Array.isArray(resolved.parentContainer)) {
    resolved.parentContainer.splice(Number(resolved.key), 1);
  } else {
    delete resolved.parentContainer[resolved.key];
  }
  moduleState.currentNbtTagPath = previousParentPath;
  setEditableNbtDocumentInEditor(doc);
  notifyNbtTagContext("tag-deleted");
  return { ok: true };
}

export function formatNbtTagDocument() {
  const doc = parseEditableNbtDocumentFromEditor();
  setEditableNbtDocumentInEditor(doc);
  notifyNbtTagContext("format");
  return { ok: true };
}

export function installNbtTagEditorContext(filePath) {
  moduleState.currentNbtTagPath = "/";
  const context = {
    id: "nbt-tags",
    title: "NBT Tag Properties",
    getState: getNbtTagEditorState,
    setSelectedTagPath(path) {
      moduleState.currentNbtTagPath = String(path || "/");
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
      moduleState.nbtTagContextListeners.add(listener);
      listener(getNbtTagEditorState());
      return () => moduleState.nbtTagContextListeners.delete(listener);
    },
  };
  window.NBTTagEditorContext = context;
  window.dispatchEvent(new CustomEvent("nv-nbt-context-ready", { detail: getNbtTagEditorState() }));
  updateToolbarState({ nbtTagEditorActive: true, activeEditorFilePath: filePath, selectedFile: filePath });
}

export function clearNbtTagEditorContext() {
  if (window.NBTTagEditorContext) delete window.NBTTagEditorContext;
  moduleState.nbtTagContextListeners = new Set();
  moduleState.currentNbtTagPath = "/";
  window.dispatchEvent(new CustomEvent("nv-nbt-context-cleared", { detail: { mode: "tags" } }));
  updateToolbarState({ nbtTagEditorActive: false });
}

export function inferPreviewLanguage(filePath) {
  const lower = String(filePath || "").toLowerCase();
  if (lower.endsWith(".py")) return "python";
  if (lower.endsWith(".java")) return "java";
  if (lower.endsWith(".cpp")) return "cpp";
  return null;
}
