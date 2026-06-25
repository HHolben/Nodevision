// Nodevision/ApplicationSystem/public/ToolbarCallbacks/insert/utils/lineNumberedPoetry.mjs
// Pure helpers for generating portable line-numbered poetry HTML and CSS.

export const POEM_STYLE_DATA_ATTR = "data-nodevision-poem-style";
export const POEM_DEFAULT_INTERVAL = 5;
export const POEM_INTERVAL_STORAGE_KEY = "nodevision.poetry.lineNumberInterval";

const SAMPLE_LINE_WORDS = [
  "First line of poetry",
  "Second line of poetry",
  "Third line of poetry",
  "Fourth line of poetry",
  "Fifth line of poetry",
  "Sixth line of poetry",
  "Seventh line of poetry",
  "Eighth line of poetry",
  "Ninth line of poetry",
  "Tenth line of poetry",
  "Eleventh line of poetry",
  "Twelfth line of poetry",
];

export function parsePositiveInteger(value) {
  const text = String(value ?? "").trim();
  if (!/^\d+$/.test(text)) return null;
  const num = Number(text);
  if (!Number.isSafeInteger(num) || num < 1) return null;
  return num;
}

export function poemClassForInterval(interval) {
  const normalized = parsePositiveInteger(interval);
  if (!normalized) throw new Error("Poetry line numbering interval must be a positive integer.");
  return `poem-lines-every-${normalized}`;
}

export function sampleLineCountForInterval(interval) {
  const normalized = parsePositiveInteger(interval) || POEM_DEFAULT_INTERVAL;
  return Math.max(12, normalized);
}

export function samplePoemLines(interval) {
  const count = sampleLineCountForInterval(interval);
  return Array.from({ length: count }, (_, index) => SAMPLE_LINE_WORDS[index] || `Line ${index + 1} of poetry`);
}

export function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function isBlankPoemLine(value = "") {
  return String(value ?? "").trim() === "";
}

export function buildPoemStyleCss(interval) {
  const normalized = parsePositiveInteger(interval);
  if (!normalized) throw new Error("Poetry line numbering interval must be a positive integer.");
  const className = poemClassForInterval(normalized);
  const beforeContent = normalized === 1 ? "counter(poem-line)" : "\"\"";
  const numberRule = normalized === 1
    ? ""
    : `.nodevision-poem.${className} .poem-line:nth-of-type(${normalized}n)::before {\n  content: counter(poem-line);\n}\n\n`;

  return `.nodevision-poem.${className} {\n  counter-reset: poem-line;\n  margin: 1em 0;\n}\n\n.nodevision-poem.${className} .stanza {\n  margin: 0 0 1em 0;\n}\n\n.nodevision-poem.${className} .poem-line {\n  display: block;\n  min-height: 1.35em;\n  counter-increment: poem-line;\n}\n\n.nodevision-poem.${className} .stanza-break {\n  display: block;\n  min-height: 1.35em;\n}\n\n${numberRule}.nodevision-poem.${className} .poem-line::before {\n  content: ${beforeContent};\n  display: inline-block;\n  width: 3em;\n  margin-right: 1em;\n  text-align: right;\n  color: gray;\n}`;
}

export function buildPoemStyleBlockHtml(interval) {
  const normalized = parsePositiveInteger(interval);
  if (!normalized) throw new Error("Poetry line numbering interval must be a positive integer.");
  return `<style ${POEM_STYLE_DATA_ATTR}="${normalized}">\n${buildPoemStyleCss(normalized)}\n</style>`;
}

function buildPoemLineHtml(line) {
  if (isBlankPoemLine(line)) return `    <div class="stanza-break"><br></div>`;
  return `    <span class="poem-line">${escapeHtml(line)}</span>`;
}

export function buildLineNumberedPoemHtml(interval, options = {}) {
  const normalized = parsePositiveInteger(interval);
  if (!normalized) throw new Error("Poetry line numbering interval must be a positive integer.");
  const className = poemClassForInterval(normalized);
  const lines = Array.isArray(options.lines) && options.lines.length ? options.lines : samplePoemLines(normalized);
  const lineHtml = lines.map((line) => buildPoemLineHtml(line)).join("\n");
  return `<div class="nodevision-poem ${className}" data-line-numbering="${normalized}">\n  <div class="stanza">\n${lineHtml}\n  </div>\n</div>`;
}

export function buildLineNumberedPoemInsertionHtml(interval, options = {}) {
  const includeStyle = options.includeStyle !== false;
  const style = includeStyle ? `${buildPoemStyleBlockHtml(interval)}\n` : "";
  return `${style}${buildLineNumberedPoemHtml(interval, options)}`;
}
