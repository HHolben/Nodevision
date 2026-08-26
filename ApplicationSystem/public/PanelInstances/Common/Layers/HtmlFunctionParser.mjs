// Nodevision/ApplicationSystem/public/PanelInstances/Common/Layers/HtmlFunctionParser.mjs
// This module provides conservative JavaScript function parsing helpers for HTML layer event handlers without evaluating user-authored Notebook scripts.

const FUNCTION_NAME_PATTERN = /^[\s;]*function\s+([A-Za-z_$][\w$]*)\s*\(/;

export function parseFunctionName(source = "") {
  const match = FUNCTION_NAME_PATTERN.exec(String(source || ""));
  return match ? match[1] : "";
}

function skipQuoted(source, index, quote) {
  let i = index + 1;
  while (i < source.length) {
    const ch = source[i];
    if (ch === "\\") {
      i += 2;
      continue;
    }
    if (ch === quote) return i;
    i += 1;
  }
  return source.length - 1;
}

function skipLineComment(source, index) {
  const next = source.indexOf("\n", index + 2);
  return next < 0 ? source.length - 1 : next;
}

function skipBlockComment(source, index) {
  const next = source.indexOf("*/", index + 2);
  return next < 0 ? source.length - 1 : next + 1;
}

export function findClosingBraceIndex(source = "", openIndex = -1) {
  const text = String(source || "");
  if (openIndex < 0 || text[openIndex] !== "{") return -1;
  let depth = 0;
  for (let i = openIndex; i < text.length; i += 1) {
    const ch = text[i];
    const next = text[i + 1] || "";
    if (ch === "\"" || ch === "'" || ch === "`") {
      i = skipQuoted(text, i, ch);
      continue;
    }
    if (ch === "/" && next === "/") {
      i = skipLineComment(text, i);
      continue;
    }
    if (ch === "/" && next === "*") {
      i = skipBlockComment(text, i);
      continue;
    }
    if (ch === "{") depth += 1;
    if (ch === "}") {
      depth -= 1;
      if (depth === 0) return i;
    }
  }
  return -1;
}

export function findFunctionSource(scriptText = "", functionName = "") {
  const name = String(functionName || "").trim();
  if (!name) return null;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const signature = new RegExp("\\bfunction\\s+" + escaped + "\\s*\\([^)]*\\)\\s*\\{");
  const script = String(scriptText || "");
  const match = signature.exec(script);
  if (!match) return null;
  const openIndex = script.indexOf("{", match.index);
  const closeIndex = findClosingBraceIndex(script, openIndex);
  if (closeIndex < 0) return null;
  return {
    start: match.index,
    end: closeIndex + 1,
    source: script.slice(match.index, closeIndex + 1),
  };
}
