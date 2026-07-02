// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/FontEditor.mjs
// First-pass graphical editor for TrueType-style font files.

import { ensureNodevisionState, fetchArrayBuffer, resetEditorHooks } from "./FamilyEditorCommon.mjs";
import { updateToolbarState } from "/panels/createToolbar.mjs";

const FONT_MODE = "FontEditing";
const STYLE_ID = "nv-font-editor-styles";

function ensureStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement("style");
  style.id = STYLE_ID;
  style.textContent = `
    .nv-font-editor { width:100%; height:100%; min-width:0; min-height:0; display:flex; flex-direction:column; overflow:hidden; background:#f5f7fa; color:#172033; font:13px/1.4 system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
    .nv-font-editor__header { flex:0 0 auto; display:flex; align-items:center; justify-content:space-between; gap:12px; min-height:34px; padding:7px 10px; border-bottom:1px solid #cbd5e1; background:#eef3f8; color:#334155; box-sizing:border-box; }
    .nv-font-editor__title { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; font-weight:600; }
    .nv-font-editor__status { flex:0 0 auto; color:#64748b; font-size:12px; }
    .nv-font-editor__strip { flex:0 0 auto; display:flex; align-items:stretch; gap:6px; min-height:78px; max-height:98px; padding:8px 10px; overflow-x:auto; overflow-y:hidden; border-bottom:1px solid #d7dee8; background:#fff; box-sizing:border-box; }
    .nv-font-editor__tile { flex:0 0 58px; width:58px; height:58px; display:grid; grid-template-rows:minmax(0,1fr) 15px; align-items:center; justify-items:center; border:1px solid #cbd5e1; border-radius:5px; background:#fbfdff; color:#111827; cursor:pointer; padding:2px; box-sizing:border-box; }
    .nv-font-editor__tile:hover { border-color:#64748b; background:#f8fafc; }
    .nv-font-editor__tile[aria-selected="true"] { border-color:#2563eb; box-shadow:0 0 0 2px rgba(37,99,235,.18); background:#eff6ff; }
    .nv-font-editor__tile-glyph { max-width:100%; min-width:0; overflow:hidden; font-size:28px; line-height:1; white-space:nowrap; }
    .nv-font-editor__tile-code { width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; color:#64748b; font-size:10px; text-align:center; }
    .nv-font-editor__body { flex:1 1 auto; min-height:0; display:flex; flex-direction:column; padding:12px; gap:8px; box-sizing:border-box; overflow:hidden; }
    .nv-font-editor__preview { flex:1 1 auto; min-height:160px; display:grid; place-items:center; border:1px solid #aeb9c8; border-radius:4px; background:#fff; overflow:hidden; box-sizing:border-box; }
    .nv-font-editor__preview-glyph { max-width:92%; max-height:82%; line-height:1; font-size:clamp(96px, 28vh, 300px); color:#111827; text-align:center; }
    .nv-font-editor__preview-meta { flex:0 0 auto; min-height:18px; color:#64748b; font-size:12px; }
    .nv-font-editor__empty { color:transparent; user-select:none; }
    .nv-font-editor__error { margin:12px; padding:10px 12px; border:1px solid #f2b8b5; border-radius:5px; background:#fff5f5; color:#b42318; }
  `;
  document.head.appendChild(style);
}

function basename(path = "") {
  return String(path || "").split(/[\/]/).filter(Boolean).pop() || "Font";
}

function hexCode(codepoint) {
  return `U+${codepoint.toString(16).toUpperCase().padStart(codepoint <= 0xffff ? 4 : 6, "0")}`;
}

function isDisplayableCodepoint(codepoint) {
  if (!Number.isInteger(codepoint)) return false;
  if (codepoint < 32) return false;
  if (codepoint >= 0x7f && codepoint <= 0x9f) return false;
  if (codepoint >= 0xd800 && codepoint <= 0xdfff) return false;
  if (codepoint > 0x10ffff) return false;
  const low = codepoint & 0xffff;
  if (low === 0xffff || low === 0xfffe) return false;
  return true;
}

function fallbackCodepoints() {
  const values = [];
  for (let codepoint = 32; codepoint <= 126; codepoint += 1) values.push(codepoint);
  for (let codepoint = 160; codepoint <= 255; codepoint += 1) values.push(codepoint);
  return values;
}

function readTag(view, offset) {
  return String.fromCharCode(
    view.getUint8(offset),
    view.getUint8(offset + 1),
    view.getUint8(offset + 2),
    view.getUint8(offset + 3)
  );
}

function getTable(view, tag) {
  if (view.byteLength < 12) return null;
  const tableCount = view.getUint16(4, false);
  for (let index = 0; index < tableCount; index += 1) {
    const recordOffset = 12 + index * 16;
    if (recordOffset + 16 > view.byteLength) break;
    if (readTag(view, recordOffset) !== tag) continue;
    const offset = view.getUint32(recordOffset + 8, false);
    const length = view.getUint32(recordOffset + 12, false);
    if (offset + length <= view.byteLength) return { offset, length };
  }
  return null;
}

function parseCmapFormat12(view, offset, length) {
  if (length < 16) return [];
  const count = view.getUint32(offset + 12, false);
  const values = [];
  for (let index = 0; index < count; index += 1) {
    const groupOffset = offset + 16 + index * 12;
    if (groupOffset + 12 > offset + length) break;
    const start = view.getUint32(groupOffset, false);
    const end = view.getUint32(groupOffset + 4, false);
    for (let codepoint = start; codepoint <= end && codepoint <= 0x10ffff; codepoint += 1) {
      if (isDisplayableCodepoint(codepoint)) values.push(codepoint);
    }
  }
  return values;
}

function parseCmapFormat4(view, offset, length) {
  if (length < 24) return [];
  const segCount = view.getUint16(offset + 6, false) / 2;
  const endCodes = offset + 14;
  const startCodes = endCodes + segCount * 2 + 2;
  const idDeltas = startCodes + segCount * 2;
  const idRangeOffsets = idDeltas + segCount * 2;
  const values = [];

  for (let segment = 0; segment < segCount; segment += 1) {
    const end = view.getUint16(endCodes + segment * 2, false);
    const start = view.getUint16(startCodes + segment * 2, false);
    const delta = view.getInt16(idDeltas + segment * 2, false);
    const rangeOffsetAddress = idRangeOffsets + segment * 2;
    const rangeOffset = view.getUint16(rangeOffsetAddress, false);
    if (start === 0xffff && end === 0xffff) continue;

    for (let codepoint = start; codepoint <= end; codepoint += 1) {
      let glyphIndex = 0;
      if (rangeOffset === 0) {
        glyphIndex = (codepoint + delta) & 0xffff;
      } else {
        const glyphAddress = rangeOffsetAddress + rangeOffset + (codepoint - start) * 2;
        if (glyphAddress + 2 <= offset + length) {
          glyphIndex = view.getUint16(glyphAddress, false);
          if (glyphIndex !== 0) glyphIndex = (glyphIndex + delta) & 0xffff;
        }
      }
      if (glyphIndex !== 0 && isDisplayableCodepoint(codepoint)) values.push(codepoint);
    }
  }

  return values;
}

function parseFontCodepoints(buffer) {
  const view = new DataView(buffer);
  const cmap = getTable(view, "cmap");
  if (!cmap || cmap.length < 4) return [];
  const cmapOffset = cmap.offset;
  const encodingCount = view.getUint16(cmapOffset + 2, false);
  const subtables = [];

  for (let index = 0; index < encodingCount; index += 1) {
    const recordOffset = cmapOffset + 4 + index * 8;
    if (recordOffset + 8 > cmapOffset + cmap.length) break;
    const platform = view.getUint16(recordOffset, false);
    const encoding = view.getUint16(recordOffset + 2, false);
    const subtableOffset = cmapOffset + view.getUint32(recordOffset + 4, false);
    if (subtableOffset + 2 > view.byteLength) continue;
    const format = view.getUint16(subtableOffset, false);
    subtables.push({ platform, encoding, offset: subtableOffset, format });
  }

  const score = (entry) => {
    if (entry.format === 12 && entry.platform === 3 && entry.encoding === 10) return 0;
    if (entry.format === 12) return 1;
    if (entry.format === 4 && entry.platform === 3) return 2;
    if (entry.format === 4) return 3;
    return 10;
  };

  for (const entry of subtables.sort((a, b) => score(a) - score(b))) {
    try {
      if (entry.format === 12) {
        const length = view.getUint32(entry.offset + 4, false);
        const parsed = parseCmapFormat12(view, entry.offset, length);
        if (parsed.length) return [...new Set(parsed)].sort((a, b) => a - b);
      }
      if (entry.format === 4) {
        const length = view.getUint16(entry.offset + 2, false);
        const parsed = parseCmapFormat4(view, entry.offset, length);
        if (parsed.length) return [...new Set(parsed)].sort((a, b) => a - b);
      }
    } catch (error) {
      console.warn("Font cmap subtable parse failed:", error);
    }
  }

  return [];
}

function labelForCodepoint(codepoint) {
  if (codepoint === 32) return "space";
  if (codepoint === 160) return "nbsp";
  try {
    return String.fromCodePoint(codepoint);
  } catch {
    return "?";
  }
}

function createTile({ codepoint, family, onSelect }) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "nv-font-editor__tile";
  button.setAttribute("aria-selected", "false");
  button.title = hexCode(codepoint);
  button.dataset.codepoint = String(codepoint);

  const glyph = document.createElement("span");
  glyph.className = "nv-font-editor__tile-glyph";
  glyph.style.fontFamily = `${family}, sans-serif`;
  glyph.textContent = labelForCodepoint(codepoint);

  const code = document.createElement("span");
  code.className = "nv-font-editor__tile-code";
  code.textContent = hexCode(codepoint);

  button.append(glyph, code);
  button.addEventListener("click", () => onSelect(codepoint, button));
  return button;
}

function createLayout(container, filePath) {
  const root = document.createElement("div");
  root.className = "nv-font-editor";

  const header = document.createElement("div");
  header.className = "nv-font-editor__header";

  const title = document.createElement("div");
  title.className = "nv-font-editor__title";
  title.textContent = basename(filePath);

  const status = document.createElement("div");
  status.className = "nv-font-editor__status";
  status.textContent = "Loading font...";

  const strip = document.createElement("div");
  strip.className = "nv-font-editor__strip";

  const body = document.createElement("div");
  body.className = "nv-font-editor__body";

  const preview = document.createElement("div");
  preview.className = "nv-font-editor__preview";

  const previewGlyph = document.createElement("div");
  previewGlyph.className = "nv-font-editor__preview-glyph nv-font-editor__empty";
  previewGlyph.textContent = "empty";
  preview.appendChild(previewGlyph);

  const previewMeta = document.createElement("div");
  previewMeta.className = "nv-font-editor__preview-meta";
  previewMeta.textContent = "";

  header.append(title, status);
  body.append(preview, previewMeta);
  root.append(header, strip, body);
  container.innerHTML = "";
  container.appendChild(root);

  return { root, status, strip, previewGlyph, previewMeta };
}

export async function renderEditor(filePath, container) {
  ensureStyles();
  resetEditorHooks();
  ensureNodevisionState(FONT_MODE);
  updateToolbarState({ currentMode: FONT_MODE, selectedFile: filePath, activeEditorFilePath: filePath, activeActionHandler: null });

  let objectUrl = null;
  let fontFace = null;
  let destroyed = false;
  const refs = createLayout(container, filePath);

  const cleanup = () => {
    destroyed = true;
    if (fontFace && document.fonts?.delete) document.fonts.delete(fontFace);
    if (objectUrl) URL.revokeObjectURL(objectUrl);
    if (container.__nvActiveEditorCleanup === cleanup) container.__nvActiveEditorCleanup = null;
  };
  container.__nvActiveEditorCleanup = cleanup;

  try {
    const buffer = await fetchArrayBuffer(filePath);
    if (destroyed) return;

    const family = `NodevisionFontEditor-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const extension = String(filePath || "").split(".").pop()?.toLowerCase() || "ttf";
    const mimeType = extension === "otf" ? "font/otf" : "font/ttf";
    objectUrl = URL.createObjectURL(new Blob([buffer], { type: mimeType }));
    fontFace = new FontFace(family, `url("${objectUrl}")`);
    await fontFace.load();
    if (destroyed) return;
    document.fonts.add(fontFace);

    const parsedCodepoints = parseFontCodepoints(buffer);
    const codepoints = parsedCodepoints.length ? parsedCodepoints : fallbackCodepoints();
    refs.strip.innerHTML = "";

    let selectedButton = null;
    const selectCodepoint = (codepoint, button) => {
      if (selectedButton) selectedButton.setAttribute("aria-selected", "false");
      selectedButton = button;
      selectedButton?.setAttribute("aria-selected", "true");
      refs.previewGlyph.classList.remove("nv-font-editor__empty");
      refs.previewGlyph.style.fontFamily = `${family}, sans-serif`;
      refs.previewGlyph.textContent = labelForCodepoint(codepoint);
      refs.previewMeta.textContent = `${hexCode(codepoint)} selected`;
      updateToolbarState({ currentMode: FONT_MODE, selectedFile: filePath, activeEditorFilePath: filePath, selectedFontCodepoint: codepoint });
    };

    const fragment = document.createDocumentFragment();
    codepoints.forEach((codepoint) => {
      fragment.appendChild(createTile({ codepoint, family, onSelect: selectCodepoint }));
    });
    refs.strip.appendChild(fragment);
    refs.status.textContent = `${codepoints.length.toLocaleString()} characters`;
  } catch (error) {
    console.error("Font editor failed:", error);
    refs.root.innerHTML = "";
    const message = document.createElement("div");
    message.className = "nv-font-editor__error";
    message.textContent = `Unable to load font editor: ${error?.message || String(error)}`;
    refs.root.appendChild(message);
  }
}
