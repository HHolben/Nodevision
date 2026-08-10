// Nodevision/ApplicationSystem/public/ToolbarCallbacks/file/ExportVirtualWorldAsUSD.mjs
// This file exports the selected Nodevision MetaWorld HTML file as an ASCII USD scene download.

import { exportUsda, extractMetaWorldJsonFromHtml, toUsdLike } from "/MetaWorld/MetaWorldUsdExport.mjs";

function normalizeNotebookPath(inputPath) {
  if (!inputPath || typeof inputPath !== "string") return "";
  let normalized = inputPath.trim().replace(/\\/g, "/");
  normalized = normalized.replace(/^\/+/, "");
  if (normalized.startsWith("Notebook/")) normalized = normalized.slice("Notebook/".length);
  return normalized;
}

function getSelectedWorldPath() {
  return normalizeNotebookPath(
    window.currentActiveFilePath
    || window.selectedFilePath
    || window.filePath
    || window.ActiveNode
    || ""
  );
}

function notebookUrl(path) {
  return `/Notebook/${path.split("/").filter(Boolean).map(encodeURIComponent).join("/")}`;
}

function downloadText(filename, text) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export default async function exportVirtualWorldAsUSD() {
  const worldPath = getSelectedWorldPath();
  if (!worldPath) {
    alert("No virtual world file is selected.");
    return;
  }
  if (!worldPath.toLowerCase().endsWith(".html")) {
    alert("Select an HTML world file before exporting to USD.");
    return;
  }

  let rawText = "";
  try {
    const response = await fetch(notebookUrl(worldPath), { cache: "no-store" });
    if (!response.ok) throw new Error(`Unable to read ${worldPath} (${response.status})`);
    rawText = await response.text();
  } catch (err) {
    console.error("Failed to fetch world file:", err);
    alert(`Failed to load world file: ${err.message}`);
    return;
  }

  const jsonText = extractMetaWorldJsonFromHtml(rawText);
  if (!jsonText) {
    alert("Selected file does not include a Nodevision MetaWorld JSON script block.");
    return;
  }

  try {
    const parsedWorld = JSON.parse(jsonText);
    const fileName = worldPath.split("/").pop() || "world.html";
    const usdaText = exportUsda(toUsdLike(parsedWorld, fileName));
    downloadText(fileName.replace(/\.html$/i, ".usda"), usdaText);
  } catch (err) {
    console.error("Failed to export USD file:", err);
    alert(`Failed to export USD: ${err.message}`);
  }
}
