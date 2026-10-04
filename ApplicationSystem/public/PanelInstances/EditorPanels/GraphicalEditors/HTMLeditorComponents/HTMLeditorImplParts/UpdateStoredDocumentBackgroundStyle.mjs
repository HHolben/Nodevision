// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HTMLeditorImplParts/UpdateStoredDocumentBackgroundStyle.mjs
// This module implements update Stored Document Background Style behavior for the HTMLeditorImpl feature. Its dependencies and instance state are supplied explicitly so other editor instances remain independent.

import { HTML_DOCUMENT_BACKGROUND_PROPERTIES, markHtmlEditorDirty } from "./EnsureHTMLLayoutStyles.mjs";
import { cssUrlQuote, applyDocumentBackgroundPreview, sanitizeDocumentBackgroundImageSource, sanitizeSingleFontFamily, sanitizeCssFontValue } from "./HtmlTableSelectionGrid.mjs";

// Update Stored Document Background Style operations.
export function updateStoredDocumentBackgroundStyle(wysiwyg) {
  if (!wysiwyg) return;
  const stored = document.createElement("div").style;
  stored.cssText = wysiwyg.dataset.nvDocumentBodyStyle || "";
  for (const property of HTML_DOCUMENT_BACKGROUND_PROPERTIES) stored[property] = wysiwyg.style[property] || "";
  const cssText = stored.cssText;
  if (cssText) {
    wysiwyg.dataset.nvDocumentBodyStyle = cssText;
  } else {
    wysiwyg.dataset.nvDocumentBodyStyle = "";
  }
}

export function applyInitialDocumentBodyBackground(wysiwyg, body) {
  if (!wysiwyg || !body) return;
  const style = document.createElement("div").style;
  const bodyStyle = body.style || {};
  for (const property of HTML_DOCUMENT_BACKGROUND_PROPERTIES) {
    style[property] = bodyStyle[property] || "";
  }
  const legacyBgColor = body.getAttribute("bgcolor");
  if (legacyBgColor && !style.backgroundColor) style.backgroundColor = legacyBgColor;
  const legacyBackground = body.getAttribute("background");
  if (legacyBackground && !style.backgroundImage) {
    style.backgroundImage = `url("${cssUrlQuote(legacyBackground)}")`;
    style.backgroundSize = style.backgroundSize || "cover";
    style.backgroundPosition = style.backgroundPosition || "center center";
    style.backgroundRepeat = style.backgroundRepeat || "no-repeat";
  }
  applyDocumentBackgroundPreview(wysiwyg, style);
  wysiwyg.dataset.nvDocumentBodyStyle = body.getAttribute("style") || "";
}

export function applyDocumentBackgroundToWysiwyg(wysiwyg, options = {}) {
  if (!wysiwyg) throw new Error("No active WYSIWYG editor.");
  const mode = String(options?.mode || "color").toLowerCase();
  if (mode === "clear") {
    for (const property of HTML_DOCUMENT_BACKGROUND_PROPERTIES) {
      wysiwyg.style[property] = "";
    }
    updateStoredDocumentBackgroundStyle(wysiwyg);
    markHtmlEditorDirty(wysiwyg);
    return;
  }
  if (mode === "image") {
    const src = sanitizeDocumentBackgroundImageSource(options?.image || options?.src || "");
    if (!src) throw new Error("Choose a background picture.");
    wysiwyg.style.backgroundImage = `url("${cssUrlQuote(src)}")`;
    wysiwyg.style.backgroundSize = String(options?.size || "cover");
    wysiwyg.style.backgroundPosition = "center center";
    wysiwyg.style.backgroundRepeat = "no-repeat";
    wysiwyg.style.backgroundAttachment = "local";
    if (options?.color) wysiwyg.style.backgroundColor = String(options.color);
  } else {
    const color = String(options?.color || "#ffffff").trim();
    wysiwyg.style.backgroundColor = color;
    wysiwyg.style.backgroundImage = "";
    wysiwyg.style.backgroundSize = "";
    wysiwyg.style.backgroundPosition = "";
    wysiwyg.style.backgroundRepeat = "";
    wysiwyg.style.backgroundAttachment = "";
  }
  updateStoredDocumentBackgroundStyle(wysiwyg);
  markHtmlEditorDirty(wysiwyg);
}

export function readDocumentBackgroundFromWysiwyg(wysiwyg) {
  if (!wysiwyg) return {};
  const imageCss = wysiwyg.style.backgroundImage || "";
  const match = imageCss.match(/^url\((["']?)(.*?)\1\)$/i);
  return {
    mode: imageCss && imageCss !== "none" ? "image" : "color",
    color: wysiwyg.style.backgroundColor || "#ffffff",
    image: match ? match[2] : "",
    size: wysiwyg.style.backgroundSize || "cover"
  };
}

export function escapeHtmlAttribute(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function quoteFontFamilyIfNeeded(value) {
  const family = sanitizeSingleFontFamily(value);
  if (!family) return "";
  if (/^(serif|sans-serif|monospace|cursive|fantasy|system-ui|inherit|initial|unset)$/i.test(family)) {
    return family;
  }
  if (/^[a-zA-Z_][a-zA-Z0-9_-]*$/.test(family)) return family;
  return `'${family.replace(/'/g, "\\'")}'`;
}

export function buildFontStack(fontFamilyOrStack, fallback = "") {
  const stack = sanitizeCssFontValue(fontFamilyOrStack);
  const safeFallback = fallback ? sanitizeSingleFontFamily(fallback) : "";
  if (!safeFallback || stack.includes(",")) return stack;
  if (stack.toLowerCase() === safeFallback.toLowerCase()) return stack;
  return `${quoteFontFamilyIfNeeded(stack)}, ${safeFallback}`;
}

export function extensionFromFontUrl(value) {
  const clean = String(value || "").split(/[?#]/)[0].trim().toLowerCase();
  const match = clean.match(/\.(ttf|otf|woff2?|tff)$/);
  return match ? `.${match[1]}` : "";
}

export function cssFormatFromFontUrl(value) {
  const ext = extensionFromFontUrl(value);
  if (ext === ".ttf") return "truetype";
  if (ext === ".otf") return "opentype";
  if (ext === ".woff") return "woff";
  if (ext === ".woff2") return "woff2";
  return "";
}

export function sanitizeFontUrl(value) {
  const clean = String(value || "").trim().replace(/\\/g, "/");
  if (!clean) throw new Error("Missing font URL.");
  if (/^(javascript|file|data|mailto):/i.test(clean)) throw new Error("Unsupported font URL protocol.");
  if (/^\/\//.test(clean)) throw new Error("Use a full http:// or https:// URL.");
  if (/^[a-z]:\//i.test(clean)) throw new Error("Absolute local font paths are not portable.");
  if (/[<>{}"';\n\r]/.test(clean)) throw new Error("Font URL contains unsafe characters.");
  if (/^[a-z][a-z0-9+.-]*:/i.test(clean) && !/^https?:\/\//i.test(clean)) {
    throw new Error("Only relative, http://, and https:// font URLs are supported.");
  }
  return clean;
}

export function shortStableHash(value) {
  const text = String(value || "");
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash << 5) - hash + text.charCodeAt(i) | 0;
  }
  return Math.abs(hash).toString(36).slice(0, 4) || "0";
}
