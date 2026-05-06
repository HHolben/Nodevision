// Nodevision/ApplicationSystem/public/ToolbarCallbacks/file/ExportSelectedFileAsPDF.mjs
// This file defines browser-side Export Selected File As PDF logic for the Nodevision UI.

import { resolveFilePath } from "./saveFile/utils.mjs";

const PDF_PAGE_WIDTH = 612;
const PDF_PAGE_HEIGHT = 792;
const PDF_MARGIN_LEFT = 40;
const PDF_MARGIN_RIGHT = 40;
const PDF_MARGIN_TOP = 40;
const PDF_MARGIN_BOTTOM = 40;
const PDF_FONT_SIZE = 10;
const PDF_LINE_HEIGHT = 14;

const textEncoder = new TextEncoder();

function byteLength(value) {
  return textEncoder.encode(String(value || "")).length;
}

function normalizeSelectedPath(pathValue) {
  return String(pathValue || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/[?#].*$/, "")
    .replace(/^\/+/, "");
}

function derivePdfFileName(pathValue) {
  const clean = normalizeSelectedPath(pathValue);
  const leaf = clean.split("/").pop() || "document";
  const baseName = leaf.replace(/\.[^.]+$/, "") || "document";
  return `${baseName}.pdf`;
}

function toPdfSafeText(text) {
  const input = String(text ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");

  let output = "";
  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i);
    if (code === 9) {
      output += "  ";
      continue;
    }
    if (code === 10) {
      output += "\n";
      continue;
    }
    if (code < 32) {
      output += " ";
      continue;
    }
    if (code > 255) {
      output += "?";
      continue;
    }
    output += input[i];
  }
  return output;
}

function escapePdfString(text) {
  return String(text || "")
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function wrapTextLines(rawText) {
  const maxCharsPerLine = Math.max(
    24,
    Math.floor(
      (PDF_PAGE_WIDTH - PDF_MARGIN_LEFT - PDF_MARGIN_RIGHT) /
        (PDF_FONT_SIZE * 0.6),
    ),
  );
  const rawLines = String(rawText || "").split("\n");
  const wrapped = [];

  for (const rawLine of rawLines) {
    if (!rawLine) {
      wrapped.push("");
      continue;
    }

    let cursor = 0;
    while (cursor < rawLine.length) {
      wrapped.push(rawLine.slice(cursor, cursor + maxCharsPerLine));
      cursor += maxCharsPerLine;
    }
  }

  if (!wrapped.length) wrapped.push("(empty file)");
  return wrapped;
}

function paginateLines(lines) {
  const linesPerPage = Math.max(
    1,
    Math.floor(
      (PDF_PAGE_HEIGHT - PDF_MARGIN_TOP - PDF_MARGIN_BOTTOM) / PDF_LINE_HEIGHT,
    ),
  );
  const pages = [];
  for (let i = 0; i < lines.length; i += linesPerPage) {
    pages.push(lines.slice(i, i + linesPerPage));
  }
  if (!pages.length) pages.push(["(empty file)"]);
  return pages;
}

function buildPageContent(lines) {
  const startY = PDF_PAGE_HEIGHT - PDF_MARGIN_TOP - PDF_FONT_SIZE;
  let stream = "BT\n";
  stream += `/F1 ${PDF_FONT_SIZE} Tf\n`;
  stream += `${PDF_LINE_HEIGHT} TL\n`;
  stream += `${PDF_MARGIN_LEFT} ${startY} Td\n`;

  for (const line of lines) {
    stream += `(${escapePdfString(line)}) Tj\n`;
    stream += "T*\n";
  }

  stream += "ET";
  return stream;
}

function buildPdfDocument(text) {
  const lines = wrapTextLines(toPdfSafeText(text));
  const pages = paginateLines(lines);
  const pageRefs = [];
  const objects = [];

  objects[1] = "<< /Type /Catalog /Pages 2 0 R >>";
  objects[3] = "<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>";

  let nextObjectNumber = 4;
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex += 1) {
    const pageObjectNumber = nextObjectNumber;
    const contentObjectNumber = nextObjectNumber + 1;
    nextObjectNumber += 2;

    pageRefs.push(`${pageObjectNumber} 0 R`);
    const stream = buildPageContent(pages[pageIndex]);

    objects[pageObjectNumber] = [
      "<< /Type /Page",
      "/Parent 2 0 R",
      `/MediaBox [0 0 ${PDF_PAGE_WIDTH} ${PDF_PAGE_HEIGHT}]`,
      "/Resources << /Font << /F1 3 0 R >> >>",
      `/Contents ${contentObjectNumber} 0 R`,
      ">>",
    ].join(" ");

    objects[contentObjectNumber] = `<< /Length ${
      byteLength(stream)
    } >>\nstream\n${stream}\nendstream`;
  }

  objects[2] = `<< /Type /Pages /Kids [${
    pageRefs.join(" ")
  }] /Count ${pages.length} >>`;

  const objectCount = nextObjectNumber - 1;
  const offsets = new Array(objectCount + 1).fill(0);
  let pdf = "%PDF-1.4\n";

  for (let i = 1; i <= objectCount; i += 1) {
    offsets[i] = byteLength(pdf);
    pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`;
  }

  const xrefOffset = byteLength(pdf);
  pdf += `xref\n0 ${objectCount + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i <= objectCount; i += 1) {
    pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  }

  pdf += "trailer\n";
  pdf += `<< /Size ${objectCount + 1} /Root 1 0 R >>\n`;
  pdf += "startxref\n";
  pdf += `${xrefOffset}\n`;
  pdf += "%%EOF";
  return pdf;
}

async function fetchSelectedFileContent(pathValue) {
  const response = await fetch(
    `/api/fileCodeContent?path=${encodeURIComponent(pathValue)}`,
  );
  if (!response.ok) {
    throw new Error(`Failed to load file (${response.status})`);
  }

  const payload = await response.json();
  if (payload?.isBinary) {
    throw new Error(
      "Selected file is binary and cannot be exported as text PDF.",
    );
  }

  return String(payload?.content ?? "");
}

function downloadPdf(pdfText, fileName) {
  const blob = new Blob([pdfText], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export default async function ExportSelectedFileAsPDF() {
  const selectedPath = resolveFilePath();
  if (!selectedPath) {
    alert("No file is selected.");
    return;
  }

  const normalizedPath = normalizeSelectedPath(selectedPath);
  if (!normalizedPath) {
    alert("Selected file path is invalid.");
    return;
  }

  try {
    const fileText = await fetchSelectedFileContent(normalizedPath);
    const printableText = `File: ${normalizedPath}\n\n${fileText}`;
    const pdfText = buildPdfDocument(printableText);
    downloadPdf(pdfText, derivePdfFileName(normalizedPath));
  } catch (err) {
    console.error("Failed to export PDF:", err);
    alert(`Export failed: ${err.message || err}`);
  }
}
