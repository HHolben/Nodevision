// Nodevision/ApplicationSystem/public/PanelInstances/InfoPanels/GraphManagerDependencies/LinkRecords.mjs
// Shared link parsing, selection, and source-edit helpers for Graph Manager link panels.

const HTML_LINK_ATTRS = new Map([
  ["href", "hyperlink"],
  ["src", "source"],
  ["data", "object-data"],
  ["action", "form-action"],
  ["poster", "poster"],
  ["data-src", "source"],
  ["data-nodevision-font-src", "font-source"],
  ["data-nodevision-font-stylesheet", "font-stylesheet"],
]);

const NODEVISION_METADATA_ATTRS = {
  tags: "data-nodevision-link-tags",
  symbols: "data-nodevision-link-symbols",
  displayText: "data-nodevision-link-label",
};

const MARKDOWN_METADATA_PREFIX = "nodevision-link";

export function normalizeNotebookRelativePath(inputPath) {
  const parts = [];
  const cleaned = String(inputPath || "")
    .replace(/\\/g, "/")
    .replace(/[?#].*$/, "")
    .replace(/^\/+/, "")
    .replace(/^Notebook\//i, "")
    .replace(/\/+/g, "/")
    .trim();

  for (const part of cleaned.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (parts.length === 0) return "";
      parts.pop();
      continue;
    }
    parts.push(part);
  }
  return parts.join("/");
}

export function isExternalLink(rawLink = "") {
  const link = String(rawLink || "").trim();
  return /^(https?:)?\/\//i.test(link) ||
    /^(mailto|javascript|data|file):/i.test(link) ||
    link.startsWith("#");
}

export function isHttpLink(rawLink = "") {
  return /^https?:\/\//i.test(String(rawLink || "").trim());
}

export function splitLinkSuffix(rawLink = "") {
  const value = String(rawLink || "");
  const hashIndex = value.indexOf("#");
  const queryIndex = value.indexOf("?");
  const indices = [hashIndex, queryIndex].filter((idx) => idx >= 0);
  if (!indices.length) return { pathPart: value, suffix: "" };
  const cut = Math.min(...indices);
  return { pathPart: value.slice(0, cut), suffix: value.slice(cut) };
}

export function resolveNotebookLink(sourceFilePath, rawLink) {
  const trimmed = String(rawLink || "").trim();
  if (!trimmed || isExternalLink(trimmed)) return null;

  const { pathPart } = splitLinkSuffix(trimmed);
  let link = String(pathPart || "").trim();
  if (!link) return null;

  const source = normalizeNotebookRelativePath(sourceFilePath);
  const sourceDir = source.includes("/") ? source.slice(0, source.lastIndexOf("/")) : "";
  const isRootRelative = trimmed.startsWith("/") || /^Notebook\//i.test(trimmed);
  let candidate = link.replace(/^\/+/, "");

  if (/^Notebook\//i.test(candidate)) {
    candidate = candidate.replace(/^Notebook\//i, "");
  } else if (!isRootRelative && sourceDir) {
    candidate = `${sourceDir}/${candidate}`;
  }

  return normalizeNotebookRelativePath(candidate);
}

export function csvToList(value) {
  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function normalizeSymbols(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }
  return String(value || "")
    .split(/[\s,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function listToCsv(values = []) {
  return [...new Set((Array.isArray(values) ? values : csvToList(values)).map((item) => String(item || "").trim()).filter(Boolean))].join(", ");
}

function decodeHtmlEntities(value = "") {
  if (typeof document === "undefined") return String(value || "");
  const textarea = document.createElement("textarea");
  textarea.innerHTML = String(value || "");
  return textarea.value;
}

function stripTags(value = "") {
  return decodeHtmlEntities(String(value || "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim());
}

function escapeHtmlAttribute(value = "") {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeHtmlText(value = "") {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function findHtmlTagBounds(text, attrIndex) {
  const tagStart = text.lastIndexOf("<", attrIndex);
  if (tagStart < 0) return null;
  const beforeAttr = text.slice(tagStart, attrIndex);
  if (beforeAttr.includes(">")) return null;
  if (/^<\s*\//.test(beforeAttr)) return null;

  const tagEnd = text.indexOf(">", attrIndex);
  if (tagEnd < 0) return null;
  const tagSource = text.slice(tagStart, tagEnd + 1);
  const tagName = tagSource.match(/^<\s*([A-Za-z][\w:-]*)/)?.[1]?.toLowerCase() || "";
  if (!tagName) return null;
  return { start: tagStart, end: tagEnd + 1, insertAt: tagEnd, tagName, source: tagSource };
}

function readHtmlMetadata(text, tagBounds) {
  const metadata = {
    tags: [],
    symbols: [],
    displayText: "",
    attrRanges: {},
    insertAt: tagBounds?.insertAt ?? null,
  };
  if (!tagBounds) return metadata;

  for (const [key, attrName] of Object.entries(NODEVISION_METADATA_ATTRS)) {
    const attrRegex = new RegExp(`(\\s+)${attrName}\\s*=\\s*(["'])(.*?)\\2`, "i");
    const match = attrRegex.exec(tagBounds.source);
    if (!match) continue;

    const raw = match[3] || "";
    const wholeStart = tagBounds.start + match.index;
    const valueStart = wholeStart + match[0].indexOf(raw);
    metadata.attrRanges[key] = {
      wholeStart,
      wholeEnd: wholeStart + match[0].length,
      valueStart,
      valueEnd: valueStart + raw.length,
      quote: match[2] || "\"",
    };

    if (key === "tags") metadata.tags = csvToList(decodeHtmlEntities(raw));
    if (key === "symbols") metadata.symbols = normalizeSymbols(decodeHtmlEntities(raw));
    if (key === "displayText") metadata.displayText = decodeHtmlEntities(raw).trim();
  }

  return metadata;
}

function parseAnchorTextRange(text, tagBounds) {
  if (!tagBounds || tagBounds.tagName !== "a") return null;
  const closeRegex = /<\/a\s*>/gi;
  closeRegex.lastIndex = tagBounds.end;
  const closeMatch = closeRegex.exec(text);
  if (!closeMatch) return null;

  const inner = text.slice(tagBounds.end, closeMatch.index);
  const clean = stripTags(inner);
  const editable = !/<[A-Za-z/!]/.test(inner);
  return {
    text: clean,
    range: editable ? { start: tagBounds.end, end: closeMatch.index } : null,
  };
}

function hashString(value = "") {
  let hash = 0;
  const text = String(value || "");
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash).toString(36);
}

function buildLinkRecord({
  sourcePath,
  sourceFormat,
  linkKind,
  linkProperty,
  rawTarget,
  linkText = "",
  ranges = {},
  metadata = {},
  recordIndex,
}) {
  const source = normalizeNotebookRelativePath(sourcePath);
  const targetRaw = String(rawTarget || "").trim();
  const targetPath = isExternalLink(targetRaw) ? "" : resolveNotebookLink(source, targetRaw);
  const targetKind = isExternalLink(targetRaw) ? "external" : "internal";
  const tags = Array.isArray(metadata.tags) ? metadata.tags : csvToList(metadata.tags);
  const symbols = normalizeSymbols(metadata.symbols);
  const displayText = String(metadata.displayText || "").trim();
  const edgeLabel = makeEdgeLabel({ displayText, symbols });
  const start = ranges?.target?.start ?? 0;

  return {
    id: `${sourceFormat}:${recordIndex}:${start}:${hashString(targetRaw)}`,
    recordIndex,
    sourcePath: source,
    sourceFormat,
    linkKind,
    linkProperty,
    targetRaw,
    targetKind,
    targetPath: targetPath || targetRaw,
    linkText: String(linkText || "").trim(),
    tags,
    symbols,
    displayText,
    edgeLabel,
    editableTarget: Boolean(ranges?.target),
    editableText: Boolean(ranges?.text),
    editableMetadata: Boolean(ranges?.metadata || ranges?.htmlTag),
    ranges,
  };
}

export function makeEdgeLabel(record = {}) {
  const displayText = String(record.displayText || "").trim();
  const symbols = normalizeSymbols(record.symbols);
  const symbolText = symbols.join(" ");
  if (displayText && symbolText) return `${symbolText} ${displayText}`;
  return displayText || symbolText;
}

function parseHtmlLinks(content, sourcePath, startIndex) {
  const records = [];
  const text = String(content || "");
  const attrNames = [...HTML_LINK_ATTRS.keys()].join("|").replace(/-/g, "\\-");
  const attrRegex = new RegExp(`\\b(${attrNames})\\s*=\\s*(["'])(.*?)\\2`, "gi");
  let match;
  let recordIndex = startIndex;

  while ((match = attrRegex.exec(text))) {
    const attrName = String(match[1] || "").toLowerCase();
    const rawTarget = String(match[3] || "").trim();
    if (!rawTarget || isIgnoredLink(rawTarget)) continue;

    const whole = match[0] || "";
    const valueStart = match.index + whole.lastIndexOf(match[3]);
    const valueEnd = valueStart + match[3].length;
    const tagBounds = findHtmlTagBounds(text, match.index);
    const metadata = readHtmlMetadata(text, tagBounds);
    const anchorText = parseAnchorTextRange(text, tagBounds);

    records.push(buildLinkRecord({
      sourcePath,
      sourceFormat: "html",
      linkKind: HTML_LINK_ATTRS.get(attrName) || attrName,
      linkProperty: attrName,
      rawTarget,
      linkText: anchorText?.text || "",
      metadata,
      recordIndex,
      ranges: {
        target: { start: valueStart, end: valueEnd },
        text: anchorText?.range || null,
        htmlTag: tagBounds
          ? {
              start: tagBounds.start,
              end: tagBounds.end,
              insertAt: tagBounds.insertAt,
              tagName: tagBounds.tagName,
              attrRanges: metadata.attrRanges || {},
            }
          : null,
      },
    }));
    recordIndex += 1;
  }

  const cssUrlRegex = /url\(\s*(?:"([^"]+)"|'([^']+)'|([^'"\)]+))\s*\)/gi;
  while ((match = cssUrlRegex.exec(text))) {
    const rawTarget = String(match[1] || match[2] || match[3] || "").trim();
    if (!rawTarget || isIgnoredLink(rawTarget)) continue;
    const valueStart = match.index + match[0].indexOf(rawTarget);
    records.push(buildLinkRecord({
      sourcePath,
      sourceFormat: "html",
      linkKind: "resource",
      linkProperty: "css-url",
      rawTarget,
      recordIndex,
      ranges: {
        target: { start: valueStart, end: valueStart + rawTarget.length },
      },
    }));
    recordIndex += 1;
  }

  return records;
}

function parseMarkdownMetadata(raw = "") {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return { tags: [], symbols: [], displayText: "" };
  try {
    const parsed = JSON.parse(trimmed);
    return {
      tags: Array.isArray(parsed.tags) ? parsed.tags : csvToList(parsed.tags),
      symbols: normalizeSymbols(parsed.symbols),
      displayText: String(parsed.displayText || parsed.label || "").trim(),
    };
  } catch {
    return { tags: [], symbols: [], displayText: "" };
  }
}

function serializeMarkdownMetadata({ tags = [], symbols = [], displayText = "" } = {}) {
  const payload = {};
  const cleanTags = csvToList(listToCsv(tags));
  const cleanSymbols = normalizeSymbols(symbols);
  const cleanDisplayText = String(displayText || "").trim();
  if (cleanTags.length) payload.tags = cleanTags;
  if (cleanSymbols.length) payload.symbols = cleanSymbols;
  if (cleanDisplayText) payload.displayText = cleanDisplayText;
  if (!Object.keys(payload).length) return "";
  return `<!-- ${MARKDOWN_METADATA_PREFIX} ${JSON.stringify(payload)} -->`;
}

function parseMarkdownDestination(rawInside = "") {
  const inside = String(rawInside || "");
  const trimmedStart = inside.match(/^\s*/)?.[0]?.length || 0;
  const body = inside.slice(trimmedStart);
  if (!body) return null;

  if (body.startsWith("<")) {
    const close = body.indexOf(">");
    if (close > 1) {
      return {
        target: body.slice(1, close),
        offset: trimmedStart + 1,
      };
    }
  }

  const match = body.match(/^\S+/);
  if (!match) return null;
  return {
    target: match[0],
    offset: trimmedStart,
  };
}

function parseMarkdownLinks(content, sourcePath, startIndex) {
  const records = [];
  const text = String(content || "");
  const mdRegex = /(!?)\[([^\]\n]*)\]\(([^)\n]+)\)(\s*<!--\s*nodevision-link\s+({[\s\S]*?})\s*-->)?/g;
  let match;
  let recordIndex = startIndex;

  while ((match = mdRegex.exec(text))) {
    const bang = match[1] || "";
    const label = match[2] || "";
    const destination = parseMarkdownDestination(match[3] || "");
    if (!destination?.target || isIgnoredLink(destination.target)) continue;

    const linkPrefixLength = bang.length + 1 + label.length + 2;
    const targetStart = match.index + linkPrefixLength + destination.offset;
    const targetEnd = targetStart + destination.target.length;
    const textStart = match.index + bang.length + 1;
    const textEnd = textStart + label.length;
    const commentStart = match[4] ? match.index + match[0].length - match[4].length : null;
    const commentEnd = match[4] ? match.index + match[0].length : null;
    const metadata = parseMarkdownMetadata(match[5] || "");

    records.push(buildLinkRecord({
      sourcePath,
      sourceFormat: "markdown",
      linkKind: bang ? "image" : "hyperlink",
      linkProperty: bang ? "markdown-image" : "markdown-link",
      rawTarget: destination.target,
      linkText: label,
      metadata,
      recordIndex,
      ranges: {
        target: { start: targetStart, end: targetEnd },
        text: { start: textStart, end: textEnd },
        metadata: {
          type: "markdown-comment",
          start: commentStart,
          end: commentEnd,
          insertAt: match.index + (match[0].length - (match[4]?.length || 0)),
        },
      },
    }));
    recordIndex += 1;
  }

  return records;
}

function isIgnoredLink(rawLink = "") {
  const link = String(rawLink || "").trim();
  if (!link) return true;
  if (link.startsWith("#")) return true;
  if (/^(data|javascript|mailto|file):/i.test(link)) return true;
  if (/^\/\//.test(link)) return true;
  return false;
}

export function parseLinkRecordsFromText(content, sourcePath) {
  const ext = normalizeNotebookRelativePath(sourcePath).split(".").pop()?.toLowerCase() || "";
  if (["html", "htm", "xhtml", "php"].includes(ext)) {
    return parseHtmlLinks(content, sourcePath, 0);
  }
  if (["md", "markdown"].includes(ext)) {
    return parseMarkdownLinks(content, sourcePath, 0);
  }
  return [];
}

export async function fetchNotebookText(path) {
  const sourcePath = normalizeNotebookRelativePath(path);
  const res = await fetch(`/api/fileCodeContent?path=${encodeURIComponent(sourcePath)}`, { cache: "no-store" });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data) {
    throw new Error(data?.error || `Failed to read ${sourcePath}`);
  }
  return {
    content: String(data.content ?? ""),
    encoding: data.encoding || "utf8",
    bom: Boolean(data.bom),
    isBinary: Boolean(data.isBinary),
  };
}

export async function scanFileForLinkRecords(sourcePath) {
  try {
    const { content, isBinary } = await fetchNotebookText(sourcePath);
    if (isBinary) return [];
    return parseLinkRecordsFromText(content, sourcePath);
  } catch (err) {
    console.warn(`[LinkRecords] Could not scan ${sourcePath}:`, err);
    return [];
  }
}

export function linkRecordTargetId(record) {
  if (!record) return "";
  if (record.targetKind === "external") {
    return isHttpLink(record.targetRaw)
      ? `external:${encodeURIComponent(record.targetRaw)}`
      : record.targetRaw;
  }
  return normalizeNotebookRelativePath(record.targetPath || record.targetRaw);
}

export function summarizeLinkRecord(record = {}) {
  const text = String(record.linkText || "").trim();
  const display = String(record.displayText || "").trim();
  const target = String(record.targetRaw || record.targetPath || "").trim();
  return display || text || target || "Link";
}

function findMatchingRecord(content, selectedRecord) {
  const records = parseLinkRecordsFromText(content, selectedRecord?.sourcePath || "");
  if (!records.length) return null;
  const selectedId = selectedRecord?.id;
  const selectedIndex = Number(selectedRecord?.recordIndex);
  const selectedTarget = String(selectedRecord?.targetRaw || "").trim();
  const selectedProperty = String(selectedRecord?.linkProperty || "").trim();

  return records.find((record) => record.id === selectedId) ||
    records.find((record) =>
      record.recordIndex === selectedIndex &&
      record.linkProperty === selectedProperty &&
      record.targetRaw === selectedTarget
    ) ||
    records.find((record) =>
      record.linkProperty === selectedProperty &&
      record.targetRaw === selectedTarget
    ) ||
    records[selectedIndex] ||
    null;
}

function removeRangeWithLeadingSpace(content, start, end) {
  let cleanStart = start;
  while (cleanStart > 0 && /[ \t]/.test(content[cleanStart - 1])) cleanStart -= 1;
  return { start: cleanStart, end, value: "" };
}

function metadataIsEmpty(patch = {}) {
  return !csvToList(patch.tags).length &&
    !normalizeSymbols(patch.symbols).length &&
    !String(patch.displayText || "").trim();
}

function htmlMetadataReplacements(record, patch) {
  const htmlTag = record?.ranges?.htmlTag;
  if (!htmlTag) return [];

  const replacements = [];
  for (const [key, attrName] of Object.entries(NODEVISION_METADATA_ATTRS)) {
    const value = key === "tags"
      ? listToCsv(patch.tags)
      : key === "symbols"
        ? normalizeSymbols(patch.symbols).join(" ")
        : String(patch.displayText || "").trim();
    const existing = htmlTag.attrRanges?.[key] || null;

    if (existing) {
      if (value) {
        replacements.push({
          start: existing.valueStart,
          end: existing.valueEnd,
          value: escapeHtmlAttribute(value),
        });
      } else {
        replacements.push({
          start: existing.wholeStart,
          end: existing.wholeEnd,
          value: "",
        });
      }
    } else if (value && Number.isFinite(htmlTag.insertAt)) {
      replacements.push({
        start: htmlTag.insertAt,
        end: htmlTag.insertAt,
        value: ` ${attrName}="${escapeHtmlAttribute(value)}"`,
      });
    }
  }

  return replacements;
}

function markdownMetadataReplacement(content, record, patch) {
  const metadata = record?.ranges?.metadata;
  if (!metadata) return null;
  const serialized = serializeMarkdownMetadata(patch);
  if (metadata.start !== null && metadata.end !== null) {
    if (!serialized) return removeRangeWithLeadingSpace(content, metadata.start, metadata.end);
    return { start: metadata.start, end: metadata.end, value: ` ${serialized}` };
  }
  if (!serialized || !Number.isFinite(metadata.insertAt)) return null;
  return { start: metadata.insertAt, end: metadata.insertAt, value: ` ${serialized}` };
}

function applyReplacements(content, replacements) {
  const sorted = replacements
    .filter((rep) => rep && Number.isFinite(rep.start) && Number.isFinite(rep.end) && rep.start <= rep.end)
    .sort((a, b) => b.start - a.start);
  let output = String(content || "");
  for (const rep of sorted) {
    output = output.slice(0, rep.start) + String(rep.value ?? "") + output.slice(rep.end);
  }
  return output;
}

export function applyLinkRecordEdit(content, selectedRecord, patch = {}) {
  const record = findMatchingRecord(content, selectedRecord);
  if (!record) {
    throw new Error("The selected link could not be found in the current source file.");
  }

  const replacements = [];
  const nextTarget = String(patch.targetRaw ?? record.targetRaw ?? "").trim();
  if (nextTarget && record.ranges?.target && nextTarget !== record.targetRaw) {
    replacements.push({
      start: record.ranges.target.start,
      end: record.ranges.target.end,
      value: nextTarget,
    });
  }

  if (record.ranges?.text && patch.linkText !== undefined) {
    const nextText = String(patch.linkText || "");
    if (nextText !== record.linkText) {
      replacements.push({
        start: record.ranges.text.start,
        end: record.ranges.text.end,
        value: record.sourceFormat === "html" ? escapeHtmlText(nextText) : nextText,
      });
    }
  }

  const metadataPatch = {
    tags: patch.tags ?? record.tags,
    symbols: patch.symbols ?? record.symbols,
    displayText: patch.displayText ?? record.displayText,
  };

  if (record.sourceFormat === "html") {
    replacements.push(...htmlMetadataReplacements(record, metadataPatch));
  } else if (record.sourceFormat === "markdown") {
    const replacement = markdownMetadataReplacement(content, record, metadataPatch);
    if (replacement && (!metadataIsEmpty(metadataPatch) || record.ranges?.metadata?.start !== null)) {
      replacements.push(replacement);
    }
  }

  const nextContent = applyReplacements(content, replacements);
  const updatedRecords = parseLinkRecordsFromText(nextContent, record.sourcePath);
  const updatedRecord = updatedRecords.find((next) =>
    next.recordIndex === record.recordIndex &&
    (next.targetRaw === nextTarget || next.linkProperty === record.linkProperty)
  ) || updatedRecords[record.recordIndex] || null;

  return {
    content: nextContent,
    changed: nextContent !== content,
    record,
    updatedRecord,
  };
}

export async function saveNotebookText({ path, content, encoding = "utf8", bom = false }) {
  const sourcePath = normalizeNotebookRelativePath(path);
  const res = await fetch("/api/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: sourcePath,
      sourcePath,
      content,
      encoding,
      bom,
    }),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.success) {
    throw new Error(data?.error || `Failed to save ${sourcePath}`);
  }
  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function") {
    window.dispatchEvent(new CustomEvent("nodevision-file-saved", { detail: { filePath: sourcePath } }));
  }
  return data;
}

export function buildSelectedGraphLink(edgeData = {}, occurrenceIndex = 0) {
  const records = Array.isArray(edgeData.linkRecords) ? edgeData.linkRecords : [];
  const safeIndex = records.length ? Math.max(0, Math.min(records.length - 1, Number(occurrenceIndex) || 0)) : 0;
  const fallback = records.length ? null : {
    id: "edge:" + (edgeData.id || ""),
    recordIndex: 0,
    sourcePath: edgeData.sourcePath || edgeData.source || "",
    sourceFormat: "edge",
    linkKind: edgeData.linkKind || "link",
    linkProperty: edgeData.linkProperty || "",
    targetRaw: edgeData.targetPath || edgeData.target || "",
    targetKind: edgeData.targetKind || (String(edgeData.targetPath || edgeData.target || "").startsWith("external:") ? "external" : "internal"),
    targetPath: edgeData.targetPath || edgeData.target || "",
    linkText: edgeData.linkText || "",
    tags: Array.isArray(edgeData.tags) ? edgeData.tags : [],
    symbols: Array.isArray(edgeData.symbols) ? edgeData.symbols : [],
    displayText: edgeData.displayText || "",
    edgeLabel: edgeData.edgeLabel || "",
    editableTarget: false,
    editableText: false,
    editableMetadata: false,
    ranges: {},
  };
  const selected = records[safeIndex] || fallback || null;
  const occurrences = records.length ? records : (selected ? [selected] : []);
  return {
    edgeId: edgeData.id || "",
    source: edgeData.source || selected?.sourcePath || "",
    target: edgeData.target || selected?.targetPath || "",
    occurrenceIndex: safeIndex,
    occurrenceCount: occurrences.length,
    occurrences,
    record: selected,
  };
}

export function setSelectedGraphLink(selection) {
  if (typeof window === "undefined") return selection;
  window.NodevisionState = window.NodevisionState || {};
  window.selectedGraphLink = selection || null;
  window.NodevisionState.selectedGraphLink = selection || null;
  window.dispatchEvent(new CustomEvent("nodevision-graph-link-selected", {
    detail: { selection: selection || null },
  }));
  if (typeof window.updateLinkViewerPanel === "function") {
    window.updateLinkViewerPanel(selection || null);
  }
  if (typeof window.updateLinkEditorPanel === "function") {
    window.updateLinkEditorPanel(selection || null);
  }
  return selection;
}

export function selectedGraphLink() {
  if (typeof window === "undefined") return null;
  return window.selectedGraphLink || window.NodevisionState?.selectedGraphLink || null;
}

