// Nodevision/ApplicationSystem/public/utils/markdownRenderer.mjs
// This module renders a safe subset of Markdown for Nodevision viewers and graphical editors while sharing escaping, link resolution, and theme-aware presentation styles across those surfaces.

const STYLE_ID = "nv-markdown-renderer-styles";

function normalizeLineEndings(text = "") {
  return String(text || "").replace(/\r\n?/g, "\n");
}

function escapeHTML(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeAttribute(value = "") {
  return escapeHTML(value).replaceAll('"', "&quot;");
}

function dirname(path = "") {
  const clean = String(path || "").replace(/[?#].*$/, "").replace(/\\/g, "/");
  const idx = clean.lastIndexOf("/");
  return idx === -1 ? "" : clean.slice(0, idx);
}

function normalizePath(path = "") {
  const parts = [];
  String(path || "").replace(/\\/g, "/").split("/").forEach((part) => {
    if (!part || part === ".") return;
    if (part === "..") parts.pop();
    else parts.push(part);
  });
  return parts.join("/");
}

function notebookUrl(path = "") {
  const encoded = normalizePath(path)
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
  return encoded ? `/Notebook/${encoded}` : "#";
}

function resolveMarkdownUrl(rawUrl = "", context = {}, { image = false } = {}) {
  let url = String(rawUrl || "").trim();
  if (url.startsWith("<") && url.endsWith(">")) url = url.slice(1, -1).trim();
  if (!url) return "#";

  if (/^#/i.test(url)) return url;
  if (/^(https?:|mailto:|tel:)/i.test(url)) return url;
  if (image && /^data:image\/(?:png|jpe?g|gif|webp);base64,/i.test(url)) return url;
  if (/^[a-z][a-z0-9+.-]*:/i.test(url)) return "#";
  if (url.startsWith("/")) return url;

  const base = dirname(context.filePath || "");
  return notebookUrl(base ? `${base}/${url}` : url);
}

function stashHtml(placeholders, html) {
  const marker = `\u0000NVMD${placeholders.length}\u0000`;
  placeholders.push({ marker, html });
  return marker;
}

function restoreHtmlPlaceholders(text, placeholders) {
  let out = text;
  placeholders.forEach(({ marker, html }) => {
    out = out.replaceAll(marker, html);
  });
  return out;
}

function codeClass(language = "") {
  const clean = String(language || "").trim().match(/^[A-Za-z0-9_-]+/)?.[0] || "";
  return clean ? ` class="language-${escapeAttribute(clean)}"` : "";
}

function renderInline(raw = "", context = {}, options = {}) {
  const placeholders = [];
  let text = normalizeLineEndings(raw);

  text = text.replace(/(`+)([\s\S]*?)\1/g, (_, _ticks, code) =>
    stashHtml(placeholders, `<code>${escapeHTML(code)}</code>`)
  );

  if (options.links !== false) {
    text = text.replace(/!\[([^\]\n]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, (_, alt, url, title = "") => {
      const src = resolveMarkdownUrl(url, context, { image: true });
      const titleAttr = title ? ` title="${escapeAttribute(title)}"` : "";
      return stashHtml(
        placeholders,
        `<img src="${escapeAttribute(src)}" alt="${escapeAttribute(alt)}"${titleAttr}>`
      );
    });

    text = text.replace(/\[([^\]\n]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, (_, label, url, title = "") => {
      const href = resolveMarkdownUrl(url, context);
      const titleAttr = title ? ` title="${escapeAttribute(title)}"` : "";
      const targetAttr = /^(https?:)?\/\//i.test(href) ? ' target="_blank" rel="noopener noreferrer"' : "";
      return stashHtml(
        placeholders,
        `<a href="${escapeAttribute(href)}"${titleAttr}${targetAttr}>${renderInline(label, context, { links: false })}</a>`
      );
    });
  }

  text = escapeHTML(text);
  text = text.replace(/\\([\\`*_[\]{}()#+\-.!>])/g, "$1");
  text = text.replace(/\*\*\*([^*]+)\*\*\*/g, "<strong><em>$1</em></strong>");
  text = text.replace(/___([^_]+)___/g, "<strong><em>$1</em></strong>");
  text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  text = text.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  text = text.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
  text = text.replace(/_([^_\n]+)_/g, "<em>$1</em>");
  text = text.replace(/~~([^~]+)~~/g, "<del>$1</del>");
  text = text.replace(/ {2,}\n/g, "<br>\n").replace(/\n+/g, " ");

  return restoreHtmlPlaceholders(text, placeholders);
}

function headingMatch(line = "") {
  return String(line).match(/^ {0,3}(#{1,6})(?:[ \t]+|(?=\S))(.+?)[ \t]*#*[ \t]*$/);
}

function isHorizontalRule(line = "") {
  return /^ {0,3}((?:-\s*){3,}|(?:_\s*){3,}|(?:\*\s*){3,})$/.test(String(line).trimEnd());
}

function listMatch(line = "") {
  const unordered = String(line).match(/^ {0,3}([-+*])[ \t]+(.+)$/);
  if (unordered) return { ordered: false, text: unordered[2] };
  const ordered = String(line).match(/^ {0,3}\d+[.)][ \t]+(.+)$/);
  if (ordered) return { ordered: true, text: ordered[1] };
  return null;
}

function isBlockStart(line = "") {
  return Boolean(
    headingMatch(line) ||
    isHorizontalRule(line) ||
    listMatch(line) ||
    /^ {0,3}>/.test(line) ||
    /^ {0,3}(```+|~~~+)/.test(line) ||
    /^(?: {4}|\t)/.test(line)
  );
}

function renderList(lines, startIndex, context, ordered) {
  const tag = ordered ? "ol" : "ul";
  const items = [];
  let i = startIndex;

  while (i < lines.length) {
    const match = listMatch(lines[i]);
    if (!match || match.ordered !== ordered) break;

    const itemLines = [match.text];
    i += 1;
    while (i < lines.length) {
      if (!lines[i].trim()) {
        if (i + 1 < lines.length && listMatch(lines[i + 1])?.ordered === ordered) break;
        itemLines.push("");
        i += 1;
        continue;
      }
      if (listMatch(lines[i])) break;
      if (/^(?: {2,}|\t)/.test(lines[i])) {
        itemLines.push(lines[i].replace(/^(?: {2,4}|\t)/, ""));
        i += 1;
        continue;
      }
      break;
    }

    items.push(`<li>${renderInline(itemLines.join("\n").trim(), context)}</li>`);
  }

  return { html: `<${tag}>\n${items.join("\n")}\n</${tag}>`, nextIndex: i };
}

function renderMarkdownBlocks(source = "", context = {}) {
  const lines = normalizeLineEndings(source).split("\n");
  const blocks = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i += 1;
      continue;
    }

    const fence = line.match(/^ {0,3}(```+|~~~+)[ \t]*([A-Za-z0-9_-]+)?[ \t]*$/);
    if (fence) {
      const marker = fence[1][0];
      const minLength = fence[1].length;
      const codeLines = [];
      i += 1;
      while (i < lines.length && !new RegExp(`^ {0,3}${marker}{${minLength},}[ \\t]*$`).test(lines[i])) {
        codeLines.push(lines[i]);
        i += 1;
      }
      if (i < lines.length) i += 1;
      blocks.push(`<pre><code${codeClass(fence[2])}>${escapeHTML(codeLines.join("\n"))}</code></pre>`);
      continue;
    }

    if (/^(?: {4}|\t)/.test(line)) {
      const codeLines = [];
      while (i < lines.length && (/^(?: {4}|\t)/.test(lines[i]) || !lines[i].trim())) {
        codeLines.push(lines[i].replace(/^(?: {4}|\t)/, ""));
        i += 1;
      }
      blocks.push(`<pre><code>${escapeHTML(codeLines.join("\n").replace(/\n+$/, ""))}</code></pre>`);
      continue;
    }

    const heading = headingMatch(line);
    if (heading) {
      const level = heading[1].length;
      blocks.push(`<h${level}>${renderInline(heading[2], context)}</h${level}>`);
      i += 1;
      continue;
    }

    if (isHorizontalRule(line)) {
      blocks.push("<hr>");
      i += 1;
      continue;
    }

    if (/^ {0,3}>/.test(line)) {
      const quoteLines = [];
      while (i < lines.length && (/^ {0,3}> ?/.test(lines[i]) || !lines[i].trim())) {
        quoteLines.push(lines[i].replace(/^ {0,3}> ?/, ""));
        i += 1;
      }
      blocks.push(`<blockquote>\n${renderMarkdownBlocks(quoteLines.join("\n"), context)}\n</blockquote>`);
      continue;
    }

    const list = listMatch(line);
    if (list) {
      const rendered = renderList(lines, i, context, list.ordered);
      blocks.push(rendered.html);
      i = rendered.nextIndex;
      continue;
    }

    const paragraph = [];
    while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) {
      paragraph.push(lines[i]);
      i += 1;
    }
    blocks.push(`<p>${renderInline(paragraph.join("\n"), context)}</p>`);
  }

  return blocks.join("\n");
}

export function renderMarkdown(source = "", options = {}) {
  return renderMarkdownBlocks(source, { filePath: options.filePath || "" });
}

export function markdownStylesCss() {
  return `
.nv-markdown-rendered {
  box-sizing: border-box;
  color: var(--nv-markdown-text, #1f2937);
  font: 15px/1.65 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  overflow-wrap: anywhere;
}
.nv-markdown-rendered > :first-child { margin-top: 0; }
.nv-markdown-rendered > :last-child { margin-bottom: 0; }
.nv-markdown-rendered h1,
.nv-markdown-rendered h2,
.nv-markdown-rendered h3,
.nv-markdown-rendered h4,
.nv-markdown-rendered h5,
.nv-markdown-rendered h6 {
  color: var(--nv-markdown-heading, #111827);
  font-weight: 700;
  line-height: 1.22;
  margin: 1.15em 0 0.45em;
}
.nv-markdown-rendered h1 { font-size: 2rem; border-bottom: 1px solid var(--nv-markdown-rule, #d1d5db); padding-bottom: 0.25em; }
.nv-markdown-rendered h2 { font-size: 1.55rem; border-bottom: 1px solid var(--nv-markdown-rule, #d1d5db); padding-bottom: 0.2em; }
.nv-markdown-rendered h3 { font-size: 1.25rem; }
.nv-markdown-rendered h4 { font-size: 1.1rem; }
.nv-markdown-rendered h5,
.nv-markdown-rendered h6 { font-size: 1rem; }
.nv-markdown-rendered p { margin: 0.65em 0; }
.nv-markdown-rendered a { color: var(--nv-markdown-link, #1d4ed8); text-decoration: underline; text-underline-offset: 2px; }
.nv-markdown-rendered img { display: block; max-width: 100%; height: auto; margin: 0.75em 0; }
.nv-markdown-rendered ul,
.nv-markdown-rendered ol { margin: 0.65em 0 0.65em 1.5em; padding-left: 1.25em; }
.nv-markdown-rendered li { margin: 0.25em 0; }
.nv-markdown-rendered blockquote {
  margin: 0.8em 0;
  padding: 0.35em 0 0.35em 0.9em;
  border-left: 4px solid var(--nv-markdown-quote-border, #93c5fd);
  color: var(--nv-markdown-muted, #4b5563);
  background: var(--nv-markdown-quote-bg, rgba(147, 197, 253, 0.12));
}
.nv-markdown-rendered code {
  border-radius: 4px;
  background: var(--nv-markdown-code-bg, #eef2f7);
  color: var(--nv-markdown-code-text, #111827);
  font: 0.92em/1.5 ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  padding: 0.12em 0.32em;
}
.nv-markdown-rendered pre {
  margin: 0.85em 0;
  padding: 0.9em;
  overflow: auto;
  border: 1px solid var(--nv-markdown-rule, #d1d5db);
  border-radius: 6px;
  background: var(--nv-markdown-pre-bg, #f8fafc);
}
.nv-markdown-rendered pre code {
  display: block;
  padding: 0;
  background: transparent;
  white-space: pre;
}
.nv-markdown-rendered hr {
  border: 0;
  border-top: 1px solid var(--nv-markdown-rule, #d1d5db);
  margin: 1.25em 0;
}
html[data-nv-theme="dark"] .nv-markdown-rendered {
  --nv-markdown-text: #e5e7eb;
  --nv-markdown-heading: #f9fafb;
  --nv-markdown-rule: #475569;
  --nv-markdown-link: #93c5fd;
  --nv-markdown-muted: #cbd5e1;
  --nv-markdown-code-bg: #1f2937;
  --nv-markdown-code-text: #f8fafc;
  --nv-markdown-pre-bg: #111827;
  --nv-markdown-quote-border: #60a5fa;
  --nv-markdown-quote-bg: rgba(96, 165, 250, 0.12);
}`;
}

export function ensureMarkdownStyles(rootDocument = document) {
  if (!rootDocument || rootDocument.getElementById(STYLE_ID)) return;
  const style = rootDocument.createElement("style");
  style.id = STYLE_ID;
  style.textContent = markdownStylesCss();
  rootDocument.head?.appendChild(style);
}

export function applyMarkdownRenderClass(element) {
  if (!element) return element;
  element.classList.add("nv-markdown-rendered");
  return element;
}
