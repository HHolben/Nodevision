// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/BasenameWithoutFontExtension.mjs
// This module implements basename Without Font Extension behavior for the HTMLeditorImpl feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { sanitizeSingleFontFamily, cssQuote, cssUrlQuote } from "./HtmlTableSelectionGrid.mjs";
import { shortStableHash, sanitizeFontUrl, cssFormatFromFontUrl } from "./UpdateStoredDocumentBackgroundStyle.mjs";
import { getCurrentSelectionRangeInEditor, getRememberedSelectionRange, isRangeInsideEditor, applySelectionRange } from "./EnsureHTMLLayoutStyles.mjs";

// Basename Without Font Extension operations.
export function basenameWithoutFontExtension(value) {
  const clean = String(value || "").split(/[?#]/)[0].replace(/\\/g, "/");
  const name = clean.split("/").filter(Boolean).pop() || "Font";
  return name.replace(/\.[^.]+$/, "") || "Font";
}

export function createSafeFontFamilyName(sourcePathOrUrl, prefix = "NodevisionFont") {
  const base = basenameWithoutFontExtension(sourcePathOrUrl).replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "Font";
  return sanitizeSingleFontFamily(`${prefix}-${base}`);
}

export function createHashedFontFamilyName(sourcePathOrUrl, prefix = "NodevisionFont") {
  return sanitizeSingleFontFamily(`${createSafeFontFamilyName(sourcePathOrUrl, prefix)}-${shortStableHash(sourcePathOrUrl)}`);
}

export function parseFontFaceEntries(headContainer) {
  const entries = [];
  if (!headContainer) return entries;
  const styles = Array.from(headContainer.querySelectorAll?.("style") || []);
  for (const style of styles) {
    const text = style.textContent || "";
    for (const match of text.matchAll(/@font-face\s*\{[\s\S]*?\}/gi)) {
      const block = match[0] || "";
      const familyMatch = block.match(/font-family\s*:\s*(?:"([^"]+)"|'([^']+)'|([^;\n}]+))/i);
      const srcMatch = block.match(/url\(\s*(?:"([^"]+)"|'([^']+)'|([^\s)]+))\s*\)/i);
      const family = (familyMatch?.[1] || familyMatch?.[2] || familyMatch?.[3] || "").trim();
      const src = (srcMatch?.[1] || srcMatch?.[2] || srcMatch?.[3] || "").trim();
      if (family || src) entries.push({
        family,
        src,
        block,
        style
      });
    }
  }
  return entries;
}

export function ensureNodevisionFontStyleBlock(headContainer) {
  if (!headContainer) throw new Error("HTML document head is not available.");
  let style = headContainer.querySelector?.("style[data-nodevision-fonts]");
  if (!style) {
    style = document.createElement("style");
    style.setAttribute("data-nodevision-fonts", "");
    headContainer.appendChild(style);
  }
  return style;
}

export function ensureFontFaceRule(headContainer, options = {}) {
  const src = sanitizeFontUrl(options.src || options.url || "");
  const format = String(options.format || cssFormatFromFontUrl(src) || "").trim().toLowerCase();
  const prefix = options.sourceKind === "web" ? "NodevisionWebFont" : options.sourceKind === "resource" ? "NodevisionResourceFont" : "NodevisionFont";
  const entries = parseFontFaceEntries(headContainer);
  const existingBySrc = entries.find(entry => entry.src === src);
  if (existingBySrc?.family) return sanitizeSingleFontFamily(existingBySrc.family);
  const namingSource = options.sourceName || src;
  const uniqueSource = options.src || options.url || namingSource;
  let family = sanitizeSingleFontFamily(options.fontFamily || createSafeFontFamilyName(namingSource, prefix));
  if (entries.some(entry => entry.family === family && entry.src && entry.src !== src)) {
    family = createHashedFontFamilyName(`${namingSource}-${uniqueSource}`, prefix);
  }
  const style = ensureNodevisionFontStyleBlock(headContainer);
  const formatHint = format ? ` format("${cssQuote(format)}")` : "";
  const rule = `@font-face {\n  font-family: "${cssQuote(family)}";\n  src: url("${cssUrlQuote(src)}")${formatHint};\n}`;
  const current = (style.textContent || "").trim();
  style.textContent = current ? `${current}\n\n${rule}\n` : `${rule}\n`;
  return family;
}

export function inferGoogleFontFamilyFromHref(href) {
  try {
    const parsed = new URL(href, window.location.href);
    const family = parsed.searchParams.get("family");
    if (!family) return "";
    return sanitizeSingleFontFamily(family.split(":")[0].replace(/\+/g, " "));
  } catch {
    return "";
  }
}

export function ensureFontStylesheetLink(headContainer, options = {}) {
  if (!headContainer) throw new Error("HTML document head is not available.");
  const href = sanitizeFontUrl(options.href || options.url || "");
  const existing = Array.from(headContainer.querySelectorAll?.('link[rel~="stylesheet"]') || []).find(link => link.getAttribute("href") === href);
  if (existing) {
    existing.setAttribute("data-nodevision-font-stylesheet", "");
    if (options.fontFamily) existing.setAttribute("data-nodevision-font-family", sanitizeSingleFontFamily(options.fontFamily));
    return existing;
  }
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  link.setAttribute("data-nodevision-font-stylesheet", "");
  if (options.fontFamily) link.setAttribute("data-nodevision-font-family", sanitizeSingleFontFamily(options.fontFamily));
  headContainer.appendChild(link);
  return link;
}

export function restoreEditorSelectionForStyle(wysiwyg) {
  const preferredRange = getCurrentSelectionRangeInEditor(wysiwyg) || getRememberedSelectionRange(wysiwyg);
  const range = isRangeInsideEditor(wysiwyg, preferredRange) ? preferredRange.cloneRange() : null;
  if (!range) return null;
  applySelectionRange(range);
  wysiwyg.focus();
  return range;
}

export function nearestStyleTargetForRange(wysiwyg, range) {
  if (!range) return null;
  let node = range.startContainer;
  if (node.nodeType === Node.TEXT_NODE) node = node.parentElement;
  if (!(node instanceof Element)) node = node?.parentElement || null;
  if (!node || !wysiwyg.contains(node)) return null;
  return node.closest?.("span,a,b,strong,i,em,u,s,small,mark,p,li,div,h1,h2,h3,h4,h5,h6") || wysiwyg;
}
