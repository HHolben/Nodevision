// Nodevision/public/PanelInstances/EditorPanels/GraphicalEditors/EPUBeditor.mjs
// EPUB editor scaffold that reuses the HTML editor engine for chapter editing.

import JSZip from "../../../lib/jszip/jszip.min.js";
import { renderEditor as renderHTMLEditor } from "./HTMLeditor.mjs";

const NOTEBOOK_BASE = "/Notebook";
const SAVE_ENDPOINT = "/api/save";

function escapeHTML(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function parseContainerRootfile(containerXmlText) {
  const doc = new DOMParser().parseFromString(containerXmlText, "application/xml");
  const rootfile = doc.querySelector("rootfile");
  return rootfile?.getAttribute("full-path") || null;
}

function normalizeZipPath(path = "") {
  return String(path).replace(/^\/+/, "");
}

function dirname(path = "") {
  const clean = normalizeZipPath(path);
  const slash = clean.lastIndexOf("/");
  return slash === -1 ? "" : clean.slice(0, slash + 1);
}

function resolveRelative(baseDir, href) {
  const joined = `${baseDir || ""}${href || ""}`;
  const parts = joined.split("/");
  const out = [];
  for (const part of parts) {
    if (!part || part === ".") continue;
    if (part === "..") {
      out.pop();
      continue;
    }
    out.push(part);
  }
  return out.join("/");
}

async function discoverEpubChapters(zip) {
  const containerFile = zip.file("META-INF/container.xml");
  if (!containerFile) {
    return [];
  }

  const containerText = await containerFile.async("text");
  const opfPath = parseContainerRootfile(containerText);
  if (!opfPath) return [];

  const opfFile = zip.file(opfPath);
  if (!opfFile) return [];

  const opfText = await opfFile.async("text");
  const opfDoc = new DOMParser().parseFromString(opfText, "application/xml");
  const opfDir = dirname(opfPath);

  const manifestById = new Map();
  opfDoc.querySelectorAll("manifest > item").forEach((item) => {
    const id = item.getAttribute("id") || "";
    const href = item.getAttribute("href") || "";
    const mediaType = item.getAttribute("media-type") || "";
    const fullPath = resolveRelative(opfDir, href);
    if (id && fullPath) {
      manifestById.set(id, {
        id,
        href,
        fullPath,
        mediaType
      });
    }
  });

  const chapters = [];
  opfDoc.querySelectorAll("spine > itemref").forEach((itemref, index) => {
    const idref = itemref.getAttribute("idref") || "";
    const item = manifestById.get(idref);
    if (!item) return;
    const lower = item.fullPath.toLowerCase();
    if (!lower.endsWith(".xhtml") && !lower.endsWith(".html") && item.mediaType !== "application/xhtml+xml") {
      return;
    }
    chapters.push({
      id: item.id,
      label: item.href || item.fullPath,
      path: item.fullPath,
      order: index
    });
  });

  if (chapters.length > 0) return chapters;

  const fallback = [];
  Object.keys(zip.files).forEach((path) => {
    const lower = path.toLowerCase();
    if (lower.endsWith(".xhtml") || lower.endsWith(".html")) {
      fallback.push(path);
    }
  });
  fallback.sort();
  return fallback.map((path, index) => ({
    id: `fallback-${index + 1}`,
    label: path,
    path,
    order: index
  }));
}

async function saveEpubBase64(filePath, base64) {
  const res = await fetch(SAVE_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path: filePath,
      content: base64,
      encoding: "base64",
      mimeType: "application/epub+zip"
    })
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || !json?.success) {
    throw new Error(json?.error || `${res.status} ${res.statusText}`);
  }
}

export async function renderEditor(filePath, container) {
  if (!container) throw new Error("Container required");
  container.innerHTML = "";
  window.NodevisionState = window.NodevisionState || {};
  window.NodevisionState.currentMode = "EPUBediting";
  window.getEditorMarkdown = undefined;
  window.saveMDFile = undefined;

  const wrapper = document.createElement("div");
  wrapper.style.cssText = "display:flex;flex-direction:column;width:100%;height:100%;overflow:hidden;";
  container.appendChild(wrapper);

  const topBar = document.createElement("div");
  topBar.style.cssText = "display:flex;align-items:center;gap:8px;padding:8px;border-bottom:1px solid #d7d7d7;background:#f5f5f5;font:12px monospace;";
  wrapper.appendChild(topBar);

  const title = document.createElement("div");
  title.textContent = `EPUB Editor (HTML engine) — ${filePath}`;
  topBar.appendChild(title);

  const status = document.createElement("div");
  status.style.marginLeft = "auto";
  status.textContent = "Loading EPUB...";
  topBar.appendChild(status);

  const body = document.createElement("div");
  body.style.cssText = "display:flex;flex:1;min-height:0;overflow:hidden;";
  wrapper.appendChild(body);

  const sidebar = document.createElement("div");
  sidebar.style.cssText = "width:280px;min-width:220px;max-width:340px;border-right:1px solid #ddd;background:#fafafa;overflow:auto;padding:8px;box-sizing:border-box;";
  body.appendChild(sidebar);

  const editorHost = document.createElement("div");
  editorHost.style.cssText = "flex:1;min-width:0;min-height:0;overflow:hidden;";
  body.appendChild(editorHost);

  let zip = null;
  let chapters = [];
  let activeChapterPath = null;
  let htmlEditorMounted = false;
  const chapterTextByPath = new Map();
  const dirtyChapters = new Set();

  function setStatus(text) {
    status.textContent = text;
  }

  function persistActiveChapterToMemory() {
    if (!activeChapterPath || typeof window.getEditorHTML !== "function") return;
    chapterTextByPath.set(activeChapterPath, window.getEditorHTML());
    dirtyChapters.add(activeChapterPath);
  }

  function bindEpubSaveHook() {
    window.saveWYSIWYGFile = async (path = filePath) => {
      persistActiveChapterToMemory();
      dirtyChapters.forEach((chapterPath) => {
        const nextText = chapterTextByPath.get(chapterPath);
        if (typeof nextText === "string") {
          zip.file(chapterPath, nextText);
        }
      });

      const b64 = await zip.generateAsync({
        type: "base64",
        compression: "DEFLATE",
        compressionOptions: { level: 6 }
      });
      await saveEpubBase64(path, b64);
      setStatus(`Saved EPUB (${dirtyChapters.size} chapter${dirtyChapters.size === 1 ? "" : "s"} updated)`);
      dirtyChapters.clear();
    };
  }

  async function mountHtmlEditorWithVirtualSource(virtualPath, htmlText) {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (url, options) => {
      if (!options && url === `${NOTEBOOK_BASE}/${virtualPath}`) {
        return new Response(htmlText, {
          status: 200,
          headers: { "Content-Type": "text/html; charset=utf-8" }
        });
      }
      return originalFetch(url, options);
    };

    try {
      await renderHTMLEditor(virtualPath, editorHost, { mode: "EPUBediting" });
    } finally {
      window.fetch = originalFetch;
    }
  }

  function renderChapterList() {
    sidebar.innerHTML = "";
    const head = document.createElement("div");
    head.style.cssText = "font:700 13px monospace;margin-bottom:8px;";
    head.textContent = "Spine / Chapters";
    sidebar.appendChild(head);

    chapters.forEach((chapter, idx) => {
      const row = document.createElement("button");
      row.type = "button";
      row.style.cssText = [
        "width:100%",
        "text-align:left",
        "padding:6px 8px",
        "margin-bottom:6px",
        "border:1px solid #d0d0d0",
        "background:#fff",
        "cursor:pointer",
        "font:12px monospace",
      ].join(";");
      if (chapter.path === activeChapterPath) {
        row.style.borderColor = "#4b7fd1";
        row.style.background = "#eef5ff";
      }
      const dirty = dirtyChapters.has(chapter.path) ? " *" : "";
      row.textContent = `${idx + 1}. ${chapter.label}${dirty}`;
      row.title = chapter.path;
      row.addEventListener("click", async () => {
        await openChapter(chapter.path);
      });
      sidebar.appendChild(row);
    });
  }

  async function openChapter(chapterPath) {
    if (!chapterPath) return;
    if (activeChapterPath === chapterPath && htmlEditorMounted) return;

    if (htmlEditorMounted) {
      persistActiveChapterToMemory();
    }

    const chapterText = chapterTextByPath.get(chapterPath);
    if (typeof chapterText !== "string") {
      setStatus(`Unable to open chapter: ${chapterPath}`);
      return;
    }

    if (!htmlEditorMounted) {
      const virtualPath = "__epub_virtual__/chapter.xhtml";
      await mountHtmlEditorWithVirtualSource(virtualPath, chapterText);
      htmlEditorMounted = true;
    } else if (typeof window.setEditorHTML === "function") {
      window.setEditorHTML(chapterText);
    } else {
      setStatus("HTML editor bridge unavailable");
      return;
    }

    activeChapterPath = chapterPath;
    bindEpubSaveHook();
    renderChapterList();
    setStatus(`Editing chapter: ${chapterPath}`);
  }

  try {
    const res = await fetch(`${NOTEBOOK_BASE}/${filePath}`);
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    const buffer = await res.arrayBuffer();
    zip = await JSZip.loadAsync(buffer);
    chapters = await discoverEpubChapters(zip);

    if (chapters.length === 0) {
      throw new Error("No XHTML/HTML chapters found in EPUB.");
    }

    for (const chapter of chapters) {
      const file = zip.file(chapter.path);
      if (!file) continue;
      const text = await file.async("text");
      chapterTextByPath.set(chapter.path, text);
    }

    activeChapterPath = chapters[0].path;
    renderChapterList();
    await openChapter(activeChapterPath);
    setStatus(`Loaded EPUB (${chapters.length} chapters)`);
  } catch (err) {
    editorHost.innerHTML = `<div style="padding:12px;color:#b00020;font:13px monospace;">Failed to load EPUB editor: ${escapeHTML(err.message)}</div>`;
    setStatus("Load failed");
    window.getEditorHTML = undefined;
    window.setEditorHTML = undefined;
    window.saveWYSIWYGFile = undefined;
  }
}
