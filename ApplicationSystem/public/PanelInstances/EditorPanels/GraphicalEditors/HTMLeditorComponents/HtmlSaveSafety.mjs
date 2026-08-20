// Nodevision/ApplicationSystem/public/PanelInstances/EditorPanels/GraphicalEditors/HTMLeditorComponents/HtmlSaveSafety.mjs
// This file defines reusable save-safety checks for the graphical HTML editor so transient empty DOM states cannot overwrite meaningful Notebook documents.

const HTML_PATH_EXTENSIONS = new Set(["html", "htm", "php"]);
const MEANINGFUL_ELEMENT_PATTERN = /<(img|video|audio|svg|math|canvas|iframe|object|embed|table|input|textarea|select|button|form)\b/i;
const MEANINGFUL_LINK_PATTERN = /<a\b[^>]*(href|name|id)\s*=/i;
const PHP_SOURCE_PATTERN = /<\?(?:php|=)?[\s\S]*?\?>/i;

function cleanPath(pathValue = "") {
  return String(pathValue || "")
    .trim()
    .split(String.fromCharCode(92)).join("/")
    .split(/[?#]/)[0]
    .replace(/^\/+/, "")
    .replace(/^Notebook\//i, "");
}

function textWithoutStructuralMarkup(value = "") {
  return String(value || "")
    .replace(/^\uFEFF/, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<!doctype[^>]*>/gi, "")
    .replace(/<\/?(html|head|body|meta|title|link)[^>]*>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&[a-zA-Z0-9#]+;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function htmlBodyMarkup(value = "") {
  const text = String(value || "");
  const bodyMatch = /<body\b[^>]*>([\s\S]*?)<\/body>/i.exec(text);
  return bodyMatch ? bodyMatch[1] : text;
}

export function isHtmlLikeNotebookPath(pathValue = "") {
  const name = cleanPath(pathValue).toLowerCase().split("/").pop() || "";
  const ext = name.includes(".") ? name.split(".").pop() : "";
  return HTML_PATH_EXTENSIONS.has(ext);
}

export function htmlContentHasMeaningfulContent(content = "") {
  const text = String(content || "");
  if (!text.trim()) return false;
  if (PHP_SOURCE_PATTERN.test(text)) return true;
  if (MEANINGFUL_ELEMENT_PATTERN.test(text)) return true;
  if (MEANINGFUL_LINK_PATTERN.test(text)) return true;
  return textWithoutStructuralMarkup(text).length > 0;
}

export function htmlEditableBodyHasMeaningfulContent(content = "") {
  return htmlContentHasMeaningfulContent(htmlBodyMarkup(content));
}

export function serializedHtmlLooksUsable(content = "") {
  const clean = String(content || "").replace(/^\uFEFF/, "").trimStart();
  return /^<!doctype\s+html\b/i.test(clean) || /^<html(?:\s|>)/i.test(clean);
}

export function validateGraphicalHtmlSave({ path = "", content = "", originalContent = "" } = {}) {
  if (!isHtmlLikeNotebookPath(path)) return { ok: true };
  if (!serializedHtmlLooksUsable(content)) {
    return {
      ok: false,
      code: "HTML_WYSIWYG_INVALID_SERIALIZATION",
      error: "Refusing to save because the graphical HTML editor produced invalid document source.",
    };
  }
  if (!htmlEditableBodyHasMeaningfulContent(originalContent)) return { ok: true };
  if (htmlEditableBodyHasMeaningfulContent(content)) return { ok: true };
  return {
    ok: false,
    code: "HTML_WYSIWYG_EMPTY_PAYLOAD",
    error: "Refusing to save because the graphical HTML editor produced an empty document for a non-empty file.",
  };
}
