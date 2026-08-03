// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/utils/markdownInsertHelpers.mjs
// This module applies Insert Text toolbar commands to the Markdown graphical editor by transforming selected textarea text into Markdown syntax without changing HTML editor behavior.

const MARKDOWN_EDITOR_SELECTOR = "textarea#markdown-editor, input#markdown-editor";

function clampHeadingLevel(level) {
  const parsed = Number.parseInt(level, 10);
  if (!Number.isFinite(parsed)) return 1;
  return Math.min(6, Math.max(1, parsed));
}

function activeFilePath() {
  return String(
    window.__nvMarkdownActivePath ||
    window.currentActiveFilePath ||
    window.NodevisionState?.activeEditorFilePath ||
    window.selectedFilePath ||
    window.NodevisionState?.selectedFile ||
    ""
  );
}

function isMarkdownFilePath(pathValue) {
  return /\.(md|markdown)$/i.test(String(pathValue || "").split(/[?#]/)[0]);
}

function isMarkdownEditingContext(target) {
  const mode = String(window.NodevisionState?.currentMode || "");
  if (mode === "MDediting") return true;
  if (!isMarkdownFilePath(activeFilePath())) return false;
  return Boolean(target?.matches?.(MARKDOWN_EDITOR_SELECTOR));
}

function textTargetCanEdit(target) {
  const tag = target?.tagName?.toUpperCase?.();
  if (tag === "TEXTAREA") return true;
  if (tag !== "INPUT") return false;
  const type = String(target.type || "text").toLowerCase();
  return ["", "text", "search", "url"].includes(type);
}

function findMarkdownTextTarget() {
  const active = document.activeElement;
  if (textTargetCanEdit(active) && isMarkdownEditingContext(active)) return active;

  const editor = document.querySelector(MARKDOWN_EDITOR_SELECTOR);
  if (textTargetCanEdit(editor) && isMarkdownEditingContext(editor)) return editor;

  return null;
}

function normalizedRange(value, start, end) {
  const length = String(value || "").length;
  const safeStart = Math.min(length, Math.max(0, Number.isFinite(start) ? start : 0));
  const safeEnd = Math.min(length, Math.max(safeStart, Number.isFinite(end) ? end : safeStart));
  return { start: safeStart, end: safeEnd };
}

function dispatchInput(target) {
  try {
    target.dispatchEvent(new Event("input", { bubbles: true }));
  } catch {
    const event = document.createEvent("Event");
    event.initEvent("input", true, false);
    target.dispatchEvent(event);
  }
}

function applyTextResult(target, result) {
  target.focus();
  target.value = result.value;
  if (typeof target.setSelectionRange === "function") {
    target.setSelectionRange(result.selectionStart, result.selectionEnd);
  }
  dispatchInput(target);
}

function headingMarker(level) {
  return `${"#".repeat(clampHeadingLevel(level))} `;
}

function transformHeadingLine(line, level, caretOffset = null) {
  const marker = headingMarker(level);
  const text = String(line);
  const existing = text.match(/^(\s*)(#{1,6})([ \t]+|$)(.*)$/);
  if (existing) {
    const oldPrefixLength = existing[1].length + existing[2].length + existing[3].length;
    const nextPrefix = `${existing[1]}${marker}`;
    const nextLine = `${nextPrefix}${existing[4]}`;
    const adjustedOffset = caretOffset === null
      ? null
      : (caretOffset <= oldPrefixLength ? nextPrefix.length : caretOffset + nextPrefix.length - oldPrefixLength);
    return { line: nextLine, adjustedOffset };
  }

  const leading = text.match(/^\s*/)?.[0] || "";
  const nextPrefix = `${leading}${marker}`;
  const nextLine = `${nextPrefix}${text.slice(leading.length)}`;
  const adjustedOffset = caretOffset === null
    ? null
    : (caretOffset <= leading.length ? nextPrefix.length : caretOffset + marker.length);
  return { line: nextLine, adjustedOffset };
}

export function applyMarkdownBold(value, start, end) {
  const text = String(value || "");
  const range = normalizedRange(text, start, end);
  const selected = text.slice(range.start, range.end);
  const replacement = `**${selected}**`;
  const nextValue = `${text.slice(0, range.start)}${replacement}${text.slice(range.end)}`;
  const caret = selected ? range.start + replacement.length : range.start + 2;
  return {
    value: nextValue,
    selectionStart: caret,
    selectionEnd: caret,
  };
}

export function applyMarkdownHeading(value, start, end, level) {
  const text = String(value || "");
  const range = normalizedRange(text, start, end);
  const selected = range.end > range.start;
  const lineStart = text.lastIndexOf("\n", Math.max(0, range.start - 1)) + 1;
  const effectiveEnd = selected && text[range.end - 1] === "\n" ? range.end - 1 : range.end;
  const nextLineBreak = text.indexOf("\n", effectiveEnd);
  const lineEnd = nextLineBreak === -1 ? text.length : nextLineBreak;
  const originalBlock = text.slice(lineStart, lineEnd);

  if (!selected) {
    const caretOffset = range.start - lineStart;
    const transformed = transformHeadingLine(originalBlock, level, caretOffset);
    const nextValue = `${text.slice(0, lineStart)}${transformed.line}${text.slice(lineEnd)}`;
    const caret = lineStart + (transformed.adjustedOffset ?? headingMarker(level).length);
    return {
      value: nextValue,
      selectionStart: caret,
      selectionEnd: caret,
    };
  }

  const nextBlock = originalBlock
    .split("\n")
    .map((line) => transformHeadingLine(line, level).line)
    .join("\n");
  const nextValue = `${text.slice(0, lineStart)}${nextBlock}${text.slice(lineEnd)}`;
  return {
    value: nextValue,
    selectionStart: lineStart,
    selectionEnd: lineStart + nextBlock.length,
  };
}

function markdownModeIsActive() {
  return String(window.NodevisionState?.currentMode || "") === "MDediting";
}

export function insertMarkdownBoldIfActive() {
  const target = findMarkdownTextTarget();
  if (!target) return markdownModeIsActive();
  applyTextResult(target, applyMarkdownBold(target.value, target.selectionStart, target.selectionEnd));
  return true;
}

export function insertMarkdownHeadingIfActive(level) {
  const target = findMarkdownTextTarget();
  if (!target) return markdownModeIsActive();
  applyTextResult(target, applyMarkdownHeading(target.value, target.selectionStart, target.selectionEnd, level));
  return true;
}
