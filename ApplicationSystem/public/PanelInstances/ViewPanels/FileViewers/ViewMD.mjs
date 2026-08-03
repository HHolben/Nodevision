// Nodevision/ApplicationSystem/public/PanelInstances/ViewPanels/FileViewers/ViewMD.mjs
// This module renders Markdown files into readable HTML inside a Nodevision view panel.

import { applyMarkdownRenderClass, ensureMarkdownStyles, renderMarkdown } from "/utils/markdownRenderer.mjs";

function isMarkdownPath(filePath = "") {
  return /\.(md|markdown)$/i.test(String(filePath || "").split(/[?#]/)[0]);
}

function escapeHTML(value = "") {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

export async function renderFile(filePath, panel) {
  const serverBase = "/Notebook";
  panel.innerHTML = "";

  if (!isMarkdownPath(filePath)) {
    panel.innerHTML = "<p>No Markdown file selected.</p>";
    return;
  }

  console.log("[ViewMD] loading", filePath);

  try {
    const response = await fetch(`${serverBase}/${filePath}`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} - ${response.statusText}`);
    }

    const text = await response.text();
    ensureMarkdownStyles(panel.ownerDocument || document);

    const container = document.createElement("div");
    applyMarkdownRenderClass(container);
    container.style.cssText = "padding:18px;max-width:920px;margin:0 auto;";
    container.innerHTML = renderMarkdown(text, { filePath });

    panel.appendChild(container);
  } catch (err) {
    console.error("[ViewMD] Error:", err);
    panel.innerHTML = `<pre style="color:red;white-space:pre-wrap;">${escapeHTML(err?.message || String(err))}</pre>`;
  }
}
