// Nodevision/ApplicationSystem/public/GraphManagement/DirectoryAppearanceCss.mjs
// This module reads and edits the Nodevision directory appearance custom properties inside ordinary CSS stylesheets while preserving unrelated user-authored stylesheet content.

import {
  DIRECTORY_APPEARANCE_COMMENT,
  DIRECTORY_APPEARANCE_FILL_PROPERTY,
  DIRECTORY_APPEARANCE_OUTLINE_PROPERTY,
  DIRECTORY_APPEARANCE_PROPERTIES,
  DIRECTORY_APPEARANCE_STYLESHEET,
  directoryAppearanceFromCssDeclarations,
  directoryCssValueFromAppearance,
} from "./DirectoryAppearanceCssColors.mjs";

export {
  DIRECTORY_APPEARANCE_COMMENT,
  DIRECTORY_APPEARANCE_FILL_PROPERTY,
  DIRECTORY_APPEARANCE_OUTLINE_PROPERTY,
  DIRECTORY_APPEARANCE_PROPERTIES,
  DIRECTORY_APPEARANCE_STYLESHEET,
} from "./DirectoryAppearanceCssColors.mjs";

function skipString(source, index, end) {
  const quote = source[index];
  for (let i = index + 1; i < end; i++) {
    if (source[i] === "\\") {
      i += 1;
    } else if (source[i] === quote) {
      return i + 1;
    }
  }
  return end;
}

function skipComment(source, index, end) {
  const close = source.indexOf("*/", index + 2);
  return close >= 0 && close < end ? close + 2 : end;
}

function withoutComments(text = "") {
  return String(text).replace(/\/\*[\s\S]*?\*\//g, "");
}

function matchingBrace(source, openIndex, end = source.length) {
  let depth = 1;
  for (let i = openIndex + 1; i < end; i++) {
    if ((source[i] === '"' || source[i] === "'") && source[i - 1] !== "\\") i = skipString(source, i, end) - 1;
    else if (source[i] === "/" && source[i + 1] === "*") i = skipComment(source, i, end) - 1;
    else if (source[i] === "{") depth += 1;
    else if (source[i] === "}" && --depth === 0) return i;
  }
  return end;
}

function scanRules(source, start = 0, end = source.length) {
  const rules = [];
  let preludeStart = start;
  for (let i = start; i < end; i++) {
    if ((source[i] === '"' || source[i] === "'") && source[i - 1] !== "\\") i = skipString(source, i, end) - 1;
    else if (source[i] === "/" && source[i + 1] === "*") i = skipComment(source, i, end) - 1;
    else if (source[i] === ";") preludeStart = i + 1;
    else if (source[i] === "{") {
      const close = matchingBrace(source, i, end);
      const selector = source.slice(preludeStart, i);
      const rule = { selector, blockStart: i, blockEnd: close };
      rules.push(rule);
      if (selector.trim().startsWith("@")) rules.push(...scanRules(source, i + 1, close));
      preludeStart = close + 1;
      i = close;
    }
  }
  return rules;
}

function selectorHasRoot(selector = "") {
  return /(^|[,\s>+~])html\s*:\s*root\b/i.test(withoutComments(selector))
    || /(^|[,\s>+~])\s*:\s*root\b/i.test(withoutComments(selector));
}

function findDeclarationColon(source, start, end) {
  for (let i = start; i < end; i++) {
    if ((source[i] === '"' || source[i] === "'") && source[i - 1] !== "\\") i = skipString(source, i, end) - 1;
    else if (source[i] === "/" && source[i + 1] === "*") i = skipComment(source, i, end) - 1;
    else if (source[i] === ":") return i;
  }
  return -1;
}

function declarationSegments(source, blockStart, blockEnd) {
  const segments = [];
  let start = blockStart + 1;
  let depth = 0;
  for (let i = start; i < blockEnd; i++) {
    if ((source[i] === '"' || source[i] === "'") && source[i - 1] !== "\\") i = skipString(source, i, blockEnd) - 1;
    else if (source[i] === "/" && source[i + 1] === "*") i = skipComment(source, i, blockEnd) - 1;
    else if (source[i] === "(" || source[i] === "[") depth += 1;
    else if ((source[i] === ")" || source[i] === "]") && depth > 0) depth -= 1;
    else if (source[i] === ";" && depth === 0) {
      segments.push({ start, end: i + 1, semicolon: i });
      start = i + 1;
    }
  }
  if (source.slice(start, blockEnd).trim()) segments.push({ start, end: blockEnd, semicolon: blockEnd });
  return segments;
}

function trimRange(source, start, end) {
  while (start < end && /\s/.test(source[start])) start += 1;
  while (end > start && /\s/.test(source[end - 1])) end -= 1;
  return { start, end };
}

function parseDeclarations(source, rule) {
  return declarationSegments(source, rule.blockStart, rule.blockEnd).map((segment) => {
    const colon = findDeclarationColon(source, segment.start, segment.semicolon);
    if (colon < 0) return null;
    const prop = withoutComments(source.slice(segment.start, colon)).trim().toLowerCase();
    const valueRange = trimRange(source, colon + 1, segment.semicolon);
    return {
      prop,
      value: source.slice(valueRange.start, valueRange.end).trim(),
      start: segment.start,
      end: segment.end,
      valueStart: valueRange.start,
      valueEnd: valueRange.end,
      rule,
    };
  }).filter(Boolean);
}

export function parseDirectoryAppearanceCss(source = "") {
  const rootRules = scanRules(String(source)).filter((rule) => !rule.selector.trim().startsWith("@") && selectorHasRoot(rule.selector));
  const declarations = rootRules.flatMap((rule) => parseDeclarations(source, rule)).filter((declaration) => DIRECTORY_APPEARANCE_PROPERTIES.includes(declaration.prop));
  return { appearance: directoryAppearanceFromCssDeclarations(declarations), declarations, hasNodevisionProperties: declarations.length > 0, rootRules };
}

function blockInsert(source, block, entries) {
  const closeLineStart = source.lastIndexOf("\n", block.blockEnd - 1);
  const linePrefix = closeLineStart >= block.blockStart ? source.slice(closeLineStart + 1, block.blockEnd) : "";
  const insertAt = /^\s*$/.test(linePrefix) ? closeLineStart + 1 : block.blockEnd;
  const multiline = source.slice(block.blockStart + 1, block.blockEnd).includes("\n");
  if (!multiline) return { start: insertAt, end: insertAt, text: " " + entries.map(([prop, value]) => `${prop}: ${value};`).join(" ") };
  const closeIndent = /^\s*$/.test(linePrefix) ? linePrefix : "";
  const indent = closeIndent + "    ";
  return { start: insertAt, end: insertAt, text: entries.map(([prop, value]) => `${indent}${prop}: ${value};`).join("\n") + "\n" + closeIndent };
}

function appendedBlock(source, entries) {
  const prefix = source.trim() ? (source.endsWith("\n") ? "\n" : "\n\n") : "";
  return prefix + DIRECTORY_APPEARANCE_COMMENT + "\n:root {\n"
    + entries.map(([prop, value]) => `    ${prop}: ${value};`).join("\n")
    + "\n}\n";
}

function applyOperations(source, operations) {
  return operations.sort((a, b) => b.start - a.start).reduce((text, op) => text.slice(0, op.start) + op.text + text.slice(op.end), source);
}

export function updateDirectoryAppearanceCss(source = "", appearance = {}) {
  const parsed = parseDirectoryAppearanceCss(source);
  const desired = new Map([
    [DIRECTORY_APPEARANCE_FILL_PROPERTY, directoryCssValueFromAppearance(appearance, "fillColor", "fillAlpha")],
    [DIRECTORY_APPEARANCE_OUTLINE_PROPERTY, directoryCssValueFromAppearance(appearance, "outlineColor", "outlineAlpha")],
  ]);
  const operations = [];
  const additions = [];
  for (const [prop, value] of desired.entries()) {
    const declarations = parsed.declarations.filter((declaration) => declaration.prop === prop);
    const keep = declarations[declarations.length - 1];
    for (const declaration of declarations) {
      if (declaration !== keep || !value) operations.push({ start: declaration.start, end: declaration.end, text: "" });
    }
    if (value && keep) operations.push({ start: keep.valueStart, end: keep.valueEnd, text: value });
    if (value && !keep) additions.push([prop, value]);
  }
  let next = applyOperations(source, operations);
  if (additions.length) {
    const targetRules = parseDirectoryAppearanceCss(next).rootRules;
    if (targetRules.length) next = applyOperations(next, [blockInsert(next, targetRules[targetRules.length - 1], additions)]);
    else next += appendedBlock(next, additions);
  }
  return { content: next, parsedBefore: parsed, parsedAfter: parseDirectoryAppearanceCss(next), changed: next !== source };
}

export function addMissingDirectoryAppearanceCss(source = "", appearance = {}) {
  const parsed = parseDirectoryAppearanceCss(source);
  const desired = [
    [DIRECTORY_APPEARANCE_FILL_PROPERTY, directoryCssValueFromAppearance(appearance, "fillColor", "fillAlpha")],
    [DIRECTORY_APPEARANCE_OUTLINE_PROPERTY, directoryCssValueFromAppearance(appearance, "outlineColor", "outlineAlpha")],
  ];
  const additions = desired.filter(([prop, value]) => value && !parsed.declarations.some((declaration) => declaration.prop === prop));
  if (!additions.length) return { content: source, parsedBefore: parsed, parsedAfter: parsed, changed: false };
  const targetRules = parsed.rootRules;
  const content = targetRules.length
    ? applyOperations(source, [blockInsert(source, targetRules[targetRules.length - 1], additions)])
    : source + appendedBlock(source, additions);
  return { content, parsedBefore: parsed, parsedAfter: parseDirectoryAppearanceCss(content), changed: content !== source };
}

export function removeEmptyNodevisionDirectoryAppearanceBlock(source = "") {
  return String(source).replace(/\s*\/\* Nodevision directory appearance \*\/\s*:root\s*\{\s*\}\s*/g, (match, offset, full) => {
    const before = full.slice(0, offset).trim();
    const after = full.slice(offset + match.length).trim();
    return before && after ? "\n\n" : before || after ? "\n" : "";
  });
}
