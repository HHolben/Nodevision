// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/PDF/PDFListenTextLayer.mjs
// This module builds a transparent PDF text layer from PDF.js text content so Nodevision can read and highlight rendered PDF text.

export const PDF_LISTEN_TEXT_LAYER_CLASS = "nv-pdf-text-layer";
export const PDF_LISTEN_TEXT_CHUNK_CLASS = "nv-pdf-text-chunk";

export const PDF_LISTEN_TEXT_LAYER_CSS = `
    .nv-pdf-text-layer { position: absolute; inset: 0; overflow: hidden; pointer-events: none; user-select: none; }
    .nv-pdf-text-chunk { position: absolute; white-space: pre; color: transparent; opacity: 0.001; transform-origin: 0 0; }
    .nv-pdf-text-chunk.nv-listen-highlight { color: #d4af37 !important; -webkit-text-fill-color: #d4af37 !important; opacity: 1 !important; background: rgba(212, 175, 55, 0.16); border-radius: 2px; text-shadow: 0 0 1px rgba(0, 0, 0, 0.35); }
`;

function multiplyPdfTransform(a, b) {
  return [
    a[0] * b[0] + a[2] * b[1],
    a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],
    a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4],
    a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}

export function resetPdfListenText(workspace) {
  if (!workspace) return;
  workspace.__nvPdfListenText = "";
  if (workspace.root) workspace.root.__nvPdfListenText = "";
}

function appendPdfListenSeparator(workspace, item) {
  if (item?.hasEOL) {
    workspace.__nvPdfListenText += "\n";
    return;
  }
  if (workspace.__nvPdfListenText && !/\s$/.test(workspace.__nvPdfListenText)) workspace.__nvPdfListenText += " ";
}

function appendPdfListenWordSpan(textLayer, itemText, match, itemStart, tx, height, angle, width) {
  const word = match[0];
  const localStart = match.index || 0;
  const textLength = Math.max(1, itemText.length);
  const leftOffset = width * (localStart / textLength);
  const wordWidth = Math.max(1, width * (word.length / textLength));
  const span = document.createElement("span");
  span.className = PDF_LISTEN_TEXT_CHUNK_CLASS;
  span.dataset.nvListenStart = String(itemStart + localStart);
  span.dataset.nvListenEnd = String(itemStart + localStart + word.length);
  span.textContent = word;
  Object.assign(span.style, {
    position: "absolute",
    left: Math.round((tx[4] + leftOffset) * 100) / 100 + "px",
    top: Math.round((tx[5] - height) * 100) / 100 + "px",
    width: Math.round(wordWidth * 100) / 100 + "px",
    fontSize: Math.round(height * 100) / 100 + "px",
    lineHeight: "1",
    whiteSpace: "pre",
    color: "transparent",
    opacity: "0.001",
    overflow: "visible",
    transformOrigin: "0 0",
    transform: angle ? "rotate(" + angle + "rad)" : "",
  });
  textLayer.appendChild(span);
}

export async function renderPdfTextLayer(workspace, page, viewport) {
  const textLayer = page?.textLayer;
  if (!workspace || !textLayer || !page?.pdfPage) return;
  textLayer.innerHTML = "";
  const content = await page.pdfPage.getTextContent();
  for (const item of content.items || []) {
    const text = String(item?.str || "");
    if (!text) {
      appendPdfListenSeparator(workspace, item);
      continue;
    }
    if (workspace.__nvPdfListenText && !/\s$/.test(workspace.__nvPdfListenText) && !/^\s/.test(text)) workspace.__nvPdfListenText += " ";
    const start = workspace.__nvPdfListenText.length;
    workspace.__nvPdfListenText += text;
    const tx = multiplyPdfTransform(viewport.transform, item.transform || [1, 0, 0, 1, 0, 0]);
    const width = Math.max(1, Number(item.width || 0) * viewport.scale);
    const height = Math.max(1, Math.hypot(tx[2], tx[3]) || Math.hypot(tx[0], tx[1]) || Number(item.height || 0) * viewport.scale || 12);
    const angle = Math.atan2(tx[1], tx[0]);
    for (const match of text.matchAll(/\S+/g)) {
      appendPdfListenWordSpan(textLayer, text, match, start, tx, height, angle, width);
    }
    appendPdfListenSeparator(workspace, item);
  }
  if (workspace.root) workspace.root.__nvPdfListenText = workspace.__nvPdfListenText;
}
