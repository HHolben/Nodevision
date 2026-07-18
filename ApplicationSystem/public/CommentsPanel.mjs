// Nodevision/ApplicationSystem/public/CommentsPanel.mjs
// On-demand comments rail for source comments in viewers and editors.

import { setStatus } from "/StatusBar.mjs";
import { normalizeNotebookRelativePath, toNotebookAssetUrl } from "/utils/notebookPath.mjs";

const PANEL_WIDTH = "360px";
const COLLAPSED_WIDTH = "44px";
const PANEL_STATE_KEY = "__nvCommentsPanelMounted";
const ANCHOR_CLASS = "nv-comments-source-anchor";

const state = {
  panel: null,
  overlay: null,
  statusEl: null,
  sourceEl: null,
  countEl: null,
  listEl: null,
  addBtn: null,
  refreshBtn: null,
  collapseBtn: null,
  comments: [],
  context: null,
  sourceCleanup: null,
  refreshTimer: 0,
  drawRaf: 0,
  mounted: false,
};

function escapeHtml(value = "") {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizePath(value) {
  if (typeof value !== "string") return "";
  return normalizeNotebookRelativePath(value);
}

function extensionOf(path = "") {
  const clean = normalizePath(path).toLowerCase();
  const name = clean.split("/").pop() || clean;
  if (name.endsWith(".d.ts")) return "ts";
  if (name.endsWith(".td.json")) return "json";
  if (name.endsWith(".terrain.json")) return "json";
  if (name.endsWith(".nvcircuit.json")) return "json";
  const parts = name.split(".");
  return parts.length > 1 ? parts.pop() : "";
}

function getActiveFilePath(preferred = "") {
  const candidates = [
    preferred,
    window.activeCell?.dataset?.currentFilePath,
    document.activeElement?.closest?.(".panel-cell")?.dataset?.currentFilePath,
    window.NodevisionState?.activeEditorFilePath,
    window.currentActiveFilePath,
    window.selectedFilePath,
    window.NodevisionState?.selectedFile,
    window.ActiveNode,
    window.filePath,
  ];

  for (const candidate of candidates) {
    const normalized = normalizePath(candidate);
    if (normalized) return normalized;
  }
  return "";
}

function getCommentSyntax(filePath = "") {
  const ext = extensionOf(filePath);
  const cLike = {
    linePrefixes: ["//"],
    blockPairs: [{ open: "/*", close: "*/", label: "block" }],
    insert: { kind: "line", prefix: "//" },
  };
  const hashLike = {
    linePrefixes: ["#"],
    blockPairs: [],
    insert: { kind: "line", prefix: "#" },
  };
  const htmlLike = {
    linePrefixes: [],
    blockPairs: [{ open: "<!--", close: "-->", label: "html" }],
    insert: { kind: "block", open: "<!--", close: "-->" },
  };

  if (["html", "htm", "xml", "svg", "xhtml", "md", "markdown"].includes(ext)) return htmlLike;
  if (["css", "scss", "sass", "less"].includes(ext)) {
    return {
      linePrefixes: ext === "scss" || ext === "sass" || ext === "less" ? ["//"] : [],
      blockPairs: cLike.blockPairs,
      insert: { kind: "block", open: "/*", close: "*/" },
    };
  }
  if (["py", "sh", "bash", "zsh", "rb", "yaml", "yml", "toml", "ini", "conf", "cfg", "properties"].includes(ext)) return hashLike;
  if (["sql"].includes(ext)) {
    return {
      linePrefixes: ["--"],
      blockPairs: cLike.blockPairs,
      insert: { kind: "line", prefix: "--" },
    };
  }
  if (["lua"].includes(ext)) {
    return {
      linePrefixes: ["--"],
      blockPairs: [{ open: "--[[", close: "]]", label: "block" }],
      insert: { kind: "line", prefix: "--" },
    };
  }
  if (["m", "mm"].includes(ext)) {
    return {
      linePrefixes: ["//", "%"],
      blockPairs: cLike.blockPairs,
      insert: { kind: "line", prefix: "//" },
    };
  }
  if (["js", "mjs", "cjs", "ts", "tsx", "jsx", "java", "c", "cc", "cpp", "h", "hpp", "cs", "go", "rs", "php", "ino", "json"].includes(ext)) {
    return cLike;
  }
  return cLike;
}

function buildLineStarts(text = "") {
  const starts = [0];
  for (let i = 0; i < text.length; i += 1) {
    if (text[i] === "\n") starts.push(i + 1);
  }
  return starts;
}

function positionForOffset(lineStarts, offset) {
  let lo = 0;
  let hi = lineStarts.length - 1;
  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    if (lineStarts[mid] <= offset) lo = mid + 1;
    else hi = mid - 1;
  }
  const lineIndex = Math.max(0, hi);
  return {
    line: lineIndex + 1,
    column: offset - lineStarts[lineIndex] + 1,
  };
}

function lineEndOffset(text, start) {
  const idx = text.indexOf("\n", start);
  if (idx < 0) return text.length;
  return idx > start && text[idx - 1] === "\r" ? idx - 1 : idx;
}

function trimOneLeadingSpace(value = "") {
  return String(value).replace(/^\s?/, "");
}

function splitLines(value = "") {
  return String(value).replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
}

function bodyParts(raw = "") {
  const text = String(raw);
  const leading = text.match(/^\s*/)?.[0] || "";
  const trailing = text.match(/\s*$/)?.[0] || "";
  const body = text.slice(leading.length, text.length - trailing.length);
  return { leading, body, trailing };
}

function isOffsetInsideRange(offset, ranges = []) {
  return ranges.some((range) => offset >= range.start && offset < range.end);
}

function findLineComment(lineText = "", prefixes = []) {
  let quote = "";
  let escaped = false;
  for (let i = 0; i < lineText.length; i += 1) {
    const ch = lineText[i];

    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (ch === "\\") {
        escaped = true;
      } else if (ch === quote) {
        quote = "";
      }
      continue;
    }

    if (ch === "\"" || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }

    for (const prefix of prefixes) {
      if (!lineText.startsWith(prefix, i)) continue;
      if (prefix === "//" && lineText[i - 1] === ":") continue;
      if (prefix === "#" && i === 0 && lineText.startsWith("#!")) continue;
      return { index: i, prefix };
    }
  }
  return null;
}

function finalizeLineGroup(group, comments) {
  if (!group) return;
  comments.push({
    ...group,
    body: group.bodyLines.join("\n"),
    bodyLines: undefined,
  });
}

function parseTextComments(text = "", filePath = "") {
  const syntax = getCommentSyntax(filePath);
  const lineStarts = buildLineStarts(text);
  const comments = [];
  const blockRanges = [];

  for (const pair of syntax.blockPairs || []) {
    let cursor = 0;
    while (cursor < text.length) {
      const start = text.indexOf(pair.open, cursor);
      if (start < 0) break;
      const bodyStart = start + pair.open.length;
      const closeStart = text.indexOf(pair.close, bodyStart);
      const bodyEnd = closeStart < 0 ? text.length : closeStart;
      const end = closeStart < 0 ? text.length : closeStart + pair.close.length;
      const pos = positionForOffset(lineStarts, start);
      const bodyRaw = text.slice(bodyStart, bodyEnd);
      const parts = bodyParts(bodyRaw);

      blockRanges.push({ start, end });
      comments.push({
        id: "",
        sourceType: "text",
        kind: pair.label || "block",
        line: pos.line,
        column: pos.column,
        startOffset: bodyStart,
        endOffset: bodyEnd,
        fullStartOffset: start,
        fullEndOffset: end,
        replaceMode: "body",
        leading: parts.leading,
        trailing: parts.trailing,
        body: parts.body,
        preview: parts.body,
      });
      cursor = Math.max(end, start + pair.open.length);
    }
  }

  let group = null;
  for (let lineIndex = 0; lineIndex < lineStarts.length; lineIndex += 1) {
    const start = lineStarts[lineIndex];
    const end = lineEndOffset(text, start);
    const lineText = text.slice(start, end);
    const found = findLineComment(lineText, syntax.linePrefixes || []);
    if (!found || isOffsetInsideRange(start + found.index, blockRanges)) {
      finalizeLineGroup(group, comments);
      group = null;
      continue;
    }

    const before = lineText.slice(0, found.index);
    const rawBody = lineText.slice(found.index + found.prefix.length);
    const body = trimOneLeadingSpace(rawBody);
    const standalone = before.trim() === "";
    if (!standalone) {
      finalizeLineGroup(group, comments);
      group = null;
      const bodyPrefix = rawBody.startsWith(" ") ? " " : "";
      comments.push({
        id: "",
        sourceType: "text",
        kind: "line",
        line: lineIndex + 1,
        column: found.index + 1,
        startOffset: start + found.index + found.prefix.length + bodyPrefix.length,
        endOffset: end,
        fullStartOffset: start + found.index,
        fullEndOffset: end,
        replaceMode: "body",
        leading: "",
        trailing: "",
        body,
        preview: body,
      });
      continue;
    }

    if (group && group.prefix === found.prefix && group.indent === before && group.endLine === lineIndex) {
      group.bodyLines.push(body);
      group.endLine = lineIndex + 1;
      group.endOffset = end;
      group.fullEndOffset = end;
    } else {
      finalizeLineGroup(group, comments);
      group = {
        id: "",
        sourceType: "text",
        kind: "line-block",
        line: lineIndex + 1,
        column: found.index + 1,
        endLine: lineIndex + 1,
        startOffset: start,
        endOffset: end,
        fullStartOffset: start,
        fullEndOffset: end,
        replaceMode: "line-block",
        indent: before,
        prefix: found.prefix,
        bodyLines: [body],
        leading: "",
        trailing: "",
        body,
        preview: body,
      };
    }
  }
  finalizeLineGroup(group, comments);

  return comments
    .sort((a, b) => a.fullStartOffset - b.fullStartOffset)
    .map((comment, index) => ({
      ...comment,
      id: `comment-${comment.fullStartOffset}-${comment.fullEndOffset}-${index}`,
    }));
}

function formatLineBlockComment(comment, nextBody = "") {
  const lines = splitLines(nextBody);
  const indent = comment.indent || "";
  const prefix = comment.prefix || getCommentSyntax(getActiveFilePath()).insert?.prefix || "//";
  return lines.map((line) => `${indent}${prefix}${line ? ` ${line}` : ""}`).join("\n");
}

function formatCommentReplacement(comment, nextBody = "") {
  if (comment.replaceMode === "line-block") return formatLineBlockComment(comment, nextBody);
  return `${comment.leading || ""}${nextBody}${comment.trailing || ""}`;
}

function isConnectedElement(el) {
  return Boolean(el?.nodeType === 1 && el.isConnected);
}

function selectorEscape(value = "") {
  if (window.CSS?.escape) return window.CSS.escape(String(value));
  return String(value).replace(/[^a-zA-Z0-9_-]/g, "_");
}

function activeCellContains(el) {
  const cell = window.activeCell;
  return Boolean(cell?.isConnected && isConnectedElement(el) && cell.contains(el));
}

function resolveHtmlEditorContext() {
  const candidates = [
    { context: window.activeCell?.__nvHtmlEditorContext, active: true },
    { context: document.activeElement?.closest?.(".panel-cell")?.__nvHtmlEditorContext, active: true },
    { context: window.__nvActiveHtmlEditorContext, active: false },
  ];
  const mode = String(window.NodevisionState?.currentMode || "");
  const activePath = getActiveFilePath();
  for (const candidate of candidates) {
    const context = candidate.context;
    if (!context || context.kind !== "html") continue;
    const contextPath = normalizePath(context.filePath || "");
    const contextIsCurrent =
      candidate.active ||
      mode === "HTMLediting" ||
      mode === "EPUBediting" ||
      (contextPath && contextPath === activePath);
    if (!contextIsCurrent) continue;

    if (typeof context.activate === "function") context.activate();
    const root = window.HTMLWysiwygTools?.getEditorElement?.();
    if (!isConnectedElement(root)) continue;
    return {
      type: "html-dom",
      label: "HTML Editor",
      filePath: normalizePath(context.filePath || getActiveFilePath()),
      root,
      editable: true,
      save: context.save,
      getText: () => context.getHTML?.() || window.getEditorHTML?.() || "",
      markDirty: () => {
        window.HTMLWysiwygTools?.markDirty?.();
        root.dispatchEvent(new Event("input", { bubbles: true }));
      },
    };
  }
  return null;
}

function resolveMarkdownContext() {
  const textarea = document.getElementById("markdown-editor");
  if (!isConnectedElement(textarea) || !("value" in textarea)) return null;

  const mode = window.NodevisionState?.currentMode || "";
  const filePath = getActiveFilePath(window.__nvMarkdownActivePath || window.currentActiveFilePath);
  if (mode !== "MDediting" && !filePath.toLowerCase().endsWith(".md") && !activeCellContains(textarea)) return null;

  return {
    type: "textarea",
    label: "Markdown Editor",
    filePath,
    element: textarea,
    editable: true,
    getText: () => textarea.value || "",
    replaceRange(start, end, replacement) {
      textarea.focus();
      textarea.setRangeText(String(replacement), start, end, "preserve");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    },
    insertAtCaret(text) {
      const start = Number.isFinite(textarea.selectionStart) ? textarea.selectionStart : textarea.value.length;
      textarea.focus();
      textarea.setRangeText(text, start, start, "end");
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    },
    jumpTo(comment) {
      const target = Math.max(0, comment.fullStartOffset || comment.startOffset || 0);
      textarea.focus();
      textarea.setSelectionRange(target, target);
      scrollTextareaToLine(textarea, comment.line);
    },
    targetPoint(comment) {
      return pointForTextareaLine(textarea, comment.line);
    },
    subscribe(onContentChange, onGeometryChange) {
      const onInput = () => onContentChange();
      const onScroll = () => onGeometryChange();
      textarea.addEventListener("input", onInput);
      textarea.addEventListener("scroll", onScroll, { passive: true });
      return () => {
        textarea.removeEventListener("input", onInput);
        textarea.removeEventListener("scroll", onScroll);
      };
    },
  };
}

function resolveMonacoContext() {
  const editor = window.monacoEditor;
  const model = editor?.getModel?.();
  const dom = editor?.getDomNode?.();
  if (!editor || !model || !isConnectedElement(dom)) return null;

  const mode = window.NodevisionState?.currentMode || "";
  const filePath = normalizePath(window.__nvCodeEditorActivePath || window.currentActiveFilePath || getActiveFilePath());
  if (mode !== "CodeEditing" && !activeCellContains(dom)) return null;

  return {
    type: "monaco",
    label: "Code Editor",
    filePath,
    element: dom,
    editable: true,
    getText: () => model.getValue(),
    replaceRange(start, end, replacement) {
      const RangeCtor = window.monaco?.Range;
      if (!RangeCtor) return;
      const startPos = model.getPositionAt(Math.max(0, start));
      const endPos = model.getPositionAt(Math.max(0, end));
      editor.executeEdits("comments-panel", [{
        range: new RangeCtor(startPos.lineNumber, startPos.column, endPos.lineNumber, endPos.column),
        text: String(replacement),
        forceMoveMarkers: true,
      }]);
    },
    insertAtCaret(text) {
      const RangeCtor = window.monaco?.Range;
      const pos = editor.getPosition?.();
      if (!RangeCtor || !pos) return;
      editor.executeEdits("comments-panel", [{
        range: new RangeCtor(pos.lineNumber, pos.column, pos.lineNumber, pos.column),
        text,
        forceMoveMarkers: true,
      }]);
      editor.focus();
    },
    jumpTo(comment) {
      const column = Math.max(1, comment.column || 1);
      editor.revealLineInCenter?.(comment.line);
      editor.setPosition?.({ lineNumber: comment.line, column });
      editor.focus?.();
    },
    targetPoint(comment) {
      const visible = editor.getScrolledVisiblePosition?.({
        lineNumber: comment.line,
        column: Math.max(1, comment.column || 1),
      });
      if (!visible) return null;
      const rect = dom.getBoundingClientRect();
      const y = rect.top + visible.top + Math.max(visible.height || 18, 18) / 2;
      if (y < rect.top || y > rect.bottom) return null;
      return {
        x: rect.left + Math.max(10, visible.left || 0),
        y,
      };
    },
    subscribe(onContentChange, onGeometryChange) {
      const disposables = [];
      if (typeof model.onDidChangeContent === "function") disposables.push(model.onDidChangeContent(onContentChange));
      if (typeof editor.onDidScrollChange === "function") disposables.push(editor.onDidScrollChange(onGeometryChange));
      if (typeof editor.onDidLayoutChange === "function") disposables.push(editor.onDidLayoutChange(onGeometryChange));
      return () => disposables.forEach((disposable) => disposable?.dispose?.());
    },
  };
}

async function resolveViewerContext() {
  const filePath = getActiveFilePath();
  if (!filePath) return null;
  const viewRoot =
    window.activeCell?.querySelector?.("#element-view") ||
    document.querySelector(`[data-id="FileView"] #element-view`) ||
    document.getElementById("element-view");
  try {
    const response = await fetch(toNotebookAssetUrl(filePath), { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    const pre = viewRoot?.querySelector?.("pre") || null;
    return {
      type: "viewer",
      label: "File Viewer",
      filePath,
      element: viewRoot || pre,
      pre,
      editable: false,
      getText: () => text,
      targetPoint(comment, comments) {
        if (pre) return pointForPreLine(pre, comment.line);
        return pointForViewerApproximation(viewRoot, comment, comments);
      },
      subscribe(_onContentChange, onGeometryChange) {
        const target = pre || viewRoot;
        if (!target) return () => {};
        const onScroll = () => onGeometryChange();
        target.addEventListener("scroll", onScroll, { passive: true });
        return () => target.removeEventListener("scroll", onScroll);
      },
    };
  } catch (err) {
    console.warn("[CommentsPanel] Failed to read active file:", err);
    return {
      type: "viewer",
      label: "File Viewer",
      filePath,
      element: viewRoot,
      editable: false,
      error: err.message || "Unable to read file",
      getText: () => "",
    };
  }
}

async function resolveSourceContext() {
  return resolveHtmlEditorContext()
    || resolveMarkdownContext()
    || resolveMonacoContext()
    || await resolveViewerContext();
}

function lineMetrics(el) {
  const style = window.getComputedStyle(el);
  const fontSize = parseFloat(style.fontSize) || 14;
  const lineHeightRaw = parseFloat(style.lineHeight);
  const lineHeight = Number.isFinite(lineHeightRaw) ? lineHeightRaw : fontSize * 1.45;
  return {
    lineHeight,
    paddingTop: parseFloat(style.paddingTop) || 0,
    paddingLeft: parseFloat(style.paddingLeft) || 0,
  };
}

function pointForTextareaLine(textarea, lineNumber) {
  const rect = textarea.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const metrics = lineMetrics(textarea);
  const y = rect.top + metrics.paddingTop + (Math.max(1, lineNumber) - 0.5) * metrics.lineHeight - textarea.scrollTop;
  if (y < rect.top || y > rect.bottom) return null;
  return { x: rect.left + metrics.paddingLeft + 8, y };
}

function pointForPreLine(pre, lineNumber) {
  const rect = pre.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const metrics = lineMetrics(pre);
  const y = rect.top + metrics.paddingTop + (Math.max(1, lineNumber) - 0.5) * metrics.lineHeight - pre.scrollTop;
  if (y < rect.top || y > rect.bottom) return null;
  return { x: rect.left + metrics.paddingLeft + 8, y };
}

function pointForViewerApproximation(viewRoot, comment, comments = []) {
  if (!isConnectedElement(viewRoot)) return null;
  const rect = viewRoot.getBoundingClientRect();
  if (!rect.width || !rect.height) return null;
  const maxLine = Math.max(...comments.map((item) => item.line || 1), 1);
  const ratio = Math.max(0, Math.min(1, ((comment.line || 1) - 1) / Math.max(maxLine - 1, 1)));
  return {
    x: rect.left + 10,
    y: rect.top + 16 + ratio * Math.max(1, rect.height - 32),
  };
}

function scrollTextareaToLine(textarea, lineNumber) {
  const metrics = lineMetrics(textarea);
  textarea.scrollTop = Math.max(0, (Math.max(1, lineNumber) - 3) * metrics.lineHeight);
}

function cleanupHtmlAnchors(root = null) {
  const scope = root || document;
  scope.querySelectorAll?.(`.${ANCHOR_CLASS}`).forEach((anchor) => anchor.remove());
}

function scanHtmlDomComments(root) {
  cleanupHtmlAnchors(root);
  const comments = [];
  const walker = document.createTreeWalker(root, window.NodeFilter?.SHOW_COMMENT || 128);
  let node = walker.nextNode();
  let index = 0;
  while (node) {
    const current = node;
    const parent = current.parentNode;
    let anchor = null;
    if (parent) {
      anchor = document.createElement("span");
      anchor.className = `${ANCHOR_CLASS} nv-editor-only`;
      anchor.dataset.nvCommentId = `html-comment-${index}`;
      anchor.contentEditable = "false";
      anchor.setAttribute("aria-hidden", "true");
      parent.insertBefore(anchor, current.nextSibling);
    }
    comments.push({
      id: `html-comment-${index}`,
      sourceType: "html-dom",
      kind: "html",
      line: index + 1,
      column: 1,
      body: String(current.nodeValue || "").trim(),
      preview: String(current.nodeValue || "").trim(),
      node: current,
      anchor,
      replaceMode: "html-dom",
    });
    index += 1;
    node = walker.nextNode();
  }
  return comments;
}

function htmlDomTargetPoint(comment) {
  const anchor = comment.anchor;
  if (!isConnectedElement(anchor)) return null;
  const rect = anchor.getBoundingClientRect();
  if (!rect.width && !rect.height) return null;
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

function replaceRangeInContext(context, comment, nextBody) {
  if (!context || !comment) return false;
  if (context.type === "html-dom") {
    if (!comment.node) return false;
    comment.node.nodeValue = String(nextBody || "");
    context.markDirty?.();
    scheduleRefresh(80);
    return true;
  }

  if (typeof context.replaceRange !== "function") return false;
  const replacement = formatCommentReplacement(comment, nextBody);
  const start = comment.replaceMode === "line-block" ? comment.fullStartOffset : comment.startOffset;
  const end = comment.replaceMode === "line-block" ? comment.fullEndOffset : comment.endOffset;
  context.replaceRange(start, end, replacement);
  scheduleRefresh(120);
  return true;
}

function buildInsertedCommentText(context, body) {
  const filePath = context?.filePath || getActiveFilePath();
  const syntax = getCommentSyntax(filePath);
  const text = String(body || "").trim();
  if (context?.type === "html-dom") return text;
  if (syntax.insert?.kind === "block") {
    return `${syntax.insert.open} ${text || "Comment"} ${syntax.insert.close}`;
  }
  const prefix = syntax.insert?.prefix || "//";
  const lines = splitLines(text || "Comment");
  return lines.map((line) => `${prefix}${line ? ` ${line}` : ""}`).join("\n");
}

function addCommentAtCaret() {
  const context = state.context;
  if (!context?.editable) {
    setPanelStatus("Open an editor to add comments.");
    return;
  }

  const value = window.prompt("New comment", "");
  if (value === null) return;
  const commentText = buildInsertedCommentText(context, value);

  if (context.type === "html-dom") {
    const root = context.root;
    const selection = window.getSelection?.();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    const inEditor = range && root.contains(range.commonAncestorContainer);
    if (!inEditor) {
      window.HTMLWysiwygTools?.restoreSavedSelection?.();
    }
    const activeSelection = window.getSelection?.();
    const activeRange = activeSelection?.rangeCount ? activeSelection.getRangeAt(0) : null;
    if (!activeRange || !root.contains(activeRange.commonAncestorContainer)) {
      setPanelStatus("Place the caret in the HTML editor first.");
      return;
    }
    const node = document.createComment(` ${commentText || "Comment"} `);
    activeRange.insertNode(node);
    activeRange.setStartAfter(node);
    activeRange.setEndAfter(node);
    activeSelection.removeAllRanges();
    activeSelection.addRange(activeRange);
    context.markDirty?.();
    scheduleRefresh(80);
    return;
  }

  if (typeof context.insertAtCaret !== "function") return;
  context.insertAtCaret(commentText);
  scheduleRefresh(120);
}

function createPanel() {
  const panel = document.createElement("aside");
  panel.className = "panel nv-comments-panel";
  panel.dataset.collapsed = "false";
  panel.setAttribute("aria-label", "Comments");
  panel.innerHTML = `
    <div class="panel-header nv-comments-header">
      <span class="panel-title">Comments</span>
      <div class="panel-controls nv-comments-controls">
        <button type="button" data-add title="Add comment at caret" aria-label="Add comment at caret">+</button>
        <button type="button" data-refresh title="Refresh comments" aria-label="Refresh comments">Reload</button>
        <button type="button" data-collapse title="Collapse comments" aria-label="Collapse comments">></button>
        <button type="button" data-close title="Close comments" aria-label="Close comments">x</button>
      </div>
    </div>
    <div class="panel-content nv-comments-content">
      <div class="nv-comments-summary">
        <div data-source class="nv-comments-source">No source selected</div>
        <div data-count class="nv-comments-count">0 comments</div>
      </div>
      <div data-status class="nv-comments-status"></div>
      <div data-list class="nv-comments-list"></div>
    </div>
  `;
  return panel;
}

function injectStyles() {
  if (document.getElementById("nv-comments-panel-style")) return;
  const style = document.createElement("style");
  style.id = "nv-comments-panel-style";
  style.textContent = `
    :root {
      --nv-comments-panel-width: ${PANEL_WIDTH};
      --nv-comments-panel-collapsed-width: ${COLLAPSED_WIDTH};
    }

    body.nv-comments-mounted #workspace {
      margin-right: var(--nv-comments-panel-width);
      right: var(--nv-comments-panel-width);
      transition: margin-right 120ms ease, right 120ms ease;
    }

    body.nv-comments-mounted.nv-comments-collapsed #workspace {
      margin-right: var(--nv-comments-panel-collapsed-width);
      right: var(--nv-comments-panel-collapsed-width);
    }

    body.nv-comments-mounted.nv-lan-chat-mounted #workspace {
      margin-right: calc(var(--nv-comments-panel-width) + var(--nv-lan-chat-width, 320px));
      right: calc(var(--nv-comments-panel-width) + var(--nv-lan-chat-width, 320px));
    }

    body.nv-comments-mounted.nv-comments-collapsed.nv-lan-chat-mounted #workspace {
      margin-right: calc(var(--nv-comments-panel-collapsed-width) + var(--nv-lan-chat-width, 320px));
      right: calc(var(--nv-comments-panel-collapsed-width) + var(--nv-lan-chat-width, 320px));
    }

    .nv-comments-panel {
      position: fixed;
      top: calc(var(--nv-global-toolbar-height, 40px) + 34px);
      right: 0;
      bottom: var(--nv-status-bar-height, 22px);
      width: var(--nv-comments-panel-width);
      min-width: 280px;
      margin: 0;
      z-index: 22060;
      display: flex;
      flex-direction: column;
      border-right: 0;
      border-radius: 0;
      box-shadow: -3px 0 14px rgba(0,0,0,0.16);
      background: #f8fafc;
      color: #1f2933;
    }

    body.nv-lan-chat-mounted .nv-comments-panel {
      right: var(--nv-lan-chat-width, 320px);
    }

    .nv-comments-panel[data-collapsed="true"] {
      width: var(--nv-comments-panel-collapsed-width);
      min-width: var(--nv-comments-panel-collapsed-width);
    }

    .nv-comments-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 6px;
      min-height: 32px;
      user-select: none;
    }

    .nv-comments-controls {
      display: flex !important;
      gap: 4px;
      align-items: center;
    }

    .nv-comments-controls button {
      border: 1px solid #b9c4d0;
      border-radius: 5px;
      background: #fff;
      color: #1f2933;
      padding: 3px 7px;
      cursor: pointer;
      font: 12px system-ui, sans-serif;
      min-width: 24px;
      height: 24px;
    }

    .nv-comments-panel[data-collapsed="true"] .panel-title,
    .nv-comments-panel[data-collapsed="true"] [data-add],
    .nv-comments-panel[data-collapsed="true"] [data-refresh],
    .nv-comments-panel[data-collapsed="true"] [data-close],
    .nv-comments-panel[data-collapsed="true"] .panel-content {
      display: none !important;
    }

    .nv-comments-content {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-height: 0;
      padding: 9px;
      overflow: hidden;
      background: #f8fafc;
      color: #1f2933;
    }

    .nv-comments-summary {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      font: 12px system-ui, sans-serif;
    }

    .nv-comments-source {
      min-width: 0;
      flex: 1 1 auto;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-weight: 600;
    }

    .nv-comments-count,
    .nv-comments-status {
      color: #64748b;
      font-size: 12px;
    }

    .nv-comments-list {
      flex: 1 1 auto;
      min-height: 0;
      overflow: auto;
      display: flex;
      flex-direction: column;
      gap: 8px;
      padding-right: 2px;
    }

    .nv-comments-empty {
      border: 1px dashed #c7d2de;
      border-radius: 8px;
      padding: 12px;
      color: #64748b;
      background: #fff;
      font: 13px system-ui, sans-serif;
    }

    .nv-comment-card {
      border: 1px solid #d5dde8;
      border-radius: 8px;
      background: #fff;
      padding: 8px;
      display: flex;
      flex-direction: column;
      gap: 7px;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
    }

    .nv-comment-card[data-readonly="true"] {
      background: #fbfcfe;
    }

    .nv-comment-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
      color: #64748b;
      font: 11px system-ui, sans-serif;
    }

    .nv-comment-card textarea {
      width: 100%;
      min-height: 60px;
      resize: vertical;
      box-sizing: border-box;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 7px;
      font: 12px ui-monospace, SFMono-Regular, Consolas, monospace;
      line-height: 1.35;
      background: #ffffff;
      color: #111827;
    }

    .nv-comment-card textarea[readonly] {
      background: #f8fafc;
      color: #334155;
    }

    .nv-comment-actions {
      display: flex;
      justify-content: flex-end;
      gap: 6px;
    }

    .nv-comment-actions button {
      border: 1px solid #cbd5e1;
      border-radius: 5px;
      background: #fff;
      color: #1f2933;
      padding: 4px 8px;
      cursor: pointer;
      font: 12px system-ui, sans-serif;
    }

    .nv-comment-actions button[data-apply] {
      background: #0a84ff;
      border-color: #0a84ff;
      color: #fff;
    }

    .nv-comments-overlay {
      position: fixed;
      inset: 0;
      width: 100vw;
      height: 100vh;
      pointer-events: none;
      z-index: 22040;
      overflow: visible;
    }

    .${ANCHOR_CLASS} {
      display: inline-block;
      width: 8px;
      height: 8px;
      margin: 0 3px;
      border: 1px dashed #0a84ff;
      border-radius: 50%;
      background: rgba(10, 132, 255, 0.18);
      vertical-align: middle;
      pointer-events: none;
    }

    html[data-nv-theme="dark"] .nv-comments-panel {
      background: #111827;
      color: #e5e7eb;
      border-color: #334155;
    }

    html[data-nv-theme="dark"] .nv-comments-content,
    html[data-nv-theme="dark"] .nv-comment-card,
    html[data-nv-theme="dark"] .nv-comments-empty {
      background: #0f172a;
      color: #e5e7eb;
      border-color: #334155;
    }

    html[data-nv-theme="dark"] .nv-comment-card textarea {
      background: #111827;
      color: #f8fafc;
      border-color: #475569;
    }

    @media (max-width: 760px) {
      body.nv-comments-mounted #workspace,
      body.nv-comments-mounted.nv-comments-collapsed #workspace,
      body.nv-comments-mounted.nv-lan-chat-mounted #workspace {
        margin-right: 0;
        right: 0;
      }

      .nv-comments-panel,
      body.nv-lan-chat-mounted .nv-comments-panel {
        top: auto;
        left: 0;
        right: 0;
        width: 100vw;
        min-width: 0;
        height: min(46vh, 390px);
      }

      .nv-comments-panel[data-collapsed="true"] {
        left: auto;
        width: var(--nv-comments-panel-collapsed-width);
        height: 40px;
      }
    }
  `;
  document.head.appendChild(style);
}

function createOverlay() {
  const overlay = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  overlay.classList.add("nv-comments-overlay");
  overlay.setAttribute("aria-hidden", "true");
  return overlay;
}

function setPanelStatus(message = "") {
  if (state.statusEl) state.statusEl.textContent = message;
}

function cleanupSourceListeners(contextForAnchors = state.context) {
  try {
    state.sourceCleanup?.();
  } catch (err) {
    console.warn("[CommentsPanel] Source cleanup failed:", err);
  }
  state.sourceCleanup = null;
  if (contextForAnchors?.type === "html-dom") cleanupHtmlAnchors(contextForAnchors.root);
}

function scheduleConnectorDraw() {
  if (!state.mounted || state.drawRaf) return;
  state.drawRaf = window.requestAnimationFrame(() => {
    state.drawRaf = 0;
    drawConnectors();
  });
}

function scheduleRefresh(delay = 120) {
  if (!state.mounted) return;
  window.clearTimeout(state.refreshTimer);
  state.refreshTimer = window.setTimeout(() => {
    refreshComments().catch((err) => {
      console.warn("[CommentsPanel] Refresh failed:", err);
      setPanelStatus(err?.message || "Refresh failed");
    });
  }, delay);
}

function sourceContextKey(context) {
  return String(context?.type || "none") + ":" + String(context?.filePath || "");
}

function sourceContextElement(context) {
  return context?.element || context?.root || context?.pre || null;
}

function installSourceListeners(context, previousContext = state.context) {
  cleanupSourceListeners(previousContext);
  if (!context?.subscribe) return;
  state.sourceCleanup = context.subscribe(
    () => scheduleRefresh(160),
    () => scheduleConnectorDraw()
  );
}

function renderComments() {
  const list = state.listEl;
  const context = state.context;
  if (!list) return;
  list.innerHTML = "";
  state.overlay?.replaceChildren?.();

  if (state.sourceEl) state.sourceEl.textContent = context?.filePath || "No source selected";
  if (state.countEl) {
    const count = state.comments.length;
    state.countEl.textContent = `${count} comment${count === 1 ? "" : "s"}`;
  }
  if (state.addBtn) state.addBtn.disabled = !context?.editable;

  if (!context) {
    list.innerHTML = `<div class="nv-comments-empty">Open a file viewer or editor to inspect comments.</div>`;
    setPanelStatus("");
    return;
  }
  if (context.error) {
    list.innerHTML = `<div class="nv-comments-empty">${escapeHtml(context.error)}</div>`;
    setPanelStatus(context.label || "");
    return;
  }
  if (!state.comments.length) {
    list.innerHTML = `<div class="nv-comments-empty">No comments found in this file.</div>`;
    setPanelStatus(context.editable ? "Editable source" : "Read-only source");
    return;
  }

  setPanelStatus(context.editable ? `${context.label} - editable comments` : `${context.label} - read-only comments`);

  for (const comment of state.comments) {
    const card = document.createElement("article");
    card.className = "nv-comment-card";
    card.dataset.commentId = comment.id;
    card.dataset.readonly = context.editable ? "false" : "true";

    const meta = document.createElement("div");
    meta.className = "nv-comment-meta";
    meta.innerHTML = `
      <span>${escapeHtml(comment.kindLabel || comment.kind || "comment")}</span>
      <span>Line ${Number(comment.line) || 1}</span>
    `;

    const textarea = document.createElement("textarea");
    textarea.value = comment.body || "";
    textarea.readOnly = !context.editable;
    textarea.spellcheck = true;
    textarea.dataset.commentBody = comment.id;

    const actions = document.createElement("div");
    actions.className = "nv-comment-actions";

    const jumpBtn = document.createElement("button");
    jumpBtn.type = "button";
    jumpBtn.textContent = "Jump";
    jumpBtn.dataset.jump = comment.id;
    jumpBtn.addEventListener("click", () => {
      context.jumpTo?.(comment);
      scheduleConnectorDraw();
    });
    actions.appendChild(jumpBtn);

    if (context.editable) {
      const applyBtn = document.createElement("button");
      applyBtn.type = "button";
      applyBtn.textContent = "Apply";
      applyBtn.dataset.apply = comment.id;
      applyBtn.addEventListener("click", () => {
        if (replaceRangeInContext(context, comment, textarea.value)) {
          setStatus("Comments", "Updated comment");
          setPanelStatus("Comment updated in editor buffer");
        }
      });
      actions.appendChild(applyBtn);
    }

    card.append(meta, textarea, actions);
    list.appendChild(card);
  }
  scheduleConnectorDraw();
}

function drawConnectors() {
  const overlay = state.overlay;
  const panel = state.panel;
  const context = state.context;
  if (!overlay || !panel || !context || panel.dataset.collapsed === "true") {
    if (overlay) overlay.replaceChildren();
    return;
  }

  overlay.replaceChildren();
  const panelRect = panel.getBoundingClientRect();
  if (!panelRect.width || !panelRect.height) return;
  const listRect = state.listEl?.getBoundingClientRect?.();

  for (const comment of state.comments) {
    const card = state.listEl?.querySelector?.(`[data-comment-id="${selectorEscape(comment.id)}"]`);
    if (!card) continue;
    const cardRect = card.getBoundingClientRect();
    if (cardRect.bottom < 0 || cardRect.top > window.innerHeight) continue;
    if (listRect && (cardRect.bottom < listRect.top || cardRect.top > listRect.bottom)) continue;

    const target =
      context.type === "html-dom"
        ? htmlDomTargetPoint(comment)
        : context.targetPoint?.(comment, state.comments);
    if (!target) continue;

    const start = {
      x: cardRect.left,
      y: Math.max(cardRect.top + 12, Math.min(cardRect.bottom - 12, cardRect.top + cardRect.height / 2)),
    };
    const midA = Math.max(target.x + 48, start.x - 90);
    const midB = Math.min(start.x - 48, target.x + 90);
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", `M ${start.x} ${start.y} C ${midA} ${start.y}, ${midB} ${target.y}, ${target.x} ${target.y}`);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", "rgba(10, 132, 255, 0.72)");
    path.setAttribute("stroke-width", "1.5");
    path.setAttribute("stroke-dasharray", "4 5");
    path.setAttribute("stroke-linecap", "round");
    overlay.appendChild(path);

    const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    dot.setAttribute("cx", String(target.x));
    dot.setAttribute("cy", String(target.y));
    dot.setAttribute("r", "3.5");
    dot.setAttribute("fill", "#0a84ff");
    overlay.appendChild(dot);
  }
}

async function refreshComments() {
  if (!state.mounted) return;
  const previousContext = state.context;
  const previousKey = sourceContextKey(previousContext);
  const previousElement = sourceContextElement(previousContext);
  const context = await resolveSourceContext();
  const nextKey = sourceContextKey(context);
  const nextElement = sourceContextElement(context);

  if (!context) {
    cleanupSourceListeners(previousContext);
    state.context = null;
    state.comments = [];
    renderComments();
    return;
  }

  state.context = context;
  if (previousKey !== nextKey || previousElement !== nextElement || !state.sourceCleanup) {
    installSourceListeners(context, previousContext);
  }

  if (context.type === "html-dom") {
    state.comments = scanHtmlDomComments(context.root);
  } else {
    state.comments = parseTextComments(context.getText?.() || "", context.filePath)
      .map((comment) => ({
        ...comment,
        kindLabel: comment.kind === "line-block" ? "line comments" : `${comment.kind} comment`,
      }));
  }
  renderComments();
}

function collapsePanel(collapsed) {
  if (!state.panel) return;
  state.panel.dataset.collapsed = collapsed ? "true" : "false";
  document.body.classList.toggle("nv-comments-collapsed", collapsed);
  if (state.collapseBtn) {
    state.collapseBtn.textContent = collapsed ? "<" : ">";
    state.collapseBtn.title = collapsed ? "Expand comments" : "Collapse comments";
    state.collapseBtn.setAttribute("aria-label", state.collapseBtn.title);
  }
  scheduleConnectorDraw();
}

function bindPanelEvents(panel) {
  state.statusEl = panel.querySelector("[data-status]");
  state.sourceEl = panel.querySelector("[data-source]");
  state.countEl = panel.querySelector("[data-count]");
  state.listEl = panel.querySelector("[data-list]");
  state.addBtn = panel.querySelector("[data-add]");
  state.refreshBtn = panel.querySelector("[data-refresh]");
  state.collapseBtn = panel.querySelector("[data-collapse]");

  panel.querySelector("[data-close]")?.addEventListener("click", () => disposeCommentsPanel());
  state.refreshBtn?.addEventListener("click", () => scheduleRefresh(0));
  state.addBtn?.addEventListener("click", () => addCommentAtCaret());
  state.collapseBtn?.addEventListener("click", () => {
    collapsePanel(panel.dataset.collapsed !== "true");
  });
  state.listEl?.addEventListener("scroll", scheduleConnectorDraw, { passive: true });
}

function bindGlobalEvents() {
  if (window.__nvCommentsPanelGlobalEventsBound) return;
  const refresh = () => scheduleRefresh(120);
  const draw = () => scheduleConnectorDraw();
  window.addEventListener("activePanelChanged", refresh);
  window.addEventListener("nodevision-file-saved", refresh);
  window.addEventListener("resize", draw, { passive: true });
  window.addEventListener("scroll", draw, { capture: true, passive: true });
  window.__nvCommentsPanelGlobalEventsBound = {
    dispose() {
      window.removeEventListener("activePanelChanged", refresh);
      window.removeEventListener("nodevision-file-saved", refresh);
      window.removeEventListener("resize", draw);
      window.removeEventListener("scroll", draw, { capture: true });
      window.__nvCommentsPanelGlobalEventsBound = null;
    },
  };
}

function unbindGlobalEvents() {
  window.__nvCommentsPanelGlobalEventsBound?.dispose?.();
}

export function initCommentsPanel() {
  if (window[PANEL_STATE_KEY]?.panel?.isConnected) return window[PANEL_STATE_KEY];

  injectStyles();
  state.panel = createPanel();
  state.overlay = createOverlay();
  document.body.appendChild(state.overlay);
  document.body.appendChild(state.panel);
  document.body.classList.add("nv-comments-mounted");
  document.body.classList.remove("nv-comments-collapsed");
  state.mounted = true;

  bindPanelEvents(state.panel);
  bindGlobalEvents();
  refreshComments().catch((err) => {
    console.warn("[CommentsPanel] Initial refresh failed:", err);
    setPanelStatus(err?.message || "Unable to load comments");
  });

  window[PANEL_STATE_KEY] = {
    panel: state.panel,
    overlay: state.overlay,
    refresh: refreshComments,
    dispose: disposeCommentsPanel,
  };
  return window[PANEL_STATE_KEY];
}

export function disposeCommentsPanel() {
  window.clearTimeout(state.refreshTimer);
  if (state.drawRaf) window.cancelAnimationFrame(state.drawRaf);
  cleanupSourceListeners();
  unbindGlobalEvents();
  state.overlay?.remove();
  state.panel?.remove();
  document.body.classList.remove("nv-comments-mounted", "nv-comments-collapsed");

  state.panel = null;
  state.overlay = null;
  state.statusEl = null;
  state.sourceEl = null;
  state.countEl = null;
  state.listEl = null;
  state.addBtn = null;
  state.refreshBtn = null;
  state.collapseBtn = null;
  state.comments = [];
  state.context = null;
  state.sourceCleanup = null;
  state.refreshTimer = 0;
  state.drawRaf = 0;
  state.mounted = false;
  window[PANEL_STATE_KEY] = null;
}

export function toggleCommentsPanel() {
  if (window[PANEL_STATE_KEY]?.panel?.isConnected) {
    disposeCommentsPanel();
    setStatus("Comments", "Hidden");
    return null;
  }
  const mounted = initCommentsPanel();
  setStatus("Comments", "Opened");
  return mounted;
}

export default initCommentsPanel;
