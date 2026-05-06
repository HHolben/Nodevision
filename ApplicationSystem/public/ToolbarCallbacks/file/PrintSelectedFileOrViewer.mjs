// Nodevision/ApplicationSystem/public/ToolbarCallbacks/file/PrintSelectedFileOrViewer.mjs
// This file defines browser-side print logic for selected files or the File View panel.

import { resolveFilePath } from "./saveFile/utils.mjs";

const DOCUMENT_PRINT_EXTENSIONS = new Set([
  "html",
  "htm",
  "xhtml",
  "pdf",
  "md",
  "markdown",
  "txt",
  "csv",
  "json",
  "xml",
  "svg",
  "log",
  "yaml",
  "yml",
  "rtf",
]);

function normalizePath(pathValue) {
  return String(pathValue || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/[?#].*$/, "")
    .replace(/^\/+/, "");
}

function toNotebookRelativePath(pathValue) {
  const clean = normalizePath(pathValue);
  if (!clean) return "";
  return clean.toLowerCase().startsWith("notebook/")
    ? clean.slice("Notebook/".length)
    : clean;
}

function getExtension(pathValue) {
  const clean = normalizePath(pathValue);
  const fileName = clean.split("/").pop() || "";
  const dot = fileName.lastIndexOf(".");
  if (dot < 0) return "";
  return fileName.slice(dot + 1).toLowerCase();
}

function buildNotebookFileUrl(pathValue) {
  const relativePath = toNotebookRelativePath(pathValue);
  if (!relativePath) return "";
  const encodedPath = relativePath
    .split("/")
    .filter(Boolean)
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${window.location.origin}/Notebook/${encodedPath}`;
}

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function printSelectedDocument(pathValue) {
  const url = buildNotebookFileUrl(pathValue);
  if (!url) return false;

  const printWindow = window.open(url, "_blank", "width=1024,height=768");
  if (!printWindow) return false;

  return await new Promise((resolve) => {
    let settled = false;
    const settle = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const triggerPrint = () => {
      if (settled) return;
      try {
        printWindow.focus();
        printWindow.print();
        settle(true);
      } catch (err) {
        console.warn("Print window failed:", err);
        settle(false);
      }
    };

    if (typeof printWindow.addEventListener === "function") {
      printWindow.addEventListener(
        "load",
        () => {
          setTimeout(triggerPrint, 180);
        },
        { once: true },
      );
    }

    setTimeout(triggerPrint, 1200);
    setTimeout(() => settle(false), 8000);
  });
}

function printFileViewerContents() {
  const fileViewRoot =
    document.querySelector('[data-id="FileView"] #element-view') ||
    document.getElementById("element-view");

  if (!fileViewRoot) return false;

  const iframe = fileViewRoot.querySelector("iframe");
  if (iframe?.contentWindow) {
    try {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      return true;
    } catch (err) {
      console.warn("Iframe print fallback failed:", err);
    }
  }

  const printWindow = window.open("", "_blank", "width=1100,height=800");
  if (!printWindow) return false;

  const styleMarkup = Array.from(
    document.querySelectorAll('link[rel="stylesheet"], style'),
  )
    .map((node) => node.outerHTML)
    .join("\n");

  const title = escapeHtml(document.title || "Nodevision");
  const bodyHtml = fileViewRoot.innerHTML ||
    '<pre style="white-space:pre-wrap;">(No view content available)</pre>';

  printWindow.document.open();
  printWindow.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>${title} - Print</title>
  ${styleMarkup}
  <style>
    body { margin: 16px; font-family: system-ui, -apple-system, Segoe UI, sans-serif; }
    img, svg, canvas, video { max-width: 100%; height: auto; }
    iframe { width: 100%; min-height: 600px; border: 0; }
  </style>
</head>
<body>
  ${bodyHtml}
</body>
</html>`);
  printWindow.document.close();

  setTimeout(() => {
    try {
      printWindow.focus();
      printWindow.print();
    } catch (err) {
      console.warn("Viewer print window failed:", err);
    }
  }, 180);

  return true;
}

export default async function PrintSelectedFileOrViewer() {
  const selectedPath = normalizePath(resolveFilePath());
  const selectedExt = getExtension(selectedPath);

  if (selectedPath && DOCUMENT_PRINT_EXTENSIONS.has(selectedExt)) {
    const printedSelectedDoc = await printSelectedDocument(selectedPath);
    if (printedSelectedDoc) return;
  }

  const printedViewer = printFileViewerContents();
  if (printedViewer) return;

  if (selectedPath) {
    const printedSelectedAny = await printSelectedDocument(selectedPath);
    if (printedSelectedAny) return;
  }

  alert("Nothing available to print.");
}
