// Nodevision/ApplicationSystem/public/ToolbarCallbacks/file/ConvertToEPUB.mjs
// Converts the active Notebook HTML document or selected HTML folder into an EPUB 3 package.

import JSZip from "../../lib/jszip/jszip.min.js";
import { showInputDialog } from "/ui/modals/InputDialog.mjs";
import { notifyFileSaved, resolveFilePath, saveViaApi } from "./saveFile/utils.mjs";

const HTML_EXTENSIONS = new Set(["html", "htm", "xhtml"]);
const MAX_FOLDER_CHAPTERS = 250;

const MIME_BY_EXT = new Map([
  ["css", "text/css"],
  ["gif", "image/gif"],
  ["jpeg", "image/jpeg"],
  ["jpg", "image/jpeg"],
  ["png", "image/png"],
  ["svg", "image/svg+xml"],
  ["webp", "image/webp"],
]);

function normalizeNotebookPath(value = "") {
  let cleaned = String(value || "").trim();
  if (!cleaned) return "";
  try {
    const parsed = new URL(cleaned, window.location.origin);
    cleaned = parsed.pathname || cleaned;
  } catch {
    // Keep path-like values that are not absolute URLs.
  }
  cleaned = cleaned
    .replace(/\\/g, "/")
    .replace(/[?#].*$/, "")
    .replace(/^\/+/, "");
  if (cleaned.toLowerCase().startsWith("notebook/")) cleaned = cleaned.slice("Notebook/".length);
  return cleaned.replace(/\/+/g, "/");
}

function getFileExtension(pathValue = "") {
  const leaf = normalizeNotebookPath(pathValue).split("/").pop() || "";
  const dot = leaf.lastIndexOf(".");
  return dot >= 0 ? leaf.slice(dot + 1).toLowerCase() : "";
}

function getDirectory(pathValue = "") {
  const clean = normalizeNotebookPath(pathValue);
  const slash = clean.lastIndexOf("/");
  return slash >= 0 ? clean.slice(0, slash) : "";
}

function getBaseName(pathValue = "") {
  const leaf = normalizeNotebookPath(pathValue).split("/").filter(Boolean).pop() || "Document";
  return leaf.replace(/\.[^.]+$/, "") || "Document";
}

function joinNotebookPath(basePath = "", name = "") {
  return [normalizeNotebookPath(basePath), String(name || "").replace(/^\/+/, "")]
    .filter(Boolean)
    .join("/")
    .replace(/\/+/g, "/");
}

function deriveDefaultTargetPath(sourcePath = "") {
  const clean = normalizeNotebookPath(sourcePath);
  const withoutExt = HTML_EXTENSIONS.has(getFileExtension(clean))
    ? clean.replace(/\.[^.\/]+$/, "")
    : clean;
  return `${withoutExt || "ConvertedDocument"}.epub`;
}

function encodeNotebookPath(pathValue = "") {
  return normalizeNotebookPath(pathValue)
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

function buildNotebookFileUrl(pathValue = "") {
  const encoded = encodeNotebookPath(pathValue);
  if (!encoded) return "";
  return `${window.location.origin}/Notebook/${encoded}`;
}

function comparePathsNatural(a, b) {
  return String(a || "").localeCompare(String(b || ""), undefined, { numeric: true, sensitivity: "base" });
}

async function fetchSelectedFileContent(pathValue) {
  const response = await fetch(`/api/fileCodeContent?path=${encodeURIComponent(pathValue)}`);
  if (!response.ok) throw new Error(`Failed to load HTML file (${response.status})`);
  const payload = await response.json();
  if (payload?.isBinary) throw new Error("Selected file is binary and cannot be converted to EPUB.");
  return String(payload?.content ?? "");
}

async function getCurrentHtml(pathValue) {
  if (typeof window.getEditorHTML === "function") return window.getEditorHTML();
  return fetchSelectedFileContent(pathValue);
}

async function fetchDirectoryEntries(folderPath) {
  const clean = normalizeNotebookPath(folderPath);
  const response = await fetch(`/api/files?path=${encodeURIComponent(clean)}`, { cache: "no-store" });
  if (!response.ok) throw new Error(`Failed to read folder (${response.status})`);
  const entries = await response.json();
  if (!Array.isArray(entries)) throw new Error("Folder listing response was not an array.");
  return entries;
}

async function collectHtmlFilesFromFolder(folderPath, output = []) {
  if (output.length >= MAX_FOLDER_CHAPTERS) return output;
  const cleanFolder = normalizeNotebookPath(folderPath);
  const entries = await fetchDirectoryEntries(cleanFolder);

  for (const entry of entries) {
    if (!entry?.name) continue;
    const entryPath = normalizeNotebookPath(entry.path || joinNotebookPath(cleanFolder, entry.name));
    if (entry.isDirectory) {
      await collectHtmlFilesFromFolder(entryPath, output);
      if (output.length >= MAX_FOLDER_CHAPTERS) break;
      continue;
    }
    if (HTML_EXTENSIONS.has(getFileExtension(entryPath))) output.push(entryPath);
    if (output.length >= MAX_FOLDER_CHAPTERS) break;
  }

  output.sort(comparePathsNatural);
  return output;
}

function selectedFileManagerItemForPath(pathValue = "") {
  const activePath = normalizeNotebookPath(pathValue);
  if (!activePath) return null;
  const fileManagerItems = document.querySelectorAll("#file-list a.file, #file-list a.folder");
  for (const item of fileManagerItems) {
    if (normalizeNotebookPath(item?.dataset?.fullPath) === activePath) return item;
  }
  return null;
}

function isSelectedFolder(pathValue = "") {
  const item = selectedFileManagerItemForPath(pathValue);
  return item?.dataset?.isDirectory === "true";
}

async function resolveConversionSource(selectedPath) {
  const clean = normalizeNotebookPath(selectedPath);
  if (!clean) throw new Error("Open or select an HTML file or folder before converting to EPUB.");

  if (HTML_EXTENSIONS.has(getFileExtension(clean)) && !isSelectedFolder(clean)) {
    return {
      kind: "file",
      sourcePath: clean,
      outputBasePath: clean,
      htmlFiles: [clean],
      title: getBaseName(clean),
    };
  }

  let htmlFiles;
  try {
    htmlFiles = await collectHtmlFilesFromFolder(clean);
  } catch (error) {
    throw new Error("Convert to EPUB is available for .html, .htm, .xhtml files, or folders containing those files.");
  }

  if (!htmlFiles.length) {
    throw new Error(`No HTML files were found in ${clean}.`);
  }

  return {
    kind: "folder",
    sourcePath: clean,
    outputBasePath: clean,
    htmlFiles,
    title: getBaseName(clean),
    truncated: htmlFiles.length >= MAX_FOLDER_CHAPTERS,
  };
}

function escapeXml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function sanitizeIdentifier(value = "") {
  return String(value || "item")
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "") || "item";
}

function safeFileName(rawName = "asset", fallbackExt = "") {
  const decoded = (() => {
    try { return decodeURIComponent(String(rawName || "")); }
    catch { return String(rawName || ""); }
  })();
  let name = decoded.split(/[\\/]/).pop() || "asset";
  name = name.replace(/[?#].*$/, "").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
  if (!name) name = "asset";
  if (fallbackExt && !/\.[A-Za-z0-9]+$/.test(name)) name += `.${fallbackExt}`;
  return name;
}

function uniqueFileName(baseName, usedNames) {
  let candidate = baseName;
  let count = 2;
  while (usedNames.has(candidate.toLowerCase())) {
    const dot = baseName.lastIndexOf(".");
    candidate = dot > 0
      ? `${baseName.slice(0, dot)}-${count}${baseName.slice(dot)}`
      : `${baseName}-${count}`;
    count += 1;
  }
  usedNames.add(candidate.toLowerCase());
  return candidate;
}

function mediaTypeForPath(pathValue = "", response) {
  const header = response?.headers?.get?.("content-type")?.split(";")[0]?.trim();
  if (header && header !== "application/octet-stream") return header;
  return MIME_BY_EXT.get(getFileExtension(pathValue)) || "application/octet-stream";
}

function resolveLocalNotebookUrl(rawValue, sourceBaseUrl) {
  const raw = String(rawValue || "").trim();
  if (!raw || raw.startsWith("#") || /^data:/i.test(raw) || /^mailto:/i.test(raw) || /^javascript:/i.test(raw)) return null;
  let url;
  try {
    url = new URL(raw, sourceBaseUrl);
  } catch {
    return null;
  }
  if (url.origin !== window.location.origin) return null;
  if (!url.pathname.toLowerCase().startsWith("/notebook/")) return null;
  url.hash = "";
  return url;
}

function getSourceTitle(doc, sourcePath) {
  const title = doc.querySelector("title")?.textContent?.trim();
  if (title) return title;
  const h1 = doc.querySelector("h1")?.textContent?.trim();
  if (h1) return h1;
  return getBaseName(sourcePath);
}

function serializeChildren(parent) {
  if (!parent) return "";
  const serializer = new XMLSerializer();
  return Array.from(parent.childNodes).map((node) => serializer.serializeToString(node)).join("\n");
}

async function packageReferencedAssets({ doc, zip, sourcePath, manifestItems, assetContext }) {
  const sourceUrl = buildNotebookFileUrl(sourcePath);
  const sourceBaseUrl = new URL("./", sourceUrl || window.location.href);
  const context = assetContext || { packagedByUrl: new Map(), usedNames: new Set(), assetIndex: 1 };

  async function packageAttribute(element, attr, folder, fallbackExt = "") {
    const raw = element.getAttribute(attr);
    const url = resolveLocalNotebookUrl(raw, sourceBaseUrl);
    if (!url) return;

    const cacheKey = url.href;
    if (context.packagedByUrl.has(cacheKey)) {
      element.setAttribute(attr, context.packagedByUrl.get(cacheKey).href);
      return;
    }

    let response;
    try {
      response = await fetch(url.href, { cache: "no-store" });
    } catch (error) {
      console.warn("EPUB conversion could not fetch asset:", url.href, error);
      return;
    }
    if (!response.ok) {
      console.warn("EPUB conversion skipped missing asset:", url.href, response.status);
      return;
    }

    const mediaType = mediaTypeForPath(url.pathname, response);
    const inferredExt = getFileExtension(url.pathname) || fallbackExt;
    const name = uniqueFileName(safeFileName(url.pathname, inferredExt), context.usedNames);
    const href = `${folder}/${name}`;
    const zipPath = `OEBPS/${href}`;
    const buffer = await response.arrayBuffer();
    zip.file(zipPath, buffer);

    const id = `${folder.replace(/[^A-Za-z0-9]+/g, "-")}-${context.assetIndex++}`;
    const item = { id, href, mediaType };
    manifestItems.push(item);
    context.packagedByUrl.set(cacheKey, item);
    element.setAttribute(attr, href);
  }

  const stylesheets = Array.from(doc.querySelectorAll('link[rel~="stylesheet"][href]'));
  for (const link of stylesheets) {
    await packageAttribute(link, "href", "styles", "css");
  }

  const srcElements = Array.from(doc.querySelectorAll("img[src], audio[src], video[src], source[src]"));
  for (const element of srcElements) {
    await packageAttribute(element, "src", "assets");
  }

  const svgImages = Array.from(doc.getElementsByTagName("image")).filter((element) => element.hasAttribute("href") || element.hasAttribute("xlink:href"));
  for (const element of svgImages) {
    await packageAttribute(element, "href", "assets");
    await packageAttribute(element, "xlink:href", "assets");
  }
}

function buildChapterXhtml({ doc, title, language }) {
  doc.querySelectorAll("script").forEach((node) => node.remove());
  doc.querySelectorAll("[contenteditable]").forEach((node) => node.removeAttribute("contenteditable"));

  const headMarkup = serializeChildren(doc.head)
    .replace(/<title[\s\S]*?<\/title>/i, "")
    .trim();
  const bodyMarkup = serializeChildren(doc.body).trim() || `<p>${escapeXml(title)}</p>`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" lang="${escapeXml(language)}" xml:lang="${escapeXml(language)}">
<head>
  <meta charset="utf-8" />
  <title>${escapeXml(title)}</title>
  ${headMarkup}
</head>
<body>
${bodyMarkup}
</body>
</html>
`;
}

function buildNavXhtml({ title, language, chapters }) {
  const items = chapters.map((chapter) => `      <li><a href="${escapeXml(chapter.href)}">${escapeXml(chapter.title)}</a></li>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="${escapeXml(language)}" xml:lang="${escapeXml(language)}">
<head>
  <meta charset="utf-8" />
  <title>${escapeXml(title)} Navigation</title>
</head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>${escapeXml(title)}</h1>
    <ol>
${items}
    </ol>
  </nav>
</body>
</html>
`;
}

function buildContainerXml() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml" />
  </rootfiles>
</container>
`;
}

function buildContentOpf({ title, language, identifier, modified, sourcePath, chapters, manifestItems }) {
  const chapterItems = chapters.map((chapter) => `    <item id="${escapeXml(chapter.id)}" href="${escapeXml(chapter.href)}" media-type="application/xhtml+xml" />`).join("\n");
  const spineItems = chapters.map((chapter) => `    <itemref idref="${escapeXml(chapter.id)}" />`).join("\n");
  const assetItems = manifestItems.map((item) => {
    const properties = item.properties ? ` properties="${escapeXml(item.properties)}"` : "";
    return `    <item id="${escapeXml(item.id)}" href="${escapeXml(item.href)}" media-type="${escapeXml(item.mediaType)}"${properties} />`;
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="pub-id">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="pub-id">${escapeXml(identifier)}</dc:identifier>
    <dc:title>${escapeXml(title)}</dc:title>
    <dc:language>${escapeXml(language)}</dc:language>
    <dc:source>${escapeXml(sourcePath)}</dc:source>
    <meta property="dcterms:modified">${escapeXml(modified)}</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav" />
${chapterItems}
${assetItems}
  </manifest>
  <spine>
${spineItems}
  </spine>
</package>
`;
}

async function buildEpubFromHtmlSources({ title, sourcePath, sources }) {
  const zip = new JSZip();
  const manifestItems = [];
  const chapters = [];
  const chapterNames = new Set();
  const assetContext = { packagedByUrl: new Map(), usedNames: new Set(), assetIndex: 1 };
  let language = "en";

  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  zip.file("META-INF/container.xml", buildContainerXml());

  for (let index = 0; index < sources.length; index += 1) {
    const source = sources[index];
    const parser = new DOMParser();
    const doc = parser.parseFromString(source.html, "text/html");
    const chapterTitle = getSourceTitle(doc, source.path);
    if (index === 0) language = doc.documentElement?.getAttribute("lang") || language;
    await packageReferencedAssets({ doc, zip, sourcePath: source.path, manifestItems, assetContext });

    const chapterBaseName = `${String(index + 1).padStart(3, "0")}-${safeFileName(getBaseName(source.path), "xhtml").replace(/\.[^.]+$/, "")}.xhtml`;
    const href = sources.length === 1 ? "chapter.xhtml" : uniqueFileName(chapterBaseName, chapterNames);
    const id = `chapter-${index + 1}`;
    chapters.push({ id, href, title: chapterTitle });
    zip.file(`OEBPS/${href}`, buildChapterXhtml({ doc, title: chapterTitle, language }));
  }

  zip.file("OEBPS/nav.xhtml", buildNavXhtml({ title, language, chapters }));

  const identifier = typeof globalThis.crypto?.randomUUID === "function"
    ? "urn:uuid:" + globalThis.crypto.randomUUID()
    : `urn:nodevision:${Date.now()}:${sanitizeIdentifier(sourcePath)}`;
  const modified = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  zip.file("OEBPS/content.opf", buildContentOpf({
    title,
    language,
    identifier,
    modified,
    sourcePath,
    chapters,
    manifestItems,
  }));

  return zip.generateAsync({
    type: "base64",
    compression: "DEFLATE",
    compressionOptions: { level: 6 },
  });
}

async function buildSingleFileEpubBase64(sourcePath) {
  const html = await getCurrentHtml(sourcePath);
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const title = getSourceTitle(doc, sourcePath);
  return buildEpubFromHtmlSources({
    title,
    sourcePath,
    sources: [{ path: sourcePath, html }],
  });
}

async function buildFolderEpubBase64({ sourcePath, htmlFiles, title }) {
  const sources = [];
  for (const path of htmlFiles) {
    sources.push({ path, html: await fetchSelectedFileContent(path) });
  }
  return buildEpubFromHtmlSources({ title, sourcePath, sources });
}

async function chooseTargetPath(source) {
  const defaultTarget = deriveDefaultTargetPath(source.outputBasePath);
  const chapterText = source.kind === "folder"
    ? `${source.htmlFiles.length} HTML file${source.htmlFiles.length === 1 ? "" : "s"} will become EPUB chapters.`
    : "The source HTML file is not changed.";
  const result = await showInputDialog({
    title: "Convert to EPUB",
    description: `Save the EPUB inside the Notebook. ${chapterText}`,
    placeholder: defaultTarget,
    defaultValue: defaultTarget,
    confirmText: "Convert",
    cancelText: "Cancel",
    emptyMessage: "An EPUB path is required.",
    validator(value) {
      const path = normalizeNotebookPath(value);
      if (!path) return false;
      return path.toLowerCase().endsWith(".epub");
    },
    invalidMessage: "Use a Notebook-relative path ending in .epub.",
  });
  return result ? normalizeNotebookPath(result) : "";
}

async function refreshOutputPath(targetPath) {
  notifyFileSaved(targetPath);
  const dir = getDirectory(targetPath);
  if (typeof window.refreshFileManager === "function") {
    await window.refreshFileManager(dir || window.currentDirectoryPath || "");
  }
  document.dispatchEvent(new CustomEvent("refreshFileManager", { detail: { path: dir } }));
  if (typeof window.revealPathInFileManager === "function") {
    try { await window.revealPathInFileManager(targetPath, { isDirectory: false }); }
    catch (error) { console.warn("Could not reveal EPUB in File Manager:", error); }
  }
}

export default async function ConvertToEPUB() {
  const selectedPath = normalizeNotebookPath(resolveFilePath());
  let source;
  try {
    source = await resolveConversionSource(selectedPath);
  } catch (error) {
    alert(error?.message || error);
    return;
  }

  const targetPath = await chooseTargetPath(source);
  if (!targetPath) return;

  try {
    const base64 = source.kind === "folder"
      ? await buildFolderEpubBase64(source)
      : await buildSingleFileEpubBase64(source.sourcePath);
    await saveViaApi({
      path: targetPath,
      content: base64,
      encoding: "base64",
      mimeType: "application/epub+zip",
    });
    await refreshOutputPath(targetPath);
    const suffix = source.truncated ? ` First ${MAX_FOLDER_CHAPTERS} HTML files were included.` : "";
    alert(`Converted ${source.sourcePath} to ${targetPath}.${suffix}`);
  } catch (error) {
    console.error("Convert to EPUB failed:", error);
    alert(`Convert to EPUB failed: ${error?.message || error}`);
  }
}
