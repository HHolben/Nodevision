// Nodevision/ApplicationSystem/public/PanelInstances/Common/ImageMap/HtmlImageMapAdapter.mjs
// This module adapts the reusable image-map editor to the active graphical HTML/WYSIWYG editor surface.

import { updateToolbarState } from "/panels/createToolbar.mjs";
import { openNodevisionOverlayPanel } from "/TemplateSystem/NodevisionOverlayPanel.mjs";
import { normalizeNotebookFilePath } from "/utils/notebookPath.mjs";
import {
  applyImageMapModelToElements,
  findMapForImage,
  mapNameFromUsemap,
  parseImageMapFromElements,
  serializeImageMap,
} from "./ImageMapSerialization.mjs";
import { normalizeImageMapModel, uniqueImageMapName } from "./ImageMapModel.mjs";

// ------------------------------
// Active editor helpers
// ------------------------------
function activeHtmlRoot() {
  return window.HTMLWysiwygTools?.getEditorElement?.() ||
    document.querySelector("#wysiwyg[contenteditable='true']");
}

function currentEditorPath() {
  const candidates = [
    window.NodevisionState?.activeEditorFilePath,
    window.__nvHtmlEditorActivePath,
    window.__nvWysiwygActivePath,
    window.currentActiveFilePath,
    window.selectedFilePath,
    window.filePath,
    window.NodevisionState?.selectedFile,
  ];
  for (const value of candidates) {
    const normalized = normalizeNotebookFilePath(value || "");
    if (normalized) return normalized;
  }
  return "";
}

function selectedImage(root) {
  const active = window.NodevisionState?.activeHtmlImageContext?.element;
  if (active instanceof HTMLImageElement && root.contains(active)) return active;
  const marked = root.querySelector("img.nv-selected-image");
  if (marked instanceof HTMLImageElement) return marked;
  const selection = window.getSelection?.();
  const node = selection?.rangeCount ? selection.getRangeAt(0).commonAncestorContainer : null;
  const element = node?.nodeType === Node.TEXT_NODE ? node.parentElement : node;
  const selected = element?.closest?.("img");
  return selected instanceof HTMLImageElement && root.contains(selected) ? selected : null;
}

function imageByMapName(root, mapName = "") {
  return Array.from(root.querySelectorAll("img[usemap]"))
    .find((img) => mapNameFromUsemap(img.getAttribute("usemap") || "") === mapName) || null;
}

function existingMapNames(root, exceptMap = null) {
  return Array.from(root.querySelectorAll("map[name]"))
    .filter((map) => map !== exceptMap)
    .map((map) => map.getAttribute("name") || "")
    .filter(Boolean);
}

function ensureUniqueMapName(model, names = []) {
  const normalized = normalizeImageMapModel(model);
  const lower = String(normalized.map.name || "").toLowerCase();
  if (!names.map((name) => String(name).toLowerCase()).includes(lower)) return normalized;
  return { ...normalized, map: { ...normalized.map, name: uniqueImageMapName(names, normalized.map.name) } };
}

function markSelected(root, imageEl, model = {}) {
  root.querySelectorAll("img.nv-selected-image").forEach((img) => img.classList.remove("nv-selected-image"));
  imageEl?.classList?.add("nv-selected-image");
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.activeHtmlImageContext = { element: imageEl, src: imageEl?.getAttribute("src") || "" };
  updateToolbarState({
    htmlImageSelected: Boolean(imageEl),
    htmlImagePath: model.image?.linkedNotebookPath || null,
  });
}

function insertHtmlAtSelection(root, html) {
  const tools = window.HTMLWysiwygTools;
  if (typeof tools?.insertHTMLAtCaret === "function") return tools.insertHTMLAtCaret(html) !== false;
  try {
    return document.execCommand("insertHTML", false, html);
  } catch {
    return false;
  }
}

async function openEditorOverlay(vars = {}) {
  return openNodevisionOverlayPanel("ImageMapEditorPanel", {
    displayName: "Image Map Editor",
    ...vars,
  }, { panelClass: "InfoPanel" });
}

// ------------------------------
// Insert and edit
// ------------------------------
export async function openImageMapInsertOverlay() {
  const root = activeHtmlRoot();
  if (!root) {
    alert("Open an HTML document to insert an image map.");
    return false;
  }
  window.HTMLWysiwygTools?.saveCurrentSelection?.();
  const model = await openEditorOverlay({
    mode: "insert",
    editorPath: currentEditorPath(),
    existingMapNames: existingMapNames(root),
  });
  if (!model) return false;
  const finalModel = ensureUniqueMapName(model, existingMapNames(root));
  const inserted = insertHtmlAtSelection(root, serializeImageMap(finalModel, { editorPreview: true }));
  if (!inserted) return false;
  const imageEl = imageByMapName(root, finalModel.map.name);
  if (imageEl) markSelected(root, imageEl, finalModel);
  root.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
}

export async function openImageMapEditOverlay() {
  const root = activeHtmlRoot();
  if (!root) {
    alert("Open an HTML document to edit an image map.");
    return false;
  }
  const imageEl = selectedImage(root);
  const mapEl = findMapForImage(root, imageEl);
  if (!imageEl || !mapEl) {
    alert("Select an image that already uses an HTML map.");
    return false;
  }
  const initialModel = parseImageMapFromElements(imageEl, mapEl);
  const model = await openEditorOverlay({
    mode: "edit",
    editorPath: currentEditorPath(),
    initialModel,
    existingMapNames: existingMapNames(root, mapEl),
  });
  if (!model) return false;
  const finalModel = ensureUniqueMapName(model, existingMapNames(root, mapEl));
  const beforeHtml = String(root.innerHTML || "");
  applyImageMapModelToElements(finalModel, imageEl, mapEl, root.ownerDocument);
  window.HTMLWysiwygTools?.recordProgrammaticChange?.(beforeHtml);
  window.HTMLWysiwygTools?.markDirty?.();
  markSelected(root, imageEl, finalModel);
  root.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
}
